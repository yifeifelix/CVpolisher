# ADR-0004: Phase 1 authentication and signup decisions

- **Status**: Accepted
- **Date**: 2026-05-01
- **Deciders**: yifeifelix
- **Relates to**: [ADR-0001 §2](./0001-saas-architecture.md), [ADR-0002 Phase 1](./0002-mvp-implementation-plan.md)
- **Prompted by**: pre-TDD grill at the start of session 4, per the
  [Trap 13 rule in KIRO_BRANCH_SUMMARY §9](../../KIRO_BRANCH_SUMMARY.md) —
  implicit decisions in ADR-0001 §2 had to be made concrete before any
  NextAuth wiring code could be written.

## Context

ADR-0001 §2 fixed the shape of CVpolisher's account model at a high
level: email + password and Google OAuth as the two login paths,
NextAuth as the framework, bonus of 6 allocated on email verification.

Several decisions implicit in that description had to be made explicit
before writing `auth.ts`, the `credentials` provider, the `/api/signup`
route, or the mock mail transport:

1. Session strategy — JWT session vs database session
2. Password hash algorithm — bcrypt / scrypt / argon2
3. Mock mail transport — where does the verification email go during
   Phase 1 when Resend is deliberately deferred to Phase 4?
4. `/api/signup` pipeline order — which gate fires first, and what
   does each gate return to the client?
5. Where the password hash column lives — extend the NextAuth `user`
   table, or a separate `credentials` table?

These five decisions are small individually, but each has silent
security or maintainability consequences that get hard to reverse
once routes depend on them. This ADR records them at decision time.

## Decision

### 1. Session strategy — database session

NextAuth is configured to use **database sessions**, not JWT sessions.

When a user logs in, NextAuth writes a row into the `session` table
(already shipped in the initial Drizzle migration per commit
`08a9ee7`) and sets an `HttpOnly` `Secure` cookie holding the
`sessionToken`. On every authenticated request, NextAuth reads the
session row via `@auth/drizzle-adapter` and hydrates the user.

#### Why database session over JWT session

- **Revocation is immediate.** Banning an abusive user means deleting
  their session rows — there's no window where a leaked JWT is still
  valid until its `exp`. Given that the signup route is one of the
  most abuse-prone surfaces in the app (ADR-0001 §4), this matters.
- **The table already exists.** The NextAuth `session` table was
  included in the initial schema specifically to support this path.
  Switching to JWT would leave the table unused.
- **Per-request cost is negligible.** Every `/api/polish` call already
  hits SQLite multiple times (quota read, event insert); an extra
  indexed `SELECT` on `session` by primary key is single-digit
  milliseconds.
- **Secret rotation is safe.** Rotating the NextAuth `secret` does not
  invalidate every existing session simultaneously.

#### Consequence

The `session` callback in `auth.ts` has natural access to the full
`users` row (via `getSessionAndUser` on the adapter), so attaching
business state (`tier`, `super_tokens`, quota phase) to the session
object does not require an extra round-trip. This is why the adapter
contract was designed around database sessions in the first place.

### 2. Password hash — Node `crypto.scrypt` at OWASP-compliant parameters

The `credentials` provider hashes and verifies passwords using Node's
standard-library **scrypt** via `node:crypto`. No third-party hash
dependency is added.

#### Parameters (OWASP-compliant)

| Parameter | Value | Note |
|---|---|---|
| `N` (CPU/memory cost) | `131072` (`2^17`) | Memory cost ≈ 128 MiB |
| `r` (block size) | `8` | 1024-byte blocks |
| `p` (parallelism) | `1` | Single lane |
| `maxmem` | `268435456` (256 MiB) | Headroom over `N × r × 128` |
| Salt length | 16 bytes (random per user) | |
| Derived key length | 64 bytes | |

These are **the minimum parameters listed by** the [OWASP Password
Storage Cheat Sheet][owasp-pw] §scrypt (2024 revision): "use scrypt
with a minimum CPU/memory cost parameter of (2^17), a minimum block
size of 8 (1024 bytes), and a parallelization parameter of 1".

[owasp-pw]: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

**Measured cost on dev hardware** (Node 22.17, Apple M-series):
approximately **170 ms per hash**. OWASP's upper bound for login
responsiveness is 1 second; we sit well under it.

Note: Node's `crypto.scryptSync` *defaults* are `N=16384`, `r=8`,
`p=1` — **those defaults are not OWASP-compliant** (8× weaker than
the 2^17 minimum). The defaults are never used; all call sites pass
the options table above explicitly.

#### Hash format stored in DB

```
scrypt:N=131072,r=8,p=1:<16-byte-salt-hex>:<64-byte-hash-hex>
```

The algorithm name and its parameters are embedded in the stored
string. This is deliberate: when the OWASP minimum is raised (or
argon2id becomes easy to ship), the verifier can detect the old
format, accept the login, and trigger a **hot re-hash** at the new
parameters on the user's next successful login. No forced password
reset, no lockout, no schema migration.

#### Why scrypt over bcrypt / argon2id

- **OWASP ranks argon2id first, scrypt second, bcrypt legacy only.**
  argon2id would be the strongest choice in absolute terms. We pick
  scrypt because Node's standard library ships it and argon2id
  requires a native dependency (`argon2`), which we explicitly want
  to avoid (see below).
- **Zero new native dependencies.** `better-sqlite3` already adds a
  C++ toolchain requirement on fresh machines (README-documented).
  Adding `argon2` would compound that setup friction for new
  contributors. scrypt needs nothing installed.
- **Hot upgrade path.** When Phase 4 security review lands, the
  parameterised hash format above turns an algorithm upgrade into
  a 30-line verifier change, not a forced-reset event.

Bcrypt is explicitly rejected: OWASP now lists it as "for legacy
systems", its 72-byte password length cap is a footgun, and it is
not stronger than scrypt at the parameters we use.

### 3. Mock mail transport — stdout plus dev-only outbox route

Phase 1 does not integrate Resend (ADR-0002 Phase 4). Verification
emails are sent through a **mock mail transport** implemented in
two cooperating layers:

**Layer A — stdout (primary).** Every sent mail is printed to
`process.stdout` in a fixed machine-readable format:

```
[MOCK MAIL] to: <recipient>
[MOCK MAIL] subject: <subject>
[MOCK MAIL] link: <action-link if any>
[MOCK MAIL] body: <first 200 chars, newlines replaced with \\n>
[MOCK MAIL] END
```

`[MOCK MAIL] END` is a terminator so downstream log parsers can
recognise the end of a record. During manual dev, the developer
reads the terminal to find the verification link.

**Layer B — dev-only outbox route.** `GET /api/dev/outbox` returns a
JSON array of the last 50 mock mails sent since server start, kept
in an in-memory ring buffer. The route is gated by
`process.env.NODE_ENV !== "production"`; in production builds the
handler returns `404`, matching the non-existence of the route.

This is purely for E2E testing (Phase 2) — a test driver calls
`POST /api/signup`, then `GET /api/dev/outbox`, extracts the
verification link, and follows it. Without this route, Phase 2
tests would have to scrape stdout, which is fragile across process
managers.

#### Consequence

No new DB table for mail — the ring buffer is in-memory and lost on
restart. That is a feature, not a bug: nothing in the mail store is
valuable enough to survive a restart, and persisting it would create
a backup-management problem with zero benefit.

Also: this ADR **introduces the convention** that the `/api/dev/*`
namespace is reserved for dev-only introspection endpoints. Any
future dev-only route (e.g. `GET /api/dev/quota`) goes under it
with the same `NODE_ENV !== "production"` gate. Before this ADR no
such convention existed; it is new with ADR-0004.

### 4. `/api/signup` pipeline — fixed order, information-symmetric responses

The signup pipeline runs in this **exact** order. Each gate must
pass before the next one runs. The cost of the gate is monotonically
non-decreasing left-to-right: cheap rejections happen first so
expensive work (DB round-trips, hashing) is reserved for plausible
requests.

| # | Gate | Cost | On fail |
|---|---|---|---|
| 1 | Honeypot field check | nanoseconds | **200 OK + fake success** |
| 2 | IP rate limit | 1 DB read | 429 `Too Many Requests` |
| 3 | Email format + disposable domain blacklist | microseconds | 400 `Invalid email` |
| 4 | Email-domain rate limit | 1 DB read | 429 `Too Many Requests` |
| 5 | Email normalise + existing-account lookup | 1 DB read | **200 OK + fake success** |
| 6 | Password hash (scrypt) | ~50-100ms | n/a (always succeeds) |
| 7 | Transaction: insert `user` + insert `credentials` + emit `rate_limit_events` allowed row + enqueue mock mail | ~5ms | 500 (should not happen) |

#### Two semantic commitments

**(a) Email existence is never leaked.**

If the email is already registered (gate 5), the route returns
exactly the same response body and status code as a successful
signup: `200 OK {"ok": true}`. No verification email is sent (the
account is already registered), but from the client's perspective the
two cases are indistinguishable. The first registered owner of that
email must go via "forgot password" to recover.

This closes the classic account-enumeration vector. The tradeoff is
worse UX for legitimate users who typo or forget they already have
an account — they see "check your email" and wait for nothing. That
cost is accepted.

**(b) Honeypot failures return fake success.**

When the hidden `website` field is non-empty (a bot has filled it),
the route returns `200 OK {"ok": true}` without inserting anything,
without sending mail, and without emitting any `rate_limit_events`
row. The bot sees success and moves on. Returning `400` or `403`
would train bots to distinguish the hidden field.

#### Why honeypot is the first gate

It is effectively free (a single field presence check), it catches
the largest volume of abuse (form-spam bots), and catching it first
means bot traffic never touches the rate-limit tables. This keeps
the `rate_limit_events` table measuring *human-plausible* abuse, not
random bot noise.

### 5. Password hash lives in a separate `credentials` table

A new table `credentials` is added:

```
credentials
  user_id      TEXT PRIMARY KEY FK → user(id) ON DELETE CASCADE
  password_hash TEXT NOT NULL     -- format per §2 above
  created_at    INTEGER NOT NULL
  updated_at    INTEGER NOT NULL   -- touched on hot re-hash
```

Only users who registered via the credentials provider have a row
here. Google-OAuth-only users have no row, and the login path for
credentials is:

```
SELECT user.* , credentials.password_hash
FROM user
JOIN credentials ON credentials.user_id = user.id
WHERE user.email = ?
```

If no row is returned, the credentials login fails — whether the
user does not exist at all, or the user exists only via OAuth, the
response is identical (again closing enumeration).

#### Why a separate table, not a column on `user`

- **OAuth users don't have passwords.** A nullable `password_hash`
  on `user` would be NULL for every OAuth user — a schema lie about
  the domain. Separating the table makes "has a password" a
  structural truth, not a NULL check.
- **Future auth methods land here.** When passkeys / WebAuthn / 2FA
  land (not Phase 1), they are new tables or new columns on
  `credentials`. The `user` table stays NextAuth-managed and
  untouched.
- **Join cost is negligible.** Login is a low-throughput path; a
  single indexed join is unmeasurable against the hashing cost.

## Consequences

- `src/lib/db/schema.ts` gains a `credentialsTable` definition. A
  new migration (`0001_*.sql`) will be generated when this is added.
- `src/lib/auth/` is introduced to hold `auth.ts` (NextAuth config),
  `password.ts` (scrypt hash + verify), and `mail.ts` (mock
  transport + ring buffer).
- `src/app/api/dev/outbox/route.ts` is the dev-only mail viewer,
  NODE_ENV-gated.
- `src/app/api/signup/route.ts` implements the §4 pipeline, reusing
  the existing pure engines: `email/normalise`, `email/disposable`,
  `rate-limit/rate-limit`.
- `app_users_meta` row is created inside the post-verification
  webhook flow (next session), not at signup — consistent with
  ADR-0001 §2 "bonus allocated on email verification".
- The `session` callback in `auth.ts` hydrates `tier`,
  `super_tokens`, and the derived quota phase onto the session
  object. Components read these from `useSession()` without extra
  fetches.

No backwards-incompatible change to the NextAuth `user` / `session`
/ `account` / `verificationToken` tables.
