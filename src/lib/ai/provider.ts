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

// ---------------------------------------------------------------------------
// Server-side model routing (v1: the client no longer picks a model)
// ---------------------------------------------------------------------------

export interface ModelRoute {
  providerName: string;
  model: string;
}

/**
 * Parse a "ProviderName:model-id" spec. Splits at the FIRST colon only —
 * OpenRouter model ids legitimately contain colons (the ":free" suffix).
 * Returns null when the spec has no colon or an empty side.
 */
export function parseModelRoute(spec: string): ModelRoute | null {
  const idx = spec.indexOf(':');
  if (idx <= 0 || idx === spec.length - 1) return null;
  return { providerName: spec.slice(0, idx), model: spec.slice(idx + 1) };
}

/**
 * Resolve which provider+model serves a polish request, server-side.
 *
 * Env contract:
 * - POLISH_MODEL_FREE  — "Provider:model" used for free-tier users
 * - POLISH_MODEL_PAID  — "Provider:model" used for paid-tier users;
 *                        falls back to the free route when unset
 *
 * When no env route is set (or it names an unconfigured provider), falls
 * back to the first configured provider's first model so dev setups keep
 * working without extra config. Throws when no provider is configured.
 */
export function getServerRoute(tier: 'free' | 'paid' = 'free'): {
  provider: AIProvider;
  model: string;
} {
  const spec =
    tier === 'paid'
      ? (process.env.POLISH_MODEL_PAID ?? process.env.POLISH_MODEL_FREE)
      : process.env.POLISH_MODEL_FREE;

  if (spec) {
    const route = parseModelRoute(spec);
    if (route) {
      const provider = getRegistry().find(
        (p) => p.name === route.providerName,
      );
      if (provider) return { provider, model: route.model };
      console.warn(
        `[ai] POLISH_MODEL_${tier.toUpperCase()} names provider "${route.providerName}" which is not configured; falling back`,
      );
    } else {
      console.warn(
        `[ai] POLISH_MODEL_${tier.toUpperCase()} is not in "Provider:model" form: "${spec}"; falling back`,
      );
    }
  }

  const first = getRegistry()[0];
  if (!first || first.models.length === 0) {
    throw new Error(
      'No AI provider is configured. Set at least one provider key in .env.local (see .env.local.example).',
    );
  }
  return { provider: first, model: first.models[0] };
}
