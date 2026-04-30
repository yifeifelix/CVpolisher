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
});
