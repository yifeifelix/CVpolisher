import { describe, it, expect } from "vitest";
import { isDisposable } from "./disposable";

describe("isDisposable", () => {
  it("returns true for a known disposable domain", () => {
    expect(isDisposable("tempmail.com")).toBe(true);
  });
});
