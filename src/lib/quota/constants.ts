/**
 * Signup bonus — free-pool entries allocated on first sign-in.
 *
 * Canonical value pinned by ADR-0001 §3 ("Registration: bonus = 6")
 * and ADR-0003 §4 (bonus row: 6 for both tiers). Every write site
 * reads this constant via buildInitialMeta (ADR-0005 §4, §5); the
 * literal must not appear in business code.
 */
export const SIGNUP_BONUS = 6;
