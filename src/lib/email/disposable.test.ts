import { describe, it, expect } from "vitest";
import { isDisposable } from "./disposable";

describe("isDisposable", () => {
  it("returns true for a known disposable domain", () => {
    expect(isDisposable("tempmail.com")).toBe(true);
  });

  it("returns false for a normal mainstream domain", () => {
    expect(isDisposable("gmail.com")).toBe(false);
  });

  it("matches a disposable domain regardless of input case", () => {
    // Defence-in-depth: caller contract says the domain is already
    // lowercased, but a single forgotten normaliseEmail call in a
    // future signup-adjacent route would otherwise silently let a
    // disposable domain through. The engine lowercases again.
    expect(isDisposable("TempMail.COM")).toBe(true);
  });
});
