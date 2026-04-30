import { describe, it, expect } from "vitest";
import { normaliseEmail } from "./normalise";

describe("normaliseEmail", () => {
  it("lowercases a non-Gmail address but leaves the local part alone", () => {
    expect(normaliseEmail("Jane.Doe@Example.COM")).toBe("jane.doe@example.com");
  });
});
