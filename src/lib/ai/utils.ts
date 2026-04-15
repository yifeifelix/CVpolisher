import type { Message } from "./provider";

export function parseModelList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function separateSystemMessage(messages: Message[]): {
  systemPrompt: string | undefined;
  conversationMessages: { role: "user" | "assistant"; content: string }[];
} {
  let systemPrompt: string | undefined;
  const conversationMessages: {
    role: "user" | "assistant";
    content: string;
  }[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n${msg.content}`
        : msg.content;
    } else {
      conversationMessages.push({ role: msg.role, content: msg.content });
    }
  }

  return { systemPrompt, conversationMessages };
}
