/**
 * Disposable email blacklist — guard at signup that rejects domains
 * known to operate as temporary-inbox services (Mailinator, 10minutemail,
 * etc.).
 *
 * Canonical specification: docs/CONTEXT.md §Disposable email blacklist.
 *
 * Caller contract: `domain` must already have been through
 * normaliseEmail's domain extraction (i.e. lowercased, with the
 * googlemail.com → gmail.com alias applied). This module does not
 * re-canonicalise — it only looks the domain up in the static set.
 *
 * The list starts small and deliberate. A larger list backed by a
 * JSON fixture or an OSS disposable-domain feed is a Phase 1 open
 * item in ADR-0002; at that point only this file's BLACKLIST constant
 * changes, the isDisposable signature stays stable.
 */

const BLACKLIST: ReadonlySet<string> = new Set([
  "tempmail.com",
]);

export function isDisposable(domain: string): boolean {
  return BLACKLIST.has(domain.toLowerCase());
}
