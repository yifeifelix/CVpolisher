import { describe, it, expect } from "vitest";
import { isAllowed } from "./rate-limit";

describe("isAllowed", () => {
  it("allows the first attempt when no prior attempts exist", () => {
    const now = new Date("2026-05-01T10:00:00Z");

    const allowed = isAllowed({
      recentAttempts: [],
      limit: 1,
      windowMs: 60 * 60 * 1000,
      now,
    });

    expect(allowed).toBe(true);
  });

  it("denies when recent attempts inside the window already meet the limit", () => {
    // Per-IP signup limit is 1/hour. A single attempt 30 minutes ago
    // is enough to block a new attempt now.
    const now = new Date("2026-05-01T10:00:00Z");
    const thirtyMinutesAgo = new Date("2026-05-01T09:30:00Z");

    const allowed = isAllowed({
      recentAttempts: [thirtyMinutesAgo],
      limit: 1,
      windowMs: 60 * 60 * 1000,
      now,
    });

    expect(allowed).toBe(false);
  });
});
