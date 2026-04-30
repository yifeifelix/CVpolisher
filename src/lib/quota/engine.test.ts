import { describe, it, expect } from "vitest";
import { canConsume, type QuotaState } from "./engine";

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
});
