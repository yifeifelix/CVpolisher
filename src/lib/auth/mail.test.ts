import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendMail, getRecentMail, _resetOutboxForTest } from "./mail";

// ADR-0004 §3 fixes the behaviour:
// - sendMail prints a machine-readable block to stdout AND pushes the
//   record onto an in-memory ring buffer capped at 50.
// - getRecentMail returns the buffer contents newest-first.
// - The buffer is process-lifetime; nothing is persisted.

describe("sendMail", () => {
  beforeEach(() => {
    _resetOutboxForTest();
  });

  it("prints the ADR-0004 §3 machine-readable block to stdout", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    sendMail({
      to: "alice@example.com",
      subject: "Verify your email",
      link: "http://localhost:3443/auth/verify?token=abc",
      body: "Click the link",
    });

    const written = write.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("[MOCK MAIL] to: alice@example.com");
    expect(written).toContain("[MOCK MAIL] subject: Verify your email");
    expect(written).toContain(
      "[MOCK MAIL] link: http://localhost:3443/auth/verify?token=abc",
    );
    expect(written).toContain("[MOCK MAIL] body:");
    expect(written).toContain("[MOCK MAIL] END");

    write.mockRestore();
  });

  it("replaces newlines with \\n in the body line so the block stays single-line-parseable", () => {
    // The block is a stream of lines prefixed '[MOCK MAIL] '. A literal
    // newline inside body would break that contract — a downstream log
    // parser would see the '[MOCK MAIL] END' terminator mid-body.
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    sendMail({
      to: "a@b.com",
      subject: "s",
      body: "line one\nline two\nline three",
    });

    const written = write.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("[MOCK MAIL] body: line one\\nline two\\nline three");
    expect(written).not.toContain("line one\nline two"); // literal newlines gone

    write.mockRestore();
  });

  it("omits the link line entirely when no link was provided", () => {
    // Verification emails have a link; password-reminder-style emails
    // may not. The line is omitted rather than printed with an empty
    // value so grepping for '[MOCK MAIL] link:' only matches real links.
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    sendMail({ to: "a@b.com", subject: "no link", body: "hello" });

    const written = write.mock.calls.map((c) => c[0]).join("");
    expect(written).not.toContain("[MOCK MAIL] link:");
    write.mockRestore();
  });
});

describe("getRecentMail", () => {
  beforeEach(() => {
    _resetOutboxForTest();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  it("returns recorded mails newest first", () => {
    sendMail({ to: "first@x.com", subject: "first", body: "" });
    sendMail({ to: "second@x.com", subject: "second", body: "" });
    sendMail({ to: "third@x.com", subject: "third", body: "" });

    const recent = getRecentMail();
    expect(recent.map((m) => m.to)).toEqual([
      "third@x.com",
      "second@x.com",
      "first@x.com",
    ]);
  });

  it("caps the buffer at 50 entries, dropping oldest", () => {
    // The buffer is an in-memory ring; a test driver that spams
    // /api/signup shouldn't leak memory.
    for (let i = 0; i < 60; i++) {
      sendMail({ to: `u${i}@x.com`, subject: String(i), body: "" });
    }

    const recent = getRecentMail();
    expect(recent).toHaveLength(50);
    // oldest retained is index 10 (0..9 dropped); newest is 59
    expect(recent[0].to).toBe("u59@x.com");
    expect(recent[recent.length - 1].to).toBe("u10@x.com");
  });

  it("respects an explicit limit smaller than buffer size", () => {
    sendMail({ to: "a@x.com", subject: "a", body: "" });
    sendMail({ to: "b@x.com", subject: "b", body: "" });
    sendMail({ to: "c@x.com", subject: "c", body: "" });

    const recent = getRecentMail(2);
    expect(recent.map((m) => m.to)).toEqual(["c@x.com", "b@x.com"]);
  });

  it("records the subject, recipient, link and timestamp", () => {
    // The dev outbox route returns these fields as JSON so an E2E test
    // can pick up the verification link. This is the contract.
    const before = Date.now();
    sendMail({
      to: "x@y.com",
      subject: "sub",
      link: "https://example.com/verify?t=abc",
      body: "body",
    });
    const after = Date.now();

    const [only] = getRecentMail();
    expect(only.to).toBe("x@y.com");
    expect(only.subject).toBe("sub");
    expect(only.link).toBe("https://example.com/verify?t=abc");
    expect(only.sentAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(only.sentAt.getTime()).toBeLessThanOrEqual(after);
  });
});
