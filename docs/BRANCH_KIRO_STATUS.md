# `kiro` branch — status report

**Branch tip at pause:** see `git log --oneline -n 1 origin/kiro`
(latest on remote when this file was written was `4347042`).

**Status:** **paused**, not abandoned. Preserved as the foundation
for v2 of CVpolisher's auth model. v1 production work continues on a
separate branch that starts fresh from this branch's point.

## Why the branch paused

Session 4 built Phase-1 auth foundations in TDD style against
decisions pinned in [ADR-0004](adr/0004-phase-1-auth-decisions.md):

- `credentials` table (Drizzle schema + migration)
- scrypt hash module (`src/lib/auth/password.ts`, 7 tests, OWASP-
  compliant parameters)
- Mock mail transport (`src/lib/auth/mail.ts`, 7 tests)
- Dev-only outbox route (`src/app/api/dev/outbox/route.ts`)
- `next-auth@5.0.0-beta.31` installed, `@auth/drizzle-adapter@1.11.2`
  from session 3

At the point of wiring `auth.ts`, a library-reality check against
the NextAuth v5 Credentials provider docs revealed a hard
constraint: **Credentials provider forces `strategy: "jwt"`**.
Multi-year framework limitation (GitHub Discussion #4394),
community workarounds only.

ADR-0004 §1 had committed to `strategy: "database"`. §4 had designed
a full signup pipeline keyed off the Credentials provider. §5 had
built a table whose sole purpose was holding scrypt hashes for
Credentials logins. **Three foundational decisions depended on a
library reality that does not exist.**

Full analysis of the class of failure is logged as
[Trap 15 in KIRO_BRANCH_SUMMARY §9](../KIRO_BRANCH_SUMMARY.md).

## The pivot

Rather than patching ADR-0004 in place ("amendment hides that the
grill was incomplete") the project's auth model is split in two:

- **v1 — Google OAuth only.** OAuth + DrizzleAdapter + database
  session has no framework conflict; it's the documented happy
  path. A new branch starts here. Covers the launch-critical login
  story.
- **v2 — adds email+password (Credentials provider).** Deferred
  until after v1 launch. At that point this branch rebases on
  top of the then-current main, and the preserved artifacts below
  are cherry-picked / extended.

`kiro` branch itself is left intact on the remote so that:

1. Git history of Session 2 + 3 + 4 decisions stays readable.
2. The v2 artifacts remain diffable without pulling them out of
   buried squashed commits.
3. Trap 15's narrative anchors to real commits a future agent can
   `git show`.

## Preserved artifacts (what's on this branch, v1 vs v2 status)

### Documents

| File | Intro commit | v1 status | v2 status |
|---|---|---|---|
| `KIRO_BRANCH_SUMMARY.md` §9 Trap 15 | `4347042` | Read before starting | Still authoritative |
| `docs/adr/0004-phase-1-auth-decisions.md` | `068dd33`, amended | v1 ignores §1/§4/§5, keeps §2/§3/§6 | v2 re-activates §1 (but JWT) / §4 / §5 |
| `docs/BRANCH_KIRO_STATUS.md` | this file | Read as intake | Read before rebase |
| `docs/HANDOFF_V1_GOOGLE_OAUTH.md` | pairs with this file | **Read this first** | No longer relevant |

### Schema

| Artifact | Intro commit | v1 status | v2 status |
|---|---|---|---|
| `user` / `account` / `session` / `verificationToken` tables | `08a9ee7` | All live; Google OAuth writes here via adapter | Unchanged |
| `app_users_meta`, `quota_events`, `payments`, `rate_limit_events` | `08a9ee7` | v1 uses `app_users_meta`; `rate_limit_events` may get v2 use | Same |
| `credentials` table | `b6d6fbc` | **Inert.** Never written. Harmless empty table. | Re-activated — stores scrypt hashes |
| `drizzle/0000_ancient_beyonder.sql` | `08a9ee7` | Applied at first boot | Applied |
| `drizzle/0001_bouncy_human_cannonball.sql` | `b6d6fbc` | Applied but the table goes unused | Applied; table gets rows |

### Code modules

| Module | Intro commit | v1 status | v2 status |
|---|---|---|---|
| `src/lib/db/schema.ts` + `index.ts` | `08a9ee7` | Used as-is by NextAuth adapter | Used as-is |
| `src/lib/quota/engine.ts` (+ 12 tests) | session 2 | Used on polish path | Used |
| `src/lib/rate-limit/rate-limit.ts` (+ 4 tests) | session 2 | Used on polish, maybe signup rate-limit | Used on `/api/signup` |
| `src/lib/email/normalise.ts` (+ 9 tests) | session 2 | Used to dedupe OAuth users by `email_normalized` | Used on signup path |
| `src/lib/email/disposable.ts` (+ 3 tests) | session 2 | **Unused** in v1 — Google gates the email | Used on signup path |
| `src/lib/auth/password.ts` (+ 7 tests) | `171d9e8` | **Unused** — no Credentials provider | Used by signup + login hash/verify |
| `src/lib/auth/mail.ts` (+ 7 tests) | `8edecf4` | **Unused** initially; may be used for polish-complete notifications | Used for verification mail |
| `src/app/api/dev/outbox/route.ts` | `b84f345` | **Unused** initially | Used to receive verification mail in E2E tests |
| `src/lib/db.ts` (legacy LAN-tool) | pre-SaaS | Retiring — see its @deprecated banner | Retiring |

All "Unused in v1" modules **stay on disk**. They are self-contained,
don't depend on anything that would break in v1, and deleting-then-
rewriting in v2 is wasted work. Their 14 passing tests continue to
run as part of the suite and act as a regression safety net for when
they're wired up.

### Dependencies installed

| Package | Commit | Kept in v1? |
|---|---|---|
| `drizzle-orm@0.45.2` | `071c2ba` | Yes |
| `@auth/drizzle-adapter@1.11.2` | `071c2ba` | Yes |
| `drizzle-kit@0.31.10` (dev) | `071c2ba` | Yes |
| `next-auth@5.0.0-beta.31` | `cb76f51` | Yes |

No dependency is Credentials-specific; nothing needs uninstalling.
v1 uses the same tree.

## What v1 branch must do first

(Full procedure in `docs/HANDOFF_V1_GOOGLE_OAUTH.md` — read that
before starting work.)

Shape summary:

1. Branch from `kiro` tip.
2. Read the three docs flagged above.
3. Write `auth.ts` using NextAuth v5 + `DrizzleAdapter` + `Google`
   provider + `strategy: "database"`.
4. Hook `events.createUser` to create the `app_users_meta` row and
   allocate the signup bonus of 6 super-token-equivalent entries
   (ADR-0001 §2; v1 re-interprets "email verification completed" as
   "Google returned email_verified=true on first sign-in").
5. Add the `/api/auth/[...nextauth]/route.ts` handler.
6. Ship a minimal login page using NextAuth's `signIn('google')`.
7. Gate the polish / export paths on `auth()` returning a session.

## Return conditions (when v2 reopens this branch)

Open the v2 work on a fresh branch rebased from `kiro` tip **when
all of these are true**:

- v1 is in production on real traffic for ≥ 2 weeks with no auth-
  related incidents logged
- User feedback mentions wanting email+password or non-Google sign-
  in with measurable frequency
- Resend / real mail transport is operational (Phase 4 milestone)

If v2 is deferred beyond 3 months, re-verify the library-reality
assumptions at that point — NextAuth v5 may have reached GA, Auth.js
may have merged into Better Auth with new defaults, or scrypt
parameter guidance may have moved. Treat the rebase point as a
fresh library-reality pass per Trap 15.

## One-line status for `git branch -v` watchers

> kiro — foundations for v2 auth (scrypt, mock mail, credentials
> table); v1 Google-OAuth-only ships from a sibling branch; see
> docs/BRANCH_KIRO_STATUS.md
