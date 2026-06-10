/**
 * Single source of truth for the default app_users_meta row
 * (ADR-0005 §5). Both write sites — the events.createUser hook and
 * the session callback's lazy-recovery branch — MUST build their
 * insert payload through this factory. Inlining the default object
 * literal at a call site is forbidden: a second hardcoded copy that
 * drifts from this one is undetectable once the values coincide by
 * accident rather than by construction.
 */

import type { NewAppUsersMetaRow } from "@/lib/db/schema";
import { SIGNUP_BONUS } from "./constants";

export function buildInitialMeta(userId: string): NewAppUsersMetaRow {
  return {
    userId,
    tier: "free",
    bonusRemaining: SIGNUP_BONUS,
    superTokens: 0,
    slidingTimerStartedAt: null,
  };
}
