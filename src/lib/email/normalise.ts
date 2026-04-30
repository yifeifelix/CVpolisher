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
 */

export function normaliseEmail(input: string): string {
  const lower = input.toLowerCase();
  const atIndex = lower.lastIndexOf("@");
  const local = lower.slice(0, atIndex);
  const domain = lower.slice(atIndex + 1);

  if (domain === "gmail.com") {
    return `${local.replace(/\./g, "")}@${domain}`;
  }

  return lower;
}
