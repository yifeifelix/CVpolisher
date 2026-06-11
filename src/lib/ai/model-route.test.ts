import { describe, it, expect } from "vitest";
import { parseModelRoute } from "./provider";

describe("parseModelRoute", () => {
  it("splits provider and model at the first colon", () => {
    expect(parseModelRoute("OpenRouter:anthropic/claude-sonnet-4.5")).toEqual({
      providerName: "OpenRouter",
      model: "anthropic/claude-sonnet-4.5",
    });
  });

  it("keeps colons inside the model id (OpenRouter :free suffix)", () => {
    expect(
      parseModelRoute("OpenRouter:deepseek/deepseek-chat-v3-0324:free"),
    ).toEqual({
      providerName: "OpenRouter",
      model: "deepseek/deepseek-chat-v3-0324:free",
    });
  });

  it("returns null for specs without a colon or with empty parts", () => {
    expect(parseModelRoute("just-a-model")).toBeNull();
    expect(parseModelRoute(":model-only")).toBeNull();
    expect(parseModelRoute("Provider:")).toBeNull();
    expect(parseModelRoute("")).toBeNull();
  });
});
