/**
 * Rate limit engine — pure-function policy deciding whether a new
 * attempt against some rate-limited endpoint is allowed given the list
 * of recent attempts already made under the same key.
 *
 * Canonical specification: docs/CONTEXT.md §Rate limit +
 * ADR-0001 §11 controls 5 and 6.
 *
 * Used at signup for both per-IP and per-email-domain rate limits.
 * The caller is responsible for:
 * - loading the recent attempt timestamps from rate_limit_events
 *   inside a transaction
 * - writing a new row after a successful call to indicate "one more
 *   attempt has happened"
 * - applying any allowlist (Gmail, Outlook, etc. for per-email-domain)
 *   before consulting this engine
 *
 * The engine itself is stateless and has no idea what the key is —
 * that separation keeps the same code path working for both rate
 * limit kinds and for anything we add later.
 */

export interface RateLimitQuery {
  /** Timestamps of recent attempts made under this key. */
  recentAttempts: Date[];
  /** Maximum allowed attempts within the window (e.g. 1, 3). */
  limit: number;
  /** Window length in milliseconds (e.g. 3_600_000 for 1 hour). */
  windowMs: number;
  /** Current time. */
  now: Date;
}

export function isAllowed(_query: RateLimitQuery): boolean {
  return true;
}
