import { describe, it, expect } from "vitest";
import { normaliseEmail } from "./normalise";

describe("normaliseEmail", () => {
  it("lowercases a non-Gmail address but leaves the local part alone", () => {
    expect(normaliseEmail("Jane.Doe@Example.COM")).toBe("jane.doe@example.com");
  });

  it("strips dots in the local part of a Gmail address", () => {
    expect(normaliseEmail("first.last@gmail.com")).toBe("firstlast@gmail.com");
  });
});
