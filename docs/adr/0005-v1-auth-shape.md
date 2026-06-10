# ADR-0005: v1 auth shape — Google OAuth only, database session

- **Status**: Accepted (2026-06-10 — end-to-end Google sign-in
  verified manually per HANDOFF §E.3/§E.5: app_users_meta row minted
  with bonus 6, session hydrates business fields, sign-out/in stable)
- **Date**: 2026-05-08
- **Deciders**: yifeifelix
- **Relates to**: [ADR-0001 §2](./0001-saas-architecture.md),
  [ADR-0003 §4](./0003-super-token-pricing-model.md),
  [ADR-0004](./0004-phase-1-auth-decisions.md),
  [BRANCH_KIRO_STATUS.md](../BRANCH_KIRO_STATUS.md),
  [HANDOFF_V1_GOOGLE_OAUTH.md](../HANDOFF_V1_GOOGLE_OAUTH.md)
- **Prompted by**: HANDOFF §C pre-TDD grill — six decisions had to be
  pinned before writing `src/lib/auth/auth.ts`.

## Status block — v1 vs v2

| Section | v1 | v2 |
|---|---|---|
| §1 Provider: Google OAuth only | **Active** | Superseded — v2 adds Credentials |
| §2 Session strategy: `database` | **Active** | v2 re-decides (Credentials forces `jwt`) |
| §3 First-sign-in gate on `email_verified === true` | **Active** | Extended — signup verification pipeline returns |
| §4 Bonus allocation constant `SIGNUP_BONUS = 6` | **Active** | Unchanged |
| §5 `events.createUser` hook is idempotent, warning-only | **Active** | Unchanged (extended for signup path) |
| §6 Session augmentation: `tier`, `superTokens`, `quotaPhase`, `bonusRemaining` | **Active** | Unchanged |

## Context

This ADR is scoped to **v1 Google-OAuth-only launch**. It records the six
decisions that HANDOFF §C flagged as ambiguous before the first line of
`auth.ts` is written. Where a decision already had a canonical home
(ADR-0001, ADR-0003, ADR-0004), this ADR cites it and pins the v1
interpretation; where no prior decision existed, this ADR makes it.

## Decisions

### 1. Provider set — Google OAuth only

The v1 `providers` array holds exactly one provider: `Google`. No
Credentials, no magic-link, no Apple/GitHub. Rationale for the split
lives in [BRANCH_KIRO_STATUS.md](../BRANCH_KIRO_STATUS.md) and
[ADR-0004 status block](./0004-phase-1-auth-decisions.md).

NextAuth v5 auto-wires the provider from `AUTH_GOOGLE_ID` and
`AUTH_GOOGLE_SECRET` (ADR-0004 §6). Nothing else is passed in the
provider constructor.

### 2. Session strategy — `database`

`strategy: "database"` is preserved from [ADR-0004 §1](./0004-phase-1-auth-decisions.md#1-session-strategy--database-session).
The Credentials-forces-JWT constraint that paused `kiro` does **not**
apply to OAuth-only, so the original rationale (immediate revocation,
table already exists, per-request cost negligible) stands unchanged.

Consequence for the `session` callback: `session({ session, user })`
receives the full DB `user` row and can hydrate business state without
a second round trip (see §6 below).

### 3. First-sign-in gate — `profile.email_verified === true`

ADR-0001 §2 says "Email addresses must be verified before bonus credits
are issued; OAuth users are treated as pre-verified." v1 makes that
concrete by gating the `signIn` callback on Google's
`profile.email_verified` boolean.

```ts
async signIn({ account, profile }) {
  if (account?.provider === "google") {
    return profile?.email_verified === true
  }
  return true  // future providers default to allowed
}
```

#### What happens when `email_verified === false`

`signIn` returns `false`, NextAuth aborts the flow, and the browser is
redirected to the standard NextAuth error page (`/api/auth/error` with
`?error=AccessDenied`). No `user` row is created, no `events.createUser`
fires, no `app_users_meta` row, no bonus allocation.

This is rare — Google almost always sets `email_verified=true` for
Workspace + personal accounts — but the gate closes the edge case
where a federated identity surfaces an unverified address.

### 4. Bonus allocation — `SIGNUP_BONUS = 6`, canonical constant

**Source of truth**: [ADR-0001 §3](./0001-saas-architecture.md#3-quota-mechanism--token-bucket-with-bonus-phase)
("Registration: bonus = 6") and [ADR-0003 §4](./0003-super-token-pricing-model.md#4-tier-benefits-rebalanced--paid-gets-a-small-free-pool-perk-not-a-big-one)
(bonus row, "6 / 6 / same").

**Code location**: a new file `src/lib/quota/constants.ts` exports
`export const SIGNUP_BONUS = 6` with a JSDoc cross-link to the two
ADR citations above. Both the `events.createUser` hook and any future
signup path read this constant; no literal `6` appears in business
code.

**Tests**: `src/lib/quota/engine.test.ts` currently treats 6 as a
fixture value (not as a hardcoded contract — the engine is pure and
doesn't know the signup amount). Those tests do not need to import
`SIGNUP_BONUS` unless they begin asserting "a newly-signed-up user
gets N bonus", which is out of scope for the engine's pure-function
contract.

### 5. `events.createUser` — atomic insert + lazy recovery (defence in depth)

`events.createUser` is **not in the same DB transaction** as
`adapter.createUser`. The user row is committed before the hook
fires; if the hook then throws or the process crashes between the
two calls, we end up with a `user` row that has no `app_users_meta`
row. Subsequent sign-ins resurrect a session whose
`session` callback can't read tier / bonus / super_tokens — the
quota gate would see `undefined` business state and either crash or
silently treat the user as never-onboarded.

#### Decision: A + B (atomic insert + lazy recovery)

**A. Atomic insert in the hook** — replace select-then-insert with
SQLite's `INSERT OR IGNORE`. One statement, no TOCTOU window. The
default-row payload comes from the `buildInitialMeta(userId)` factory
defined below; never inline:

```ts
events: {
  async createUser({ user }) {
    if (!user.id) return
    await db
      .insert(appUsersMetaTable)
      .values(buildInitialMeta(user.id))
      .onConflictDoNothing({ target: appUsersMetaTable.userId })
  },
},
```

`onConflictDoNothing` translates to `INSERT ... ON CONFLICT DO NOTHING`
in Drizzle's SQLite dialect, equivalent to `INSERT OR IGNORE`. If the
hook fires twice for the same `user_id` (admin paths, dev DB resets,
adapter retries) the second call is a no-op rather than a
constraint-violation crash.

**B. Lazy recovery in the session callback** — the `session`
callback (§6) reads `app_users_meta` for the signed-in user. If the
row is missing (events hook crashed or never ran), the callback
performs the same `INSERT OR IGNORE` on the spot with the v1 defaults,
then re-reads. This adds one `SELECT` per authenticated request
unconditionally and one `INSERT` only on the recovery path. v1 is
not throughput-bound and the defence-in-depth is worth the cost.

```ts
async session({ session, user }) {
  let meta = await db
    .select()
    .from(appUsersMetaTable)
    .where(eq(appUsersMetaTable.userId, user.id))
    .get()

  if (!meta) {
    // Recovery path — events.createUser failed or never ran.
    console.warn(`[auth] app_users_meta missing for user ${user.id}, recovering`)
    await db
      .insert(appUsersMetaTable)
      .values(buildInitialMeta(user.id))
      .onConflictDoNothing({ target: appUsersMetaTable.userId })
    meta = await db
      .select()
      .from(appUsersMetaTable)
      .where(eq(appUsersMetaTable.userId, user.id))
      .get()
  }
  // ... continue with quota/phase derivation (§6)
}
```

#### Why both, not one or the other

- **A alone** (atomic insert, no recovery) — closes the TOCTOU race
  but leaves users stranded if the hook itself never runs (e.g. an
  uncaught exception bubbling out of a future addition to the hook).
  No path back without manual SQL.
- **B alone** (lazy recovery, no atomic insert) — the events hook
  becomes pure decoration. Every signed-in request pays the recovery
  branch cost on first hit. Worse, a select-then-insert race in the
  hook would still corrupt the row on rare double-fires.
- **A + B together** — events.createUser is the happy path (zero
  extra queries on subsequent sign-ins), session callback's recovery
  branch is the safety net for the cold-start failure mode. Each
  defends a different failure class.

#### Rejected alternatives

- **Wrap adapter.createUser + events.createUser in a manual
  transaction** — would require monkey-patching the adapter or
  swapping `DrizzleAdapter` for a custom one. High invasiveness, and
  any future adapter upgrade silently breaks the patch.
- **Accept partial-signup, document SQL repair** — explicitly
  rejected. v1 must let users sign in and out without operator
  intervention.

`bonus_remaining` defaults to 0 in the schema (see
[src/lib/db/schema.ts](../../src/lib/db/schema.ts)). The hook sets
the real value at insert time, and the recovery path uses the same
constant — both write through `SIGNUP_BONUS`, never the schema
default.

#### Single source of truth — `buildInitialMeta` factory

**Decision:** the default `app_users_meta` row payload is produced by
**one** factory function, `buildInitialMeta(userId: string): NewAppUsersMetaRow`,
exported from a dedicated module. **Both** call sites — the
`events.createUser` hook (path A) and the `session` callback's
recovery branch (path B) — invoke this factory. Inlining the default
object literal at either call site is forbidden.

- **File location**: `src/lib/quota/initial-meta.ts` (implementation
  lands in D.3 alongside `events.createUser` itself; this ADR
  specifies the contract, not the code).
- **Internals**: the factory imports `SIGNUP_BONUS` from
  `src/lib/quota/constants.ts` (§4) and references it by name —
  the literal `6` is **not** baked into the factory body. Every
  field the v1 default row carries (`tier: "free"`, `superTokens: 0`,
  `slidingTimerStartedAt: null`, etc.) lives in this factory and
  nowhere else.
- **Return type**: `NewAppUsersMetaRow`, derived from
  `typeof appUsersMetaTable.$inferInsert` (Drizzle's insert-row
  type) so future schema columns flow into the factory's signature
  automatically — adding a column with no default forces a TS error
  here, not silent drift between A and B.

**Why a factory, not just `SIGNUP_BONUS`**: `SIGNUP_BONUS` alone
covers the bonus value, but `tier` / `superTokens` /
`slidingTimerStartedAt` are still hardcoded twice in the previous
draft. When the v1 defaults change (e.g. a future ADR adds a
`signup_source` column or shifts the default tier flow), the edit
must be one file. A second hardcoded copy in the recovery branch
that nobody remembers to update is a latent bug we cannot detect
with `grep` once the values match by coincidence rather than by
construction.


`email_normalized` column on `user` for dedupe; [commit `08a9ee7`](../../src/lib/db/schema.ts#L41)
chose NOT to add it (NextAuth's default `user.email` is the sole email
column, with a `UNIQUE` constraint). v1 relies on Google's own
canonicalisation (email is lowercase, alias-stripped for Gmail by
Google before it reaches us) — the single identity source means we
don't need a second dedupe column. v2 will reconsider when Credentials
lands and `email_normalized` becomes necessary for signup dedupe
against existing OAuth users.

### 6. Session object shape — augmented with business state

After the `session` callback runs, `useSession().data?.user` exposes:

```ts
{
  // Stock NextAuth
  id: string
  email: string
  name?: string | null
  image?: string | null

  // v1 additions
  tier: "free" | "paid"
  superTokens: number
  bonusRemaining: number
  quotaPhase: "bonus" | "awaiting-refill" | "first-refill" | "steady"
}
```

Types are pinned via NextAuth v5 module augmentation in
`src/types/next-auth.d.ts`. The form is constrained by what the
installed `@auth/core@0.41.2` exposes:

- `node_modules/@auth/core/types.d.ts:204-210` defines
  `interface DefaultSession { user?: User; expires: ISODateString }`
  and `interface Session extends DefaultSession {}`.
- `node_modules/@auth/core/types.d.ts:218-223` defines
  `interface DefaultUser { id?, name?, email?, image? }` and
  `interface User extends DefaultUser {}`.
- `node_modules/next-auth/index.d.ts:78` re-exports `Session`,
  `DefaultSession`, `User` from `@auth/core/types`.

The augmentation file therefore extends both `Session.user` and
`User` so the additions are visible whether code reaches the value
via `session.user` (server callback) or via `useSession()` (client):

```ts
// src/types/next-auth.d.ts
import "next-auth"
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      tier: "free" | "paid"
      superTokens: number
      bonusRemaining: number
      quotaPhase: "bonus" | "awaiting-refill" | "first-refill" | "steady"
    } & DefaultSession["user"]
  }
}
```

Runtime shape is enforced only informally (the callback is the single
write site).

**`quotaPhase`** is derived by a new pure function
`derivePhase(state, now)` added to the quota engine. Inputs are the
same `QuotaState` the existing `canConsume` consumes; the four phases
are defined in
[CONTEXT.md §Quota lifecycle](../CONTEXT.md#quota-lifecycle). The
derivation rules, restated for unambiguous implementation:

| Phase | Condition |
|---|---|
| `bonus` | `bonusRemaining > 0` |
| `awaiting-refill` | `bonusRemaining === 0` **and** `slidingTimerStartedAt !== null` **and** `now < slidingTimerStartedAt + 5h` |
| `first-refill` | `bonusRemaining === 0` **and** `slidingTimerStartedAt !== null` **and** `now >= slidingTimerStartedAt + 5h` |
| `steady` | `bonusRemaining === 0` **and** `slidingTimerStartedAt === null` |

Tests cover the phase boundaries (≥4 cases).

### 7a. `trustHost` — do not pass; let env auto-detect

`@auth/core/lib/utils/env.js:40-44` defaults `trustHost` to
`!!(AUTH_URL ?? AUTH_TRUST_HOST ?? VERCEL ?? CF_PAGES ?? NODE_ENV !== "production")`.
In dev `NODE_ENV !== "production"` makes this `true` automatically;
in production we set `AUTH_TRUST_HOST=true` explicitly when behind a
reverse proxy (Caddy / nginx / Cloudflare Tunnel; ADR-0004 §6).

**Decision: omit `trustHost` from the `NextAuth({...})` config
object entirely.** Writing
`trustHost: process.env.AUTH_TRUST_HOST === "true"` would clobber
the env-aware default with a hard `false` whenever the variable is
unset (i.e. dev's normal state) and silently reintroduce
"UntrustedHost" errors. The previous draft of this ADR carried
that explicit assignment — withdrawn.

`.env.local` keeps `AUTH_TRUST_HOST` commented (current state) so
dev gets the auto-detect path; production deployment sets it to
`true`.

### 7. API gate behaviour — 401 at handler, never redirect

Unauthenticated `POST /api/polish` (and sibling routes) return
**`401` with `{ error: "unauthorised" }`** and no side effects. The
route does not redirect — the UI is responsible for bouncing the
unauthenticated user to `/login`. This keeps API behaviour programmatic
(CLI + test-driver-friendly) and separates concerns.

The gate is implemented at the handler level (top of the POST
function), not in proxy/middleware. Next.js 16 renames `middleware.ts`
to `proxy.ts`; moving the gate there is a Phase 3+ optimisation, not
v1 work.

Routes receiving this gate in v1:
- `src/app/api/polish/route.ts`
- `src/app/api/cover-letter/route.ts`
- `src/app/api/download/route.ts`

## Consequences

- **New file**: `src/lib/auth/auth.ts` (NextAuth wiring).
- **New file**: `src/app/api/auth/[...nextauth]/route.ts` (handlers).
- **New file**: `src/types/next-auth.d.ts` (module augmentation).
- **New file**: `src/lib/quota/constants.ts` (`SIGNUP_BONUS`).
- **New file**: `src/lib/quota/initial-meta.ts` (`buildInitialMeta`
  factory, single source of truth for the default `app_users_meta`
  row — §5).
- **Change**: `src/lib/quota/engine.ts` gains `derivePhase`.
- **Change**: three API routes add `auth()` gate.
- **New UI**: `src/app/login/page.tsx` (single button) +
  `src/components/session-indicator.tsx` + `SessionProvider` in layout.
- **Zero schema change** — v1 uses the kiro schema as-is.

## Known cost — session-callback query budget

Each authenticated request pays:

1. `adapter.getSessionAndUser` — one `SELECT ... JOIN` on
   `session` + `user` (built into the adapter, runs before our
   callback fires;
   `node_modules/@auth/drizzle-adapter/lib/sqlite.js:110-119`).
2. `app_users_meta` `SELECT` — our callback's first query.
3. `quota_events` `SELECT` over the last 5h — for the
   `quotaPhase` derivation input.

→ **3 queries per authenticated request** in steady state. Cold-start
recovery (§5 path B) adds one `INSERT OR IGNORE` and one `SELECT`
on a single request per stranded user, then never again.

v1 traffic does not justify optimising this. If a future load
profile makes it worth caching, the path is to denormalise
`tier` / `super_tokens` / `bonus_remaining` onto the `session`
row at sign-in (or refresh on payment / quota mutation) and use
NextAuth's `unstable_update` to mutate the session in place
(`node_modules/next-auth/index.d.ts:293`). Not implemented in v1.

## v1 known limitations

- **`email_verified === false` UX.** §3 returns `false` from
  `signIn`, which lands the user on NextAuth's default
  `/api/auth/error?error=AccessDenied` page. The message is
  generic ("There is a problem with the server configuration").
  v1 accepts this — Google rarely returns `email_verified=false`
  for real users. v2 ships a custom error page that explains
  "your Google email is not verified by Google itself" before
  Credentials lands.
- **3 queries per authed request** — see "Known cost" above.
  Acceptable for v1 launch traffic; revisit at Phase 4 when
  payment volume warrants it.
- **`@/lib/db` module resolution ambiguity.** With
  `moduleResolution: "bundler"` in `tsconfig.json`, legacy
  `src/lib/db.ts` (@deprecated, see commit `636a97a`) is resolved
  in preference to the Drizzle client at `src/lib/db/index.ts`.
  SaaS-layer code wanting the Drizzle client must import explicitly
  as `@/lib/db/index` (see `src/lib/auth/auth.ts`). The three
  legacy API routes (polish / cover-letter / download) continue to
  import `@/lib/db` — this is intentional; they are legacy storage
  consumers and will be migrated when Phase 4 unifies the storage
  layer. D.6 adds the `auth()` gate to those routes **without
  touching their db imports**.

## v2 considerations

- **`email_normalized` column.** v1 omits this because Google is
  the only identity source and Google canonicalises email itself
  (lowercase, Gmail dot/alias stripping). v2 adds Credentials,
  whose user-supplied email must be passed through the existing
  `src/lib/email/normalise.ts` and matched against any existing
  Google-OAuth user's normalised email **before** allowing signup
  — otherwise the same human gets two accounts (one Google, one
  Credentials), with split quota and split super tokens. The v2
  ADR (forthcoming) must add a migration that backfills
  `email_normalized` for all existing v1 users at the same time
  it introduces the column.
- **Custom `/api/auth/error` page** — see "Known limitations"
  above.
- **Session denormalisation for cost** — see "Known cost" above.

## Out of scope (v1)

- Credentials provider wiring, `/api/signup`, honeypot / IP
  rate-limit / disposable-domain pipeline
- Email verification UI (Google pre-verifies)
- Password reset
- Multi-account linking (v2 concern)
- Logout confirmation modals, profile page
