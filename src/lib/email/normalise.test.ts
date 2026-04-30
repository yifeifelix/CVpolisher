import { describe, it, expect } from "vitest";
import { normaliseEmail, InvalidEmailError } from "./normalise";

describe("normaliseEmail", () => {
  it("lowercases a non-Gmail address but leaves the local part alone", () => {
    expect(normaliseEmail("Jane.Doe@Example.COM")).toBe("jane.doe@example.com");
  });

  it("strips dots in the local part of a Gmail address", () => {
    expect(normaliseEmail("first.last@gmail.com")).toBe("firstlast@gmail.com");
  });

  it("strips the +alias suffix in the local part of a Gmail address", () => {
    expect(normaliseEmail("person+recruiter@gmail.com")).toBe(
      "person@gmail.com",
    );
  });

  it("treats googlemail.com as gmail.com", () => {
    // googlemail.com is Google's legacy UK/DE domain; it routes to the
    // same inbox as gmail.com. Without aliasing it here, a user could
    // sign up under both forms and double-dip on the bonus.
    expect(normaliseEmail("person.one@googlemail.com")).toBe(
      "personone@gmail.com",
    );
  });

  it.each([
    ["no at sign", "nobody.example.com"],
    ["empty local part", "@example.com"],
    ["empty domain", "person@"],
    ["whitespace only", "   "],
    ["empty string", ""],
  ])("throws InvalidEmailError on malformed input: %s", (_label, input) => {
    expect(() => normaliseEmail(input)).toThrow(InvalidEmailError);
  });
});
