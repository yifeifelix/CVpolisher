# HANDOFF — v1 Google OAuth branch

> Read this document in full before writing code. The point of the
> handoff is that `git checkout` + this file + running through the
> checklist is enough to start. No other conversation should be
> required.

## TL;DR for the impatient

1. `git fetch origin && git checkout origin/kiro -b v1-google-oauth`
2. Read [`BRANCH_KIRO_STATUS.md`](BRANCH_KIRO_STATUS.md) for context
3. Read [ADR-0004](adr/0004-phase-1-auth-decisions.md) §2, §3, §6
   (ignore §1, §4, §5 — those are v2-only, see status block at top)
4. Follow §A "Pre-flight" then §B "Commit sequence" below.
5. Stop and grill (§C) before writing `auth.ts`.

The rest of this file exists so that when something breaks or the
checklist is ambiguous, the reasoning is on hand.

---

## §0. Scope — what v1 is and is not

**v1 ships:** Google OAuth sign-in, session hydration with
`tier` / `super_tokens` / quota phase, bonus allocation on first
sign-in (Google `email_verified === true`), NextAuth v5 database
session strategy, polish & export gated on signed-in session.

**v1 does not ship:** email + password login, signup route, the
mock mail transport's use in a verification flow, the
`credentials` table, the honeypot / IP rate-limit / disposable-
domain pipeline, human-readable pricing page UI beyond "log in to
polish".

If a feature is not on the first list, default to **not shipping
it** in v1. When in doubt, put the code on `kiro` for v2 and keep
v1 minimal.

---

## §A. Pre-flight

### A.1 Branch

From the `kiro` branch's remote tip:

```bash
git fetch origin
git checkout origin/kiro -b v1-google-oauth
```

The branch name is deliberate — `v1-google-oauth` makes the
intent immediately obvious in `git branch -v` and in any future
merge-base dialogue. Do not rename to `main`/`mainline` yet; that
happens only when v1 is shipped and the project is ready for the
current `main` to be archived.

### A.2 Read before coding

Required reads, in this order:

1. `docs/BRANCH_KIRO_STATUS.md` — why kiro paused and what's
   inherited.
2. `docs/adr/0004-phase-1-auth-decisions.md` §2 (password hashing
   — skim, not active in v1 but will become active in v2), §3
   (mock mail transport — scaffolding exists on disk, unused in
   v1 but ready for polish-complete notifications), §6 (env
   variables — `AUTH_SECRET` / `AUTH_TRUST_HOST` / `AUTH_GOOGLE_*`
   all apply here).
3. `docs/adr/0001-saas-architecture.md` §2 (account model), §4
   (abuse defence — v1 leans on Google's identity verification,
   so most of §4 is deferred to v2 when Credentials comes back).
4. `docs/CONTEXT.md` §Account model, §Super token, §Quota
   lifecycle — domain glossary.

Skim, don't memorise. The ADRs are indexed well enough to jump
back when a decision feels arbitrary.

### A.3 Google Cloud Console — OAuth client

This is the only non-code, human-only task. Do it now; leaving it
for mid-coding blocks a verify step.

1. Open `https://console.cloud.google.com/apis/credentials`.
2. If no project exists, create one ("CVpolisher dev" is fine;
   separate projects for dev and prod are recommended but a
   single OAuth client with both redirect URIs works for MVP).
3. APIs & Services → OAuth consent screen. Configure as **External**
   in testing mode (limits to specified test emails until published
   — fine for v1). Scope: `openid`, `email`, `profile`.
4. Credentials → Create Credentials → OAuth client ID → Web
   application.
5. Authorised redirect URIs (add both):
   - `http://localhost:3443/api/auth/callback/google`  (local dev)
   - `https://<prod-host>/api/auth/callback/google`  (fill in
     when prod host is known — Phase 3; leave dev-only until then)
6. Save. Copy the **Client ID** and **Client secret** shown in the
   dialog — these only display once in full, so paste them into
   `.env.local` immediately.

**Which console UI screens look like in 2026 has drifted before
and will drift again.** If the steps above don't match the page
you're looking at, the intent to hold onto is "create an OAuth 2.0
Web application client with `/api/auth/callback/google` as a
redirect URI".

### A.4 Local environment

Copy the example:

```bash
cp .env.local.example .env.local
```

Fill these four values in `.env.local`:

| Key | How to get it |
|---|---|
| `AUTH_SECRET` | `npm exec auth secret` (writes it for you), or `openssl rand -base64 33` |
| `AUTH_GOOGLE_ID` | From the OAuth client in §A.3 |
| `AUTH_GOOGLE_SECRET` | From the OAuth client in §A.3 |
| (At least one LLM provider block) | Your existing Bedrock / OpenRouter / Vertex credentials |

Leave `AUTH_TRUST_HOST` commented — dev runs directly, not behind
a proxy.

### A.5 Sanity check — baseline still green

```bash
npm install       # pulls the tree from kiro's package-lock
npm test          # should report 42 passed
npx tsc --noEmit  # should be clean
```

If any of the three fails before you've written a line of v1
code, **stop and diagnose**. The baseline is inherited clean; a
break here indicates an environment problem, not a v1 decision.

---

## §B. Commit sequence (outline — detailed after §C grill)

The full commit-by-commit plan is in §D below. Headline:

1. Status block in ADR-0004 + ADR-0001 §2 annotation → v1 auth
   scope pinned
2. `src/lib/auth/auth.ts` + `src/app/api/auth/[...nextauth]/route.ts`
   skeleton (no bonus hook yet) → dev server boots, Sign-In works
3. `events.createUser` hook to create `app_users_meta` row and
   allocate bonus → first-sign-in attaches business state
4. `session` callback hydrates `tier` / `super_tokens` / quota
   phase → `useSession()` sees business truth
5. Minimal login page + sign-out button → UI exists
6. Gate `/api/polish` and the polish result UI on session →
   anonymous users bounce to login
7. README refresh for the v1 auth flow

Step 2 is the first place the dev server runs. Step 3 is the first
place the new DB tables get rows. Step 6 is the first place v1's
"is this user allowed to do X" story lands.

---

## §C. Pre-TDD grill (do before writing `auth.ts`)

Per Trap 13 + Trap 15, grill first against both the user's intent
**and** the library's reality. Expected answers in brackets — if
any answer has shifted since this handoff was written, write the
new answer into an ADR before coding.

1. **First-sign-in bonus — exactly what counts as "first"?**
   ADR-0001 §2 says "bonus allocated on email verification". v1
   redefines this as "`events.createUser` fires + Google returns
   `profile.email_verified === true`". What happens if
   `email_verified` is `false`? [Expected: `signIn` callback
   returns `false`, login fails, user sees standard NextAuth
   error.]

2. **Bonus amount.** CONTEXT.md says 6. Still 6? [Expected: yes,
   unchanged.] Where is it a const? [Expected: ADR-0001 §13 has
   the canonical value; define a single named constant in
   `src/lib/quota/constants.ts` so the engine and the auth
   hook don't drift.]

3. **Email normalisation + uniqueness.** ADR-0001 §6 added
   `email_normalized TEXT UNIQUE` to the users table *in the
   original plan* but the actual schema (commit `08a9ee7`) did
   **not** add that column — it kept NextAuth's default `user`
   table untouched. Re-verify: does the `user` table have an
   `email_normalized` column today? [Check
   `src/lib/db/schema.ts`.] If no, v1 dedupes only on raw
   `email` (Google-provided, already lowercase + canonicalised by
   Google). Is that sufficient for v1's abuse surface? [Expected:
   yes, because Google is the only identity source and Google's
   own dedupe rules apply; `email_normalized` becomes relevant
   when Credentials arrives in v2.]

4. **Does every authenticated user get an `app_users_meta` row?**
   What about users created via NextAuth's admin flows or
   migrations before the `events.createUser` hook existed?
   [Expected: write the hook defensively — check if a row exists,
   insert only if not. The hook runs inside NextAuth's create-user
   path, so it's idempotent enough for v1. Log a warning if the
   row already exists.]

5. **Session object shape.** What exactly does
   `useSession().data?.user` expose after the `session` callback?
   [Expected: stock NextAuth `User` (id / name / email / image)
   plus our additions: `tier: "free" | "paid"`,
   `superTokens: number`, `quotaPhase: "bonus" | "awaiting-refill"
   | "first-refill" | "steady"`, `bonusRemaining: number`. Pin
   this in TypeScript via module augmentation — see the NextAuth
   TypeScript docs under "module augmentation".]

6. **Polish gate — what does an unauthenticated `/api/polish`
   call return?** [Expected: 401 with `{ error: "unauthorised" }`,
   no side effects, not redirected. The UI is responsible for
   bouncing the user to login; the API just rejects.] When does
   the gate check happen — start of the handler, or in a
   middleware/proxy? [Expected: handler level for v1. Next.js 16
   renamed `middleware.ts` to `proxy.ts` — that's a Phase 3+
   optimisation, not v1 work.]

Answer each before writing `auth.ts`. If any answer requires a new
decision, that decision needs an ADR (probably ADR-0005 once the
handoff's §D commit sequence creates it).

---

(§D commit-sequence detail, §E verification-per-step, and §F rebase
protocol continue in the second half of this handoff — see bottom.)

## §D. Commit sequence (detailed)

Every step below is one commit. Follow the order strictly — each
step's verification in §E is what tells you it's safe to move on.

### D.1 — `chore(deps): install zod for NextAuth session type augmentation`

Why this is first: the `session` callback (step D.3) expects
business state on the session object. Type-safe access from
components requires TypeScript module augmentation, and the
cleanest way to do that is a Zod schema we can share between the
callback and any future place that needs the shape (e.g. Phase 2
E2E tests).

```bash
npm view zod version     # verify before install (Trap 14)
npm install zod@<exact-pinned-version>
```

No code yet. Just the install. Tests still 42.

### D.2 — `feat(auth): ADR-0005 + NextAuth skeleton (providers, adapter, session strategy)`

Create `docs/adr/0005-v1-auth-shape.md` with the four big
decisions this branch is making:

1. v1 supports Google OAuth only; see `BRANCH_KIRO_STATUS.md` for
   the v2 deferral.
2. Session strategy = `database`. (Unlike ADR-0004 §1, which was
   blocked by the Credentials provider, OAuth has no such
   conflict — confirmed in authjs.dev Google provider docs.)
3. Bonus allocation happens inside NextAuth's `events.createUser`
   hook with a `signIn` callback gate on
   `profile.email_verified === true`.
4. Session object is augmented with `tier`, `superTokens`,
   `quotaPhase`, `bonusRemaining`.

Then create the module files:

- `src/lib/auth/auth.ts` — the NextAuth v5 wiring:
  ```ts
  import NextAuth from "next-auth"
  import Google from "next-auth/providers/google"
  import { DrizzleAdapter } from "@auth/drizzle-adapter"
  import { db } from "@/lib/db"
  import { usersTable, accountsTable, sessionsTable, verificationTokensTable } from "@/lib/db/schema"

  export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: DrizzleAdapter(db, {
      usersTable, accountsTable, sessionsTable, verificationTokensTable,
    }),
    providers: [Google],                     // env auto-wire via AUTH_GOOGLE_*
    session: { strategy: "database" },
    trustHost: process.env.AUTH_TRUST_HOST === "true",
    // callbacks and events come in D.3 + D.4
  })
  ```

- `src/app/api/auth/[...nextauth]/route.ts`:
  ```ts
  import { handlers } from "@/lib/auth/auth"
  export const { GET, POST } = handlers
  ```

- `src/types/next-auth.d.ts` — type augmentation stub (fill in
  fields in D.4). For now, declare the shape so future callbacks
  type-check:
  ```ts
  import "next-auth"
  declare module "next-auth" {
    interface Session {
      user: {
        id: string
        email: string
        name?: string | null
        image?: string | null
        // D.4 adds: tier, superTokens, quotaPhase, bonusRemaining
      }
    }
  }
  ```

Commit touches: the ADR, `auth.ts`, route, types file. No test
file yet — the value is observable only via dev server (§E).

### D.3 — `feat(auth): allocate app_users_meta + bonus on first sign-in`

Add to `auth.ts`:

```ts
callbacks: {
  async signIn({ account, profile }) {
    if (account?.provider === "google") {
      return profile?.email_verified === true
    }
    return true
  },
},
events: {
  async createUser({ user }) {
    if (!user.id) return
    // Idempotent: guard against a pre-existing row
    const existing = await db
      .select({ userId: appUsersMetaTable.userId })
      .from(appUsersMetaTable)
      .where(eq(appUsersMetaTable.userId, user.id))
      .limit(1)
      .get()
    if (existing) {
      console.warn(`[auth] app_users_meta already exists for user ${user.id}`)
      return
    }
    await db.insert(appUsersMetaTable).values({
      userId: user.id,
      tier: "free",
      bonusRemaining: SIGNUP_BONUS,   // from src/lib/quota/constants.ts
      superTokens: 0,
      slidingTimerStartedAt: null,
    })
  },
},
```

Create `src/lib/quota/constants.ts` exporting `SIGNUP_BONUS = 6`
with a JSDoc referencing ADR-0001 §13 as source-of-truth. The
quota engine must also consume this constant — go over
`src/lib/quota/engine.ts` tests and replace any hardcoded `6`
with `SIGNUP_BONUS` if it matters for the test's intent. (If the
test literally asserts the number 6 as a contract, keep the
literal in the test file but wire the engine itself to read the
constant.)

Unit tests: the hook is a side-effect-only callback; integration-
testing it cleanly requires an in-memory SQLite fixture which
we've deferred (see BRANCH_KIRO_STATUS §"Code modules" —
loaders/fixtures belong in a later session). For v1, the
observable is at §E.3 — log output during a real sign-in.

### D.4 — `feat(auth): hydrate tier / superTokens / quotaPhase on session`

Complete the `session` callback and the type augmentation.
`session({ session, user })` receives the full DB user row
thanks to `strategy: "database"`. Fetch the `app_users_meta`
row + the last 5h of `quota_events` for this user, derive the
quota phase via the existing pure engine, and merge the values
onto the session:

```ts
async session({ session, user }) {
  const meta = await db
    .select()
    .from(appUsersMetaTable)
    .where(eq(appUsersMetaTable.userId, user.id))
    .limit(1)
    .get()

  const recentEvents = await db
    .select({ createdAt: quotaEventsTable.createdAt })
    .from(quotaEventsTable)
    .where(
      and(
        eq(quotaEventsTable.userId, user.id),
        gt(quotaEventsTable.createdAt, fiveHoursAgoMs()),
      ),
    )

  const state: QuotaState = {
    tier: meta.tier,
    bonusRemaining: meta.bonusRemaining,
    slidingTimerStartedAt: meta.slidingTimerStartedAt,
    recentFreepoolEvents: recentEvents.map((e) => e.createdAt),
    todayFreepoolCount: /* count since local midnight */,
    superTokens: meta.superTokens,
  }

  session.user.id = user.id
  session.user.tier = meta.tier
  session.user.superTokens = meta.superTokens
  session.user.bonusRemaining = meta.bonusRemaining
  session.user.quotaPhase = derivePhase(state, new Date())
  return session
},
```

Extend `src/types/next-auth.d.ts` with the four new fields.
`derivePhase` is a new pure function on the quota engine — if it
doesn't exist, add it with its own 4-5 descriptive tests (Trap 8:
mark them descriptive, driven by the ADR-0001 phase definitions).

Commit adds logic + tests. Total suite should be 42 + N where N
is the new quota-phase tests (~4).

### D.5 — `feat(ui): minimal login page + header sign-out`

Two UI files, no business logic:

- `src/app/login/page.tsx` — server component, form `action`
  calls the imported `signIn("google")` from `@/lib/auth/auth`.
  Visual: one button, one line of text explaining "v1 is Google
  sign-in only".
- `src/components/session-indicator.tsx` — client component;
  uses `useSession()` and shows `session.user.email` plus a
  sign-out button. Mount in the existing header somewhere
  unobtrusive.

Cover the existing pages via `<SessionProvider>` in the root
layout — add it. No tests; this is pure UI wiring. Observable at
§E.5.

### D.6 — `feat(api): gate /api/polish on authenticated session`

In `src/app/api/polish/route.ts`:

```ts
import { auth } from "@/lib/auth/auth"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 })
  }
  // ... existing logic, but keyed on session.user.id going
  // forward, not the legacy session-id-based model.
}
```

At this commit, `/api/polish` is still running against the legacy
`src/lib/db.ts` (LAN-tool code). **Don't rewrite it to the new
schema in v1** unless the UX demands it. The polish result in v1
may stay in-memory React state on the client (simpler than
reviving `/result/[id]`). Hold strong YAGNI here; v1 aims to
prove the auth + quota loop, not rebuild the polish result store.

Update `src/app/api/cover-letter/route.ts` and
`src/app/api/download/route.ts` the same way — each gets one
`await auth()` guard at the top.

### D.7 — `docs(readme): v1 auth quick-start and Google OAuth setup`

README top gets a short "Authentication (v1)" section:

- Point to Google Cloud Console steps (linking to §A.3 of this
  handoff isn't ideal since the handoff is branch-internal;
  either quote the 6 steps, or link to authjs.dev/getting-
  started/providers/google).
- Note that `AUTH_SECRET` + `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`
  must be set in `.env.local` before `npm run dev`.
- Add a one-line "v2 adds email+password; see
  `docs/BRANCH_KIRO_STATUS.md` for the deferral rationale".

No code. Commit closes the v1 minimum-viable loop.

---

## §E. Verification per commit

For each commit above, here's what proves it landed correctly. If
the check fails, stop — don't move to the next commit.

### E.1 after D.1
```bash
npm test                              # 42 passed
npx tsc --noEmit                      # clean
node -e 'require("zod")' && echo OK   # zod loads
```

### E.2 after D.2
```bash
npm run dev                           # no startup error
```
Open `http://localhost:3443/api/auth/signin`. Should render
NextAuth's default sign-in page with a "Sign in with Google"
button. Clicking it should redirect to Google, then (if consent
OK) back to localhost and into a 500 / error — that's expected
because D.2 doesn't have `events.createUser` yet, so the adapter
tries to insert a user row and the flow succeeds only *partially*.
What you are looking for at E.2: **Google redirects back to the
app at all** — that proves the callback URL is configured right.

### E.3 after D.3
```bash
npm run dev
```
Sign in with Google end-to-end. Should land on `/` signed in.
Then:
```bash
sqlite3 data/cvpolisher.db 'SELECT user_id, tier, bonus_remaining, super_tokens FROM app_users_meta'
```
Should show one row with `tier=free`, `bonus_remaining=6`,
`super_tokens=0`. Sign out, sign in again — the row count stays
1 (idempotency). Stdout should show no warning on first sign-in,
possibly a `[auth] app_users_meta already exists` on repeat
sign-ins (only if the `createUser` event fires again; normally it
doesn't).

### E.4 after D.4
```bash
npm test
```
New quota-phase tests pass.

In a dev session, signed-in. Open devtools → Network →
`/api/auth/session` response JSON. `user` object must contain the
four new keys `tier`, `superTokens`, `bonusRemaining`,
`quotaPhase`. `quotaPhase === "bonus"` for a fresh account.

### E.5 after D.5
- Visit `/login` while signed out → one-button page.
- Click → Google flow → back at `/` with header showing email +
  sign-out.
- Click sign-out → back to signed-out state, header hides email.

### E.6 after D.6
```bash
# anonymous
curl -i -X POST http://localhost:3443/api/polish -d '{"cv":"test"}' -H 'content-type: application/json'
# expect: 401 {"error":"unauthorised"}
```
Signed-in (browser-driven) → `/api/polish` call goes through.
Polish flow produces a result. (If the existing polish route is
pre-schema-rewrite and has been fully left alone, this may
surface existing bugs unrelated to v1 auth — fix forward, don't
roll back auth work.)

### E.7 after D.7
```bash
git -P log --oneline | head -10      # 7 v1 commits visible
npm test                              # total count stable, no regression
```

---

## §F. Rebase protocol — when v2 reopens `kiro`

(Skip on first read. This is the compass for when v2 work starts
months from now.)

The two branches will diverge mostly in auth.ts. Rebase strategy:

### F.1 Assess divergence

```bash
git fetch origin
git log --oneline origin/kiro..origin/v1-google-oauth
git log --oneline origin/v1-google-oauth..origin/kiro
```

The second command should be empty if no further commits happened
on kiro; the first shows what v1 added.

### F.2 Fresh v2 branch from `kiro`

```bash
git checkout origin/kiro -b v2-credentials
```

Do not rebase kiro onto v1 or vice versa — they are intentionally
parallel. The new v2 branch cherry-picks from v1 what's reusable
and leaves what isn't.

### F.3 Cherry-pick from v1

From the v1 commits, the ones that likely apply to v2:

- ADR-0001 amendment (if v1 added one)
- README auth section (rewrite, don't cherry-pick — v2 supports
  two providers)
- Type augmentation of `next-auth.d.ts` (same shape in v2)
- The shape of `auth.ts` — the **skeleton** (adapter + session
  strategy) is identical, but session strategy changes from
  `database` to `jwt` because v2 re-introduces Credentials.
  Probably cleanest: re-type `auth.ts` manually rather than
  cherry-pick it.

Not cherry-pickable (v2 has its own version):

- Any login page (v2 is two-path: OAuth button + email/password
  form)
- The `events.createUser` hook needs a sibling path for
  Credentials signup since Credentials doesn't trigger adapter
  user creation. In v2 you'll have a separate `/api/signup`
  handler that calls `db.insert(users)` + `db.insert(credentials)`
  + allocates bonus in the same tx; and `events.createUser` only
  handles the OAuth path.

### F.4 Re-activate kiro artifacts

From `kiro` (which v2 branched off of):

- `credentials` table + migration — already present.
- `password.ts` — already present; just import from the new
  signup + login routes.
- `mail.ts` — already present; wire into a verification-email
  send step inside `/api/signup`.
- `/api/dev/outbox` — already present; becomes useful again for
  E2E.

All four modules already have passing tests; Trap 15's silver
lining is that this reuse is frictionless.

### F.5 Re-run the library-reality pass

Don't trust that NextAuth's Credentials + database-session
constraint is still what it was. Before the first line of v2
code, repeat §C.6 from this handoff for the v2 decisions. Maybe
Auth.js has been fully absorbed into Better Auth by then; maybe
v5 GA landed with a different Credentials story. Either way,
verify before building on the assumption.

---

## §G. If you get stuck

1. The ADRs are indexed in `docs/adr/`. Grep them.
2. The grill questions in §C all have expected answers; if an
   answer has drifted, the drift itself is an ADR-worthy event.
3. Trap 15 is about "framework reality". If something feels
   wrong "but I thought the framework does X", double-check by
   reading the exact framework doc for the exact combination.
4. If two hours pass without a green commit, pause and re-read
   this handoff before pushing more code. Handoff drift is fast.

Good luck.
