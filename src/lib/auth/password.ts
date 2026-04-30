/**
 * Password hashing and verification using Node's standard-library
 * scrypt. Parameters and storage format are pinned by ADR-0004 §2.
 *
 * Storage format:
 *
 *   scrypt:N=<n>,r=<r>,p=<p>:<16-byte-salt-hex>:<64-byte-key-hex>
 *
 * Parameters:
 *
 *   N = 131072 (2^17)   — OWASP 2024 minimum CPU/memory cost for scrypt
 *   r = 8               — block size (1024 bytes)
 *   p = 1               — parallelisation
 *   salt length = 16    — random per-user
 *   key length = 64     — derived key
 *
 * Callers use only `hashPassword` and `verifyPassword`. `verifyPassword`
 * accepts legacy parameter sets (useful during hot parameter upgrades)
 * and signals `needsRehash: true` when the stored params are weaker
 * than the current target. The login path is expected to re-hash on
 * the next successful verify — no forced password reset.
 *
 * Never throws on malformed input. A corrupt stored value returns
 * `{ valid: false }` so error paths don't leak into HTTP responses.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// --- Current parameters --------------------------------------------------
//
// Update `CURRENT_N` / `CURRENT_R` / `CURRENT_P` when the OWASP minimum
// rises or the dev-hardware budget changes. Existing users' hashes are
// transparently upgraded on their next successful login via the
// `needsRehash` signal.

const CURRENT_N = 131072; // 2^17
const CURRENT_R = 8;
const CURRENT_P = 1;

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const SCRYPT_MAXMEM = 256 * 1024 * 1024; // 256 MiB — headroom over N × r × 128

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(plain, salt, KEY_BYTES, {
    N: CURRENT_N,
    r: CURRENT_R,
    p: CURRENT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return formatStored(CURRENT_N, CURRENT_R, CURRENT_P, salt, key);
}

export interface VerifyResult {
  valid: boolean;
  /** Present only when `valid === true`. Instructs the caller to
   *  re-hash and persist at current parameters. */
  needsRehash?: boolean;
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<VerifyResult> {
  const parsed = parseStored(stored);
  if (!parsed) return { valid: false };

  const { n, r, p, salt, key } = parsed;

  let candidate: Buffer;
  try {
    candidate = await scrypt(plain, salt, key.length, {
      N: n,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {
    // scrypt rejects wildly-out-of-range params (e.g. non-power-of-2
    // N). Treat as invalid rather than letting the error escape.
    return { valid: false };
  }

  if (candidate.length !== key.length) return { valid: false };
  if (!timingSafeEqual(candidate, key)) return { valid: false };

  const needsRehash =
    n !== CURRENT_N || r !== CURRENT_R || p !== CURRENT_P;
  return { valid: true, needsRehash };
}

// --- Internal helpers ----------------------------------------------------

function formatStored(
  n: number,
  r: number,
  p: number,
  salt: Buffer,
  key: Buffer,
): string {
  return `scrypt:N=${n},r=${r},p=${p}:${salt.toString("hex")}:${key.toString("hex")}`;
}

interface ParsedHash {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

function parseStored(stored: string): ParsedHash | null {
  // Expected shape: "scrypt:N=<n>,r=<r>,p=<p>:<salt-hex>:<key-hex>"
  // Unknown algorithm tags, missing fields, and non-hex values all
  // return null.
  const parts = stored.split(":");
  if (parts.length !== 4) return null;

  const [algo, params, saltHex, keyHex] = parts;
  if (algo !== "scrypt") return null;

  const paramMatch = params.match(/^N=(\d+),r=(\d+),p=(\d+)$/);
  if (!paramMatch) return null;

  const n = Number(paramMatch[1]);
  const r = Number(paramMatch[2]);
  const p = Number(paramMatch[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return null;
  }
  if (n < 2 || r < 1 || p < 1) return null;

  if (!/^[0-9a-f]+$/.test(saltHex) || saltHex.length % 2 !== 0) return null;
  if (!/^[0-9a-f]+$/.test(keyHex) || keyHex.length % 2 !== 0) return null;

  return {
    n,
    r,
    p,
    salt: Buffer.from(saltHex, "hex"),
    key: Buffer.from(keyHex, "hex"),
  };
}
