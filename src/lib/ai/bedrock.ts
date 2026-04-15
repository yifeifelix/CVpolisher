/**
 * AWS Bedrock AI provider.
 *
 * Uses InvokeModelCommand with the Anthropic Messages API format.
 * Docs: https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages.html
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { AIProvider, Message } from './provider';
import { parseModelList, separateSystemMessage } from './utils';

interface BedrockConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  models: string[];
}

interface AnthropicMessagesRequest {
  anthropic_version: string;
  max_tokens: number;
  system?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

interface AnthropicMessagesResponse {
  content: Array<{ type: string; text?: string }>;
  error?: { type: string; message: string };
}

const ANTHROPIC_VERSION = 'bedrock-2023-05-31';
const DEFAULT_MAX_TOKENS = 4096;

export class BedrockProvider implements AIProvider {
  readonly name = 'Bedrock';
  readonly models: string[];

  private readonly client: BedrockRuntimeClient;

  constructor(config: BedrockConfig) {
    this.models = config.models;
    this.client = new BedrockRuntimeClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  /**
   * Create a BedrockProvider from environment variables.
   * Returns null if AWS credentials are not set.
   */
  static fromEnv(): BedrockProvider | null {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    const region = process.env.AWS_REGION?.trim() ?? 'us-east-1';

    if (!accessKeyId || !secretAccessKey) return null;

    const models = parseModelList(process.env.BEDROCK_MODELS);
    if (models.length === 0) return null;

    return new BedrockProvider({ accessKeyId, secretAccessKey, region, models });
  }

  async chat(model: string, messages: Message[]): Promise<string> {
    if (!this.models.includes(model)) {
      throw new Error(`Bedrock: unknown model "${model}". Available: ${this.models.join(', ')}`);
    }

    const { systemPrompt, conversationMessages } = separateSystemMessage(messages);

    const requestBody: AnthropicMessagesRequest = {
      anthropic_version: ANTHROPIC_VERSION,
      max_tokens: DEFAULT_MAX_TOKENS,
      messages: conversationMessages,
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    const command = new InvokeModelCommand({
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await this.client.send(command);

    const rawBody = response.body;
    if (!rawBody) {
      throw new Error('Bedrock: empty response body');
    }

    const decoded = new TextDecoder().decode(rawBody);
    const data = JSON.parse(decoded) as AnthropicMessagesResponse;

    if (data.error) {
      throw new Error(`Bedrock error: ${data.error.type} - ${data.error.message}`);
    }

    const textBlock = data.content?.find((c) => c.type === 'text');
    if (!textBlock?.text) {
      throw new Error('Bedrock: no text content in response');
    }

    return textBlock.text;
  }
}

