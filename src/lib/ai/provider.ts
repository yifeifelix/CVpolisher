/**
 * AI Provider abstraction layer.
 *
 * Defines the AIProvider interface, a registry of configured providers,
 * and helper functions for the UI to enumerate available providers/models.
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIProvider {
  /** Human-readable provider name, e.g. "OpenRouter" */
  name: string;
  /** List of model IDs supported by this provider */
  models: string[];
  /**
   * Send a chat request and return the text response.
   * @throws Error with a descriptive message on failure
   */
  chat(model: string, messages: Message[]): Promise<string>;
}

export interface ProviderInfo {
  name: string;
  models: string[];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

let _registry: AIProvider[] | null = null;

/** Build (and cache) the registry of configured providers. */
function buildRegistry(): AIProvider[] {
  // Lazy imports so unused provider SDKs are never loaded at module init.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { OpenRouterProvider } = require('./openrouter') as typeof import('./openrouter');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BedrockProvider } = require('./bedrock') as typeof import('./bedrock');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleVertexProvider } = require('./google') as typeof import('./google');

  const providers: AIProvider[] = [];

  const openRouter = OpenRouterProvider.fromEnv();
  if (openRouter) providers.push(openRouter);

  const bedrock = BedrockProvider.fromEnv();
  if (bedrock) providers.push(bedrock);

  const google = GoogleVertexProvider.fromEnv();
  if (google) providers.push(google);

  return providers;
}

function getRegistry(): AIProvider[] {
  if (_registry === null) {
    _registry = buildRegistry();
  }
  return _registry;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns metadata for all providers that are currently configured.
 * Safe to call from the UI layer (does not expose credentials).
 */
export function getProviders(): ProviderInfo[] {
  return getRegistry().map((p) => ({ name: p.name, models: p.models }));
}

/**
 * Returns the AIProvider instance for the given name, or throws if not found.
 */
export function getProvider(name: string): AIProvider {
  const provider = getRegistry().find((p) => p.name === name);
  if (!provider) {
    const available = getRegistry()
      .map((p) => p.name)
      .join(', ');
    throw new Error(
      `Provider "${name}" is not configured. Available providers: ${available || 'none'}`
    );
  }
  return provider;
}

/** Convenience: reset the registry cache (useful for testing). */
export function resetProviderRegistry(): void {
  _registry = null;
}
