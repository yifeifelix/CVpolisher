import { describe, it, expect } from "vitest";
import { buildInitialMeta } from "./initial-meta";
import { SIGNUP_BONUS } from "./constants";

describe("buildInitialMeta", () => {
  it("returns userId verbatim from the argument", () => {
    const meta = buildInitialMeta("user-abc-123");

    expect(meta.userId).toBe("user-abc-123");
  });

  it('sets tier to "free"', () => {
    const meta = buildInitialMeta("u1");

    expect(meta.tier).toBe("free");
  });

  it("reads bonusRemaining from the SIGNUP_BONUS constant, not a literal", () => {
    // Deliberately compared against the imported constant rather than a
    // hardcoded number: if SIGNUP_BONUS changes per a future ADR, this
    // test must keep passing without edits (ADR-0005 §5 — the literal
    // never appears in business code).
    const meta = buildInitialMeta("u1");

    expect(meta.bonusRemaining).toBe(SIGNUP_BONUS);
  });

  it("sets superTokens to 0", () => {
    const meta = buildInitialMeta("u1");

    expect(meta.superTokens).toBe(0);
  });

  it("sets slidingTimerStartedAt to null", () => {
    const meta = buildInitialMeta("u1");

    expect(meta.slidingTimerStartedAt).toBeNull();
  });

  it("returns exactly the v1 default row shape, no extra or missing keys", () => {
    // Locks the object shape so a future edit can't silently add or
    // drop a column on one write path. Every NOT-NULL-without-usable-
    // default column of app_users_meta must appear here; new columns
    // added to the schema must be added to the factory AND this list.
    const meta = buildInitialMeta("u1");

    expect(Object.keys(meta).sort()).toEqual([
      "bonusRemaining",
      "slidingTimerStartedAt",
      "superTokens",
      "tier",
      "userId",
    ]);
  });
});
