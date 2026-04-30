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

/** The 5-hour refill window, expressed as milliseconds. */
const REFILL_WINDOW_MS = 5 * 60 * 60 * 1000;

/** Per-tier refill cap, per CONTEXT.md §Tier. */
function refillCap(tier: "free" | "paid"): number {
  return tier === "paid" ? 5 : 3;
}

/** Per-tier daily cap, per CONTEXT.md §Daily cap. */
function dailyCap(tier: "free" | "paid"): number {
  return tier === "paid" ? 15 : 8;
}

/**
 * True when the sliding timer no longer gates the free pool — either
 * because it was never started (steady state) or because it has
 * expired past the 5h first-refill boundary (phase 3 onward).
 */
function slidingTimerOpen(
  timerStartedAt: Date | null,
  now: Date,
): boolean {
  if (timerStartedAt === null) return true;
  return now.getTime() >= timerStartedAt.getTime() + REFILL_WINDOW_MS;
}

/**
 * Steady-state refill remaining, derived from the events-in-window count.
 * See CONTEXT.md §Quota lifecycle phase 4.
 */
function refillRemaining(state: QuotaState, now: Date): number {
  const windowStart = now.getTime() - REFILL_WINDOW_MS;
  const inWindow = state.recentFreepoolEvents.filter(
    (t) => t.getTime() > windowStart,
  ).length;
  return Math.max(0, refillCap(state.tier) - inWindow);
}

export interface QuotaState {
  tier: "free" | "paid";
  bonusRemaining: number;
  slidingTimerStartedAt: Date | null;
  recentFreepoolEvents: Date[];
  todayFreepoolCount: number;
  superTokens: number;
}

export type PolishVerdict =
  | { allowed: true; pool: "bonus" | "refill" | "super_tokens" }
  | { allowed: false };

/**
 * A single database-level effect produced by a polish event. The engine
 * emits a list of these; the calling route handler translates each into
 * a SQL statement inside its transaction.
 */
export type QuotaMutation =
  | { kind: "decrement_bonus" }
  | { kind: "increment_today_freepool" }
  | { kind: "insert_free_event"; at: Date }
  | { kind: "decrement_super_tokens" }
  | { kind: "set_sliding_timer"; at: Date }
  | { kind: "clear_sliding_timer" };

export function canConsume(state: QuotaState, now: Date): PolishVerdict {
  // Daily cap gates the free pool (bonus + refill). Super tokens bypass
  // it per CONTEXT.md §Daily cap.
  const freePoolOpen = state.todayFreepoolCount < dailyCap(state.tier);

  if (freePoolOpen && state.bonusRemaining > 0) {
    return { allowed: true, pool: "bonus" };
  }

  // Refill is gated by the sliding timer during awaiting-first-refill
  // (timer non-null and within 5h). After the timer expires (or when
  // it was never started, i.e. steady state), the free pool opens.
  if (
    freePoolOpen &&
    slidingTimerOpen(state.slidingTimerStartedAt, now) &&
    refillRemaining(state, now) > 0
  ) {
    return { allowed: true, pool: "refill" };
  }

  if (state.superTokens > 0) {
    return { allowed: true, pool: "super_tokens" };
  }

  return { allowed: false };
}

/**
 * Given a verdict's pool choice, emit the list of database mutations
 * that a polish event produces. The engine is a pure function; the
 * caller applies the mutations inside a transaction after canConsume
 * has allowed the request.
 *
 * The mutations for each pool are fixed by the rules in
 * CONTEXT.md §Polish event and §Quota lifecycle.
 */
export function recordConsumption(
  state: QuotaState,
  pool: "bonus" | "refill" | "super_tokens",
  now: Date,
): QuotaMutation[] {
  switch (pool) {
    case "bonus": {
      const mutations: QuotaMutation[] = [
        { kind: "decrement_bonus" },
        { kind: "increment_today_freepool" },
      ];
      // Bonus→refill transition: when this polish exhausts the bonus
      // pool, the sliding timer starts at this moment. CONTEXT.md
      // §Quota lifecycle phase 1→2.
      if (state.bonusRemaining === 1) {
        mutations.push({ kind: "set_sliding_timer", at: now });
      }
      return mutations;
    }
    case "refill": {
      const mutations: QuotaMutation[] = [
        { kind: "insert_free_event", at: now },
        { kind: "increment_today_freepool" },
      ];
      // Phase 3: first refill tick. If the sliding timer was running,
      // this consumption clears it — the steady-state formula takes
      // over from here. CONTEXT.md §Quota lifecycle phase 3.
      if (state.slidingTimerStartedAt !== null) {
        mutations.push({ kind: "clear_sliding_timer" });
      }
      return mutations;
    }
    case "super_tokens":
      return [{ kind: "decrement_super_tokens" }];
    default: {
      const exhaustive: never = pool;
      throw new Error(`unhandled pool: ${exhaustive satisfies never}`);
    }
  }
}
