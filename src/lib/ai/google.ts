/**
 * Google Vertex AI provider (Anthropic Claude models).
 *
 * Sends requests to the Vertex AI rawPredict endpoint using a Google OAuth2
 * access token derived from a service account key file referenced by
 * GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Anthropic Messages API format is used, matching Bedrock.
 * Docs: https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude
 */

import { readFileSync } from 'fs';
import type { AIProvider, Message } from './provider';

interface GoogleVertexConfig {
  credentialsPath: string;
  projectId: string;
  region: string;
  models: string[];
}

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface AnthropicMessagesResponse {
  content: Array<{ type: string; text?: string }>;
  error?: { type: string; message: string };
}

const ANTHROPIC_VERSION = 'vertex-2023-10-16';
const DEFAULT_MAX_TOKENS = 4096;
const GOOGLE_TOKEN_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

/** Simple in-process token cache keyed by service-account email. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export class GoogleVertexProvider implements AIProvider {
  readonly name = 'Google';
  readonly models: string[];

  private readonly credentialsPath: string;
  private readonly projectId: string;
  private readonly region: string;

  constructor(config: GoogleVertexConfig) {
    this.credentialsPath = config.credentialsPath;
    this.projectId = config.projectId;
    this.region = config.region;
    this.models = config.models;
  }

  /**
   * Create a GoogleVertexProvider from environment variables.
   * Returns null if required config is missing.
   */
  static fromEnv(): GoogleVertexProvider | null {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    const projectId = process.env.GOOGLE_PROJECT_ID?.trim();
    const region = process.env.GOOGLE_REGION?.trim() ?? 'us-central1';

    if (!credentialsPath || !projectId) return null;

    const models = parseModelList(process.env.GOOGLE_MODELS);
    if (models.length === 0) return null;

    return new GoogleVertexProvider({ credentialsPath, projectId, region, models });
  }

  async chat(model: string, messages: Message[]): Promise<string> {
    if (!this.models.includes(model)) {
      throw new Error(`Google: unknown model "${model}". Available: ${this.models.join(', ')}`);
    }

    const accessToken = await this.getAccessToken();
    const endpoint = buildEndpointUrl(this.region, this.projectId, model);

    const { systemPrompt, conversationMessages } = separateSystemMessage(messages);

    const requestBody: Record<string, unknown> = {
      anthropic_version: ANTHROPIC_VERSION,
      max_tokens: DEFAULT_MAX_TOKENS,
      messages: conversationMessages,
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Google Vertex AI error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as AnthropicMessagesResponse;

    if (data.error) {
      throw new Error(`Google Vertex AI error: ${data.error.type} - ${data.error.message}`);
    }

    const textBlock = data.content?.find((c) => c.type === 'text');
    if (!textBlock?.text) {
      throw new Error('Google Vertex AI: no text content in response');
    }

    return textBlock.text;
  }

  // ---------------------------------------------------------------------------
  // Private: Google OAuth2 token acquisition via JWT
  // ---------------------------------------------------------------------------

  private async getAccessToken(): Promise<string> {
    const key = await this.loadServiceAccountKey();
    const cacheEntry = tokenCache.get(key.client_email);

    // Return cached token if still valid (with 60-second buffer)
    if (cacheEntry && Date.now() < cacheEntry.expiresAt - 60_000) {
      return cacheEntry.token;
    }

    const token = await fetchAccessToken(key);
    tokenCache.set(key.client_email, {
      token: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    });

    return token.access_token;
  }

  private loadServiceAccountKey(): ServiceAccountKey {
    let raw: string;
    try {
      raw = readFileSync(this.credentialsPath, 'utf8');
    } catch (err) {
      throw new Error(
        `Google: failed to read credentials file at "${this.credentialsPath}": ${String(err)}`
      );
    }

    let key: unknown;
    try {
      key = JSON.parse(raw);
    } catch {
      throw new Error(
        `Google: credentials file at "${this.credentialsPath}" is not valid JSON`
      );
    }

    if (!isServiceAccountKey(key)) {
      throw new Error(
        `Google: credentials file does not look like a service account key (missing required fields)`
      );
    }

    return key;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseModelList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildEndpointUrl(region: string, projectId: string, model: string): string {
  return (
    `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${region}/publishers/anthropic/models/${model}:rawPredict`
  );
}

function separateSystemMessage(messages: Message[]): {
  systemPrompt: string | undefined;
  conversationMessages: { role: 'user' | 'assistant'; content: string }[];
} {
  let systemPrompt: string | undefined;
  const conversationMessages: { role: 'user' | 'assistant'; content: string }[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt = systemPrompt ? `${systemPrompt}\n${msg.content}` : msg.content;
    } else {
      conversationMessages.push({ role: msg.role, content: msg.content });
    }
  }

  return { systemPrompt, conversationMessages };
}

function isServiceAccountKey(v: unknown): v is ServiceAccountKey {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['client_email'] === 'string' &&
    typeof o['private_key'] === 'string' &&
    typeof o['token_uri'] === 'string'
  );
}

/**
 * Exchange a service-account key for a short-lived OAuth2 access token.
 *
 * We implement JWT signing manually using the Web Crypto API so we can stay
 * dependency-free (no googleapis / google-auth-library bundle needed).
 */
async function fetchAccessToken(key: ServiceAccountKey): Promise<GoogleTokenResponse> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: GOOGLE_TOKEN_SCOPE,
      aud: key.token_uri,
      exp: now + 3600,
      iat: now,
    })
  );

  const signingInput = `${header}.${payload}`;
  const signature = await signRS256(signingInput, key.private_key);
  const jwt = `${signingInput}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  const response = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Google auth token request failed ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

function base64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlBuffer(buf: ArrayBuffer): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function signRS256(input: string, pemKey: string): Promise<string> {
  // Strip PEM headers and decode
  const cleaned = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const keyDer = Buffer.from(cleaned, 'base64');

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(input)
  );

  return base64urlBuffer(signature);
}
