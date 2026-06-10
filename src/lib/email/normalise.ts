/**
 * Email normalisation — canonicalises email addresses before uniqueness
 * check and before storing as `users.email_normalized`.
 *
 * Canonical specification: docs/CONTEXT.md §Email normalisation.
 *
 * Used at signup to prevent bonus-farming via Gmail alias tricks
 * (dots in the local part + `+alias` suffix). Non-Gmail addresses
 * are lowercased but not otherwise modified, since RFC 5321 treats
 * the local part as case-sensitive and domain-specific — rewriting
 * addresses for other providers could incorrectly merge distinct
 * accounts.
 *
 * Malformed input (missing @, empty local or domain, whitespace only,
 * empty string) is rejected via `InvalidEmailError` rather than
 * normalised to garbage. The signup route handler is expected to
 * translate that exception into a 400 response.
 */

export class InvalidEmailError extends Error {
  constructor(reason: string) {
    super(`invalid email: ${reason}`);
    this.name = "InvalidEmailError";
  }
}

export function normaliseEmail(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new InvalidEmailError("empty");
  }

  const lower = trimmed.toLowerCase();
  const atIndex = lower.lastIndexOf("@");
  if (atIndex === -1) {
    throw new InvalidEmailError("missing @");
  }

  const local = lower.slice(0, atIndex);
  const rawDomain = lower.slice(atIndex + 1);
  if (local.length === 0) {
    throw new InvalidEmailError("empty local part");
  }
  if (rawDomain.length === 0) {
    throw new InvalidEmailError("empty domain");
  }

  // googlemail.com is Google's legacy UK/DE domain, aliased to
  // gmail.com for inbox purposes. Canonicalise before the Gmail
  // transforms so a single rule path handles both.
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;

  if (domain === "gmail.com") {
    const withoutAlias = local.split("+", 1)[0];
    const withoutDots = withoutAlias.replace(/\./g, "");
    if (withoutDots.length === 0) {
      // `"+foo@gmail.com"` and `".@gmail.com"` reduce to empty locals
      // after the Gmail-specific transforms; reject rather than emit
      // an un-addressable normalised form.
      throw new InvalidEmailError("empty local part after Gmail cleanup");
    }
    return `${withoutDots}@${domain}`;
  }

  return `${local}@${domain}`;
}
