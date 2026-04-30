import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

// These tests drive the behaviour contract pinned by ADR-0004 §2.
// They treat the stored hash string as an opaque token shaped by the
// documented format; they don't reach into scrypt internals.

describe("hashPassword", () => {
  it("produces the ADR-0004 §2 string format with N=131072, r=8, p=1", async () => {
    // Format: scrypt:N=<n>,r=<r>,p=<p>:<16-byte-salt-hex>:<64-byte-key-hex>
    // Salt is 16 bytes = 32 hex chars. Key is 64 bytes = 128 hex chars.
    const stored = await hashPassword("correct horse battery staple");

    expect(stored).toMatch(
      /^scrypt:N=131072,r=8,p=1:[0-9a-f]{32}:[0-9a-f]{128}$/,
    );
  });

  it("produces a different hash each call for the same password", async () => {
    // Different salts ⇒ different outputs. If this ever fails, someone
    // hard-coded the salt — a catastrophic regression that lets
    // rainbow tables work against the whole user base.
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");

    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("returns valid=true, needsRehash=false for a correct password at current params", async () => {
    const stored = await hashPassword("s3cret!");

    const result = await verifyPassword("s3cret!", stored);

    expect(result).toEqual({ valid: true, needsRehash: false });
  });

  it("returns valid=false for an incorrect password", async () => {
    const stored = await hashPassword("real");

    const result = await verifyPassword("wrong", stored);

    expect(result).toEqual({ valid: false });
  });

  it("returns valid=true, needsRehash=true when the stored params are below current", async () => {
    // Simulate a legacy hash produced at the Node default params
    // (N=16384, r=8, p=1) — OWASP 8× below the current minimum, but
    // historically valid. A matching password must still authenticate,
    // and the caller is signalled to re-hash at current params.
    // Built by hand so the test doesn't depend on the module accepting
    // legacy-params input.
    const crypto = await import("node:crypto");
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync("legacy-secret", salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    const legacyStored = `scrypt:N=16384,r=8,p=1:${salt.toString("hex")}:${key.toString(
      "hex",
    )}`;

    const result = await verifyPassword("legacy-secret", legacyStored);

    expect(result).toEqual({ valid: true, needsRehash: true });
  });

  it("returns valid=false for a malformed stored value rather than throwing", async () => {
    // Any corruption — truncation, wrong algorithm tag, wrong hex
    // length, missing parameter — must fail shut. A throw here would
    // leak an error into the signup/login response path.
    const garbage = "definitely-not-a-hash";

    const result = await verifyPassword("anything", garbage);

    expect(result).toEqual({ valid: false });
  });

  it("returns valid=false for an unknown algorithm tag rather than throwing", async () => {
    // Future-proofing: if someone writes 'argon2id:...' into the
    // column before this module has learnt the tag, we refuse rather
    // than silently interpret it as scrypt.
    const future = "argon2id:m=19456,t=2,p=1:abcd:1234";

    const result = await verifyPassword("anything", future);

    expect(result).toEqual({ valid: false });
  });
});
