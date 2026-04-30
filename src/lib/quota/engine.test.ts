import { describe, it, expect } from "vitest";
import {
  canConsume,
  recordConsumption,
  type QuotaState,
} from "./engine";

describe("quota engine — canConsume", () => {
  it("allows a newly registered free user to polish, drawing from the bonus pool", () => {
    const state: QuotaState = {
      tier: "free",
      bonusRemaining: 6,
      slidingTimerStartedAt: null,
      recentFreepoolEvents: [],
      todayFreepoolCount: 0,
      superTokens: 0,
    };

    const verdict = canConsume(state, new Date("2026-05-01T10:00:00Z"));

    expect(verdict).toEqual({ allowed: true, pool: "bonus" });
  });

  it("denies a free user whose bonus is gone, sliding timer is running, and super tokens are zero", () => {
    // User exhausted bonus 1 hour ago; the 5h sliding timer is mid-flight.
    const now = new Date("2026-05-01T10:00:00Z");
    const oneHourAgo = new Date("2026-05-01T09:00:00Z");

    const state: QuotaState = {
      tier: "free",
      bonusRemaining: 0,
      slidingTimerStartedAt: oneHourAgo,
      recentFreepoolEvents: [],
      todayFreepoolCount: 6,
      superTokens: 0,
    };

    const verdict = canConsume(state, now);

    expect(verdict.allowed).toBe(false);
  });

  it("falls through to super tokens when the free pool is unavailable", () => {
    // Paid user in awaiting-refill. Free pool is empty but super tokens
    // remain — the engine should pick super_tokens rather than denying.
    const now = new Date("2026-05-01T10:00:00Z");
    const oneHourAgo = new Date("2026-05-01T09:00:00Z");

    const state: QuotaState = {
      tier: "paid",
      bonusRemaining: 0,
      slidingTimerStartedAt: oneHourAgo,
      recentFreepoolEvents: [],
      todayFreepoolCount: 6,
      superTokens: 4,
    };

    const verdict = canConsume(state, now);

    expect(verdict).toEqual({ allowed: true, pool: "super_tokens" });
  });

  it("allows a paid user in steady state to draw from refill when it has remaining capacity", () => {
    // Paid refill cap is 5. One event 2h ago counts against the window,
    // so 4 units of refill remain. Engine should pick refill (not super
    // tokens), since the free pool is still viable.
    const now = new Date("2026-05-01T10:00:00Z");
    const twoHoursAgo = new Date("2026-05-01T08:00:00Z");

    const state: QuotaState = {
      tier: "paid",
      bonusRemaining: 0,
      slidingTimerStartedAt: null,
      recentFreepoolEvents: [twoHoursAgo],
      todayFreepoolCount: 1,
      superTokens: 4,
    };

    const verdict = canConsume(state, now);

    expect(verdict).toEqual({ allowed: true, pool: "refill" });
  });

  it("denies a free user whose daily cap is reached even if refill would otherwise allow it", () => {
    // Free daily cap is 8. The events-in-window count shows 2, which
    // would normally make refill=3-2=1 (allow), but today's counter is
    // at 8 and the user has no super tokens, so the cap denies.
    const now = new Date("2026-05-01T22:00:00Z");
    const oneHourAgo = new Date("2026-05-01T21:00:00Z");
    const twoHoursAgo = new Date("2026-05-01T20:00:00Z");

    const state: QuotaState = {
      tier: "free",
      bonusRemaining: 0,
      slidingTimerStartedAt: null,
      recentFreepoolEvents: [oneHourAgo, twoHoursAgo],
      todayFreepoolCount: 8,
      superTokens: 0,
    };

    const verdict = canConsume(state, now);

    expect(verdict.allowed).toBe(false);
  });

  it("delivers the first refill once the sliding timer has passed 5 hours", () => {
    // Free user in phase 3: bonus exhausted 6h ago, timer was started
    // at that moment, so timer + 5h < now. The free pool should open
    // with pool=refill (not 'bonus', not 'super_tokens', not denial).
    const now = new Date("2026-05-01T16:00:00Z");
    const sixHoursAgo = new Date("2026-05-01T10:00:00Z");

    const state: QuotaState = {
      tier: "free",
      bonusRemaining: 0,
      slidingTimerStartedAt: sixHoursAgo,
      recentFreepoolEvents: [],
      todayFreepoolCount: 6,
      superTokens: 0,
    };

    const verdict = canConsume(state, now);

    expect(verdict).toEqual({ allowed: true, pool: "refill" });
  });

  it("prefers bonus over refill when both pools have capacity", () => {
    // CONTEXT.md §Consumption order requires bonus to be consumed first.
    // This state is implausible in steady operation (bonus>0 implies no
    // refill events yet), but the invariant should hold regardless: if
    // bonus has any remaining units, they are picked before refill.
    const now = new Date("2026-05-01T10:00:00Z");
    const oneHourAgo = new Date("2026-05-01T09:00:00Z");

    const state: QuotaState = {
      tier: "free",
      bonusRemaining: 2,
      slidingTimerStartedAt: null,
      recentFreepoolEvents: [oneHourAgo],
      todayFreepoolCount: 5,
      superTokens: 0,
    };

    const verdict = canConsume(state, now);

    expect(verdict).toEqual({ allowed: true, pool: "bonus" });
  });
});

describe("quota engine — recordConsumption", () => {
  it("emits decrement-bonus and increment-today when consuming from the bonus pool", () => {
    const now = new Date("2026-05-01T10:00:00Z");
    const state: QuotaState = {
      tier: "free",
      bonusRemaining: 6,
      slidingTimerStartedAt: null,
      recentFreepoolEvents: [],
      todayFreepoolCount: 0,
      superTokens: 0,
    };

    const mutations = recordConsumption(state, "bonus", now);

    expect(mutations).toEqual([
      { kind: "decrement_bonus" },
      { kind: "increment_today_freepool" },
    ]);
  });

  it("emits insert-event and increment-today when consuming from refill in steady state", () => {
    const now = new Date("2026-05-01T10:00:00Z");
    const state: QuotaState = {
      tier: "free",
      bonusRemaining: 0,
      slidingTimerStartedAt: null,
      recentFreepoolEvents: [],
      todayFreepoolCount: 0,
      superTokens: 0,
    };

    const mutations = recordConsumption(state, "refill", now);

    expect(mutations).toEqual([
      { kind: "insert_free_event", at: now },
      { kind: "increment_today_freepool" },
    ]);
  });
});
