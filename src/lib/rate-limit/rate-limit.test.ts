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

  it("ignores attempts that fall outside the window", () => {
    // An attempt 2 hours ago does not count toward a 1-hour window.
    // This is defence-in-depth: even if the caller's SQL query fails
    // to filter by created_at, the engine still gives the right answer.
    const now = new Date("2026-05-01T10:00:00Z");
    const twoHoursAgo = new Date("2026-05-01T08:00:00Z");

    const allowed = isAllowed({
      recentAttempts: [twoHoursAgo],
      limit: 1,
      windowMs: 60 * 60 * 1000,
      now,
    });

    expect(allowed).toBe(true);
  });

  it("treats an attempt exactly at the window edge as expired (exclusive)", () => {
    // Pins the chosen boundary semantics: an attempt whose timestamp
    // equals `now - windowMs` is considered OUTSIDE the window — i.e.
    // the user can retry at exactly 1 hour after their last attempt,
    // not 1 hour and 1 millisecond after.
    //
    // See the commit message for the rationale; this test's job is to
    // lock the choice so a future refactor cannot silently flip it.
    const now = new Date("2026-05-01T10:00:00Z");
    const exactlyOneHourAgo = new Date("2026-05-01T09:00:00Z");

    const allowed = isAllowed({
      recentAttempts: [exactlyOneHourAgo],
      limit: 1,
      windowMs: 60 * 60 * 1000,
      now,
    });

    expect(allowed).toBe(true);
  });
});
