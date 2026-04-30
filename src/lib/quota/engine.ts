/**
 * Quota engine — pure-function policy for whether a polish event is
 * allowed and which pool pays for it.
 *
 * Canonical specification: docs/CONTEXT.md §Quota lifecycle,
 * §Consumption order, §Daily cap, plus ADR-0003 §2.
 *
 * The engine holds no state of its own. Callers load a QuotaState from
 * the database inside a transaction, pass it in, get a verdict, and
 * persist the side effect.
 */

export interface QuotaState {
  tier: "free" | "paid";
  bonusRemaining: number;
  slidingTimerStartedAt: Date | null;
  recentFreepoolEvents: Date[];
  todayFreepoolCount: number;
  superTokens: number;
}

export type PolishVerdict = { allowed: true; pool: "bonus" };

export function canConsume(_state: QuotaState, _now: Date): PolishVerdict {
  return { allowed: true, pool: "bonus" };
}
