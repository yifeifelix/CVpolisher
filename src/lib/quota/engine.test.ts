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
});
