/**
 * OpenRouter AI provider.
 *
 * OpenRouter exposes an OpenAI-compatible chat completions API.
 * Docs: https://openrouter.ai/docs
 */

import type { AIProvider, Message } from './provider';

interface OpenRouterChoice {
  message: {
    role: string;
    content: string;
  };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
  error?: { message: string };
}

interface OpenRouterConfig {
  apiKey: string;
  models: string[];
}

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterProvider implements AIProvider {
  readonly name = 'OpenRouter';
  readonly models: string[];

  private readonly apiKey: string;

  constructor(config: OpenRouterConfig) {
    this.apiKey = config.apiKey;
    this.models = config.models;
  }

  /**
   * Create an OpenRouterProvider from environment variables.
   * Returns null if OPENROUTER_API_KEY is not set.
   */
  static fromEnv(): OpenRouterProvider | null {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) return null;

    const models = parseModelList(process.env.OPENROUTER_MODELS);
    if (models.length === 0) return null;

    return new OpenRouterProvider({ apiKey, models });
  }

  async chat(model: string, messages: Message[]): Promise<string> {
    if (!this.models.includes(model)) {
      throw new Error(`OpenRouter: unknown model "${model}". Available: ${this.models.join(', ')}`);
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterResponse;

    if (data.error) {
      throw new Error(`OpenRouter error: ${data.error.message}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('OpenRouter: unexpected response shape, no content found');
    }

    return content;
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
