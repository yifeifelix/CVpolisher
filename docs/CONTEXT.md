# CVpolisher — Domain Glossary

This document is the authoritative source for domain terminology used in
code, issue titles, commit messages, code reviews, UI copy, and architectural
documents. When two names exist for the same concept, the one recorded here
is the name used everywhere.

The purpose is consistency, not exhaustiveness — only terms whose precise
meaning affects how code is written belong here. If a concept shows up once
in the UI with no code impact, it does not need an entry.

Consumer rules for agents reading this file are in `docs/agents/domain.md`.

---

## Account model

### User

A natural person who has completed the signup + email verification flow.
Owns exactly one account. Uniquely identified by `users.id` (NextAuth-
generated UUID).

Do not use: *customer*, *member*, *client*.

### Tier

The billing status of a user. Exactly two values:

- **`free`** — the default at signup. Has access to polish, cover-letter
  generation, and basic `.docx` export. Subject to the free-tier quota
  (`refill_cap = 3`, `daily_cap = 8`).
- **`paid`** — a user who has made at least one successful purchase. Tier
  is latched: once a user becomes paid, they stay paid, even after
  spending all super tokens. Paid users get:
  - a small free-pool perk: `refill_cap = 5` (vs 3) and `daily_cap = 15`
    (vs 8)
  - access to their **super token** balance (see *Super token*), which
    can be spent on polish or PDF export and is not subject to any
    daily cap

Do not use: *premium*, *pro*, *subscriber*. There is no subscription — a
paid user is one with purchase history, not recurring billing.

### Super token

A unit of paid entitlement. 1 super token pays for **either** 1 PDF
template export **or** 1 polish event — user-facing action determines
which. Super tokens are purchased in packs (see *Super tokens pack*),
do not expire, and are tracked on `app_users_meta.super_tokens` as a
non-negative integer.

Super tokens and the free-tier quota (`bonus` + `refill`) are independent
counters. Consuming a polish from quota does not touch super tokens;
consuming a super token does not touch quota.

The name is deliberately not *credit* (which suggests a banking metaphor
and a single use) and not *token* (reserved for AI-provider token
count). "Super" signals "entitlement beyond the free tier".

Do not use: *credit*, *token*, *point*, *coin*.

---

## Usage and billing

### Polish event

One invocation of the AI pipeline that produces a polished CV. A polish
event:

- consumes exactly **1 unit**, drawn from the next available pool in the
  order `bonus → refill → super_tokens` (see *Consumption order*)
- calls the LLM gateway once
- is recorded differently depending on which pool paid:
  - `refill` polishes insert a `quota_events` row so the 5-hour
    refill window can be computed from it
  - `bonus` polishes decrement `app_users_meta.bonus_remaining` and
    increment the per-day free-pool counter, but do **not** insert a
    `quota_events` row — a bonus-era event would survive into the
    first post-first-refill window and incorrectly suppress one slot
    of the phase-3 refill
  - `super_tokens` polishes only decrement `app_users_meta.super_tokens`;
    no `quota_events` row, no `payments` row
- never persists the CV or JD text regardless of which pool paid

Cover-letter generation is **not** a polish event. See *Cover letter
entitlement*.

Do not use: *request*, *submission*, *polish session*, *run*.

### Consumption order

When a polish event is authorised, the quota engine picks exactly one
pool to debit, in this fixed priority:

1. `bonus_remaining` if > 0
2. free-tier refill (computed from `refill_cap` minus the count of
   non-super-token `quota_events` rows in the last 5h) if > 0
3. `super_tokens` if > 0

The user does not choose. The engine picks silently. This is a
deliberate design decision (see ADR-0003 §2) — forcing users to pick on
every click destroys the "my super tokens are still there" sunk-cost
mechanic that drives repeat purchase.

If all three pools are empty, the polish is denied. Paid users with 0
super tokens fall back to the same free-pool mechanism as free users,
with their paid `refill_cap` (5) and `daily_cap` (15).

### Quota

The free-tier entitlement to polish events. Quota is engineered as a
token bucket with a bonus phase (see *Quota lifecycle*). "Quota" refers
to the combined `bonus + refill` free-tier mechanism and does **not**
include super tokens.

Do not use: *rate limit* (that term is reserved for IP/email-domain
limits at the network/signup layer — see *Rate limit*).

### Quota lifecycle

The four phases of a user's free-pool quota state. Applies to both free
and paid tiers; paid users simply have higher `refill_cap` and
`daily_cap` values. Accurate terminology is required for test names and
log messages.

1. **Bonus phase** — `bonus_remaining > 0`. Each polish event decrements
   `bonus_remaining` (unless the user's super tokens are being used —
   but bonus is picked first, so that case doesn't arise unless bonus
   is already 0). The sliding timer is not running
   (`sliding_timer_started_at` is NULL). The refill counter is 0 and
   does not move.

2. **Awaiting first refill** — `bonus_remaining = 0`,
   `sliding_timer_started_at` is the timestamp of the last bonus-phase
   polish, refill is 0. The user cannot polish from the free pool. If
   they are paid and have super tokens, the engine picks `super_tokens`
   — that path bypasses this phase entirely.

3. **First refill** — at the instant `now >= sliding_timer_started_at
   + 5h`, refill is set to `refill_cap` (3 free / 5 paid) in a single
   atomic step. There is no gradual ramp.

4. **Steady state** (token bucket) — each free-pool polish event
   decrements refill by 1 and inserts a `quota_events` row. Exactly 5
   hours after a row's `created_at`, that row contributes 1 back to
   refill, independently of other rows. Refill is capped at
   `refill_cap`.

In steady state, refill = `refill_cap - COUNT(quota_events WHERE user_id
= ? AND event_type = 'polish' AND created_at > now - 5h)` (clamped to
>= 0). Super-token polishes do not produce `quota_events` rows and thus
do not affect refill. The `event_type` column exists for forward
compatibility; today only `'polish'` is written.

### Daily cap

A safety net ceiling on **free-pool** polish events per server-day per
user. Free: 8. Paid: 15. Resets at midnight server time.

The cap applies **only** to free-pool consumption (bonus + refill).
Super-token polishes are uncapped — a user who paid has already paid
for the cost of the call; capping them would punish paying customers
(see ADR-0003 §3).

If the daily cap is exceeded but the user still has super tokens, the
engine picks `super_tokens` instead of denying the polish. This is the
normal fallback path, not an edge case.

### Super tokens pack

A Stripe-billed purchase that grants super tokens to a user. MVP offers
one pack: £5 → 10 super tokens. A successful purchase:

- inserts a row into `payments`
- increments `app_users_meta.super_tokens` by the pack's token count
- latches the user's tier to `paid` if previously `free` — immediately
  applies the paid `refill_cap` (5) and `daily_cap` (15) values to
  future polishes
- does **not** reset or alter `bonus_remaining` — a user still in the
  bonus phase does not lose bonus on purchase; the paid perks simply
  take effect when bonus exhausts

Do not use: *bundle*, *package*, *top-up*, *credits pack*.

### Cover letter entitlement

A one-time right to generate a cover letter, bundled with every polish
event. The entitlement:

- is created alongside a successful polish result
- is consumed the first (and only) time the user clicks "Create Cover
  Letter" on the post-polish result page
- does **not** debit the quota engine, does **not** debit super tokens,
  does **not** insert a `quota_events` row — it is tracked purely in
  the in-flight polish result object
- disappears when the polish result does (MVP policy: polish results are
  not persisted; refreshing the result page loses both the polish and
  the entitlement)
- is only available when the original polish was given a JD (no JD =
  no cover letter to generate)

This models the business rule "one polish = one job application package
(CV + cover letter)" without re-implementing the quota mechanism
twice, and without the surprise-double-charge UX of the previous
"shared quota bucket" design.

Future versions may allow regeneration of the cover letter (at a super
token cost, or free, or capped per day — undecided). MVP scope: one
cover letter per polish, free, non-refreshable.

Do not use: *cover letter quota*, *cover letter slot*, *cover letter
credit*.

---

## AI and rendering

### LLM gateway

The LiteLLM process that holds provider credentials and routes calls to
the actual model. The Next.js app never speaks to Bedrock / OpenRouter
directly — every LLM call goes through the gateway. The gateway lives
on the Docker internal network and accepts calls only from the app
container with a shared bearer token.

Do not use: *proxy*, *LLM router*, *AI gateway*. When code or config
refers to this service, it is *the LLM gateway* or literally *LiteLLM*.

### Provider

A third-party AI API the gateway can call. MVP has one: AWS Bedrock
(model: DeepSeek V3). Future entries (Nvidia free tier, local Qwen, Claude
Haiku, OpenRouter) are configured on the gateway, not the app.

Do not use: *vendor*, *backend*, *model source*.

### Polish prompt

The prompt template sent to the LLM for a polish event. Produces a
structured JSON response conforming to the *Polish schema*. Defined in
`src/lib/prompts.ts`. User input is wrapped in XML-style `<cv>...</cv>`
and `<jd>...</jd>` tags. The prompt instructs the LLM to return a
*Rejection* instead of attempting to polish when input is not a CV or JD.

### Polish schema

The exact JSON structure the LLM must return. Defined and enforced by a
Zod schema at the response boundary. Responses failing the schema
trigger the retry path (see *Parse retry ceiling*).

### Rejection

A structured signal from the LLM that user input is not a CV or JD.
Takes the form `{ "rejected": true, "rejectionReason": "..." }`.

A rejection:
- is an expected, first-class response — not an error
- does **not** consume quota
- surfaces to the user as a 403 with the rejection reason
- is distinct from a *parse failure* (see *Parse retry ceiling*) where
  the response does not conform to either the polish or rejection shape

### Parse retry ceiling

When an LLM response does not match the polish schema and is not a
rejection, the app retries the call up to 2 additional times (3 attempts
total). After 3 failed attempts, the app debits 1 quota unit and returns
an error to the user. Without this debit, a crafted input can loop
forever on the operator's cost.

### Template

A rendered-PDF design applied to a polished CV. Implemented as a React
component plus scoped CSS in `src/templates/<name>/`. A template:

- consumes 1 super token per export
- takes the polish schema's JSON as input
- renders to HTML, is opened in a shared Puppeteer-controlled browser,
  and returns a PDF

MVP ships one template: `modern-blue`. Additional templates are pure
additions (new directory under `src/templates/`).

Do not use: *theme*, *style*, *layout*.

### ATS-safe export

The free-tier export path. Takes the polished CV as plain text, uses
`docx-generator.ts`, returns a `.docx` with minimal formatting designed
to parse cleanly in applicant tracking systems. Consumes 0 super tokens.

Do not use: *basic export*, *free template*. The ATS-safe export is not
a template — it is a separate export pathway.

---

## Abuse defence

### Rate limit

Network-layer or signup-layer throttle, measured per IP or per email
domain. Distinct from *quota*, which is measured per user. Rate limits
protect the signup endpoint before a user exists; quota protects the
polish endpoint after signup.

- **Per-IP signup rate limit** — 1 signup per hour per IP
- **Per-email-domain signup rate limit** — 3 signups per hour per
  email domain, with an allowlist for major providers
  (Gmail, Outlook, Yahoo, iCloud, Proton)

### Honeypot field

A hidden form field invisible to real users but filled by naive bots.
Non-empty value on submit means "bot" and the signup is silently
rejected.

### Turnstile

Cloudflare's CAPTCHA alternative, used in **invisible mode** at signup.
Interacts with humans only when Cloudflare's risk heuristics fail.

### Email normalisation

The process of canonicalising an email address before uniqueness check
and before storing as `users.email_normalized`. For Gmail addresses:
dots in the local part are removed and any `+...` suffix is stripped,
so `first.last+hr@gmail.com` and `firstlast@gmail.com` collapse to the
same normalised form. Unique index is on `email_normalized`, not on
`email`.

Do not use: *email canonicalisation*, *email cleanup*.

### Disposable email blacklist

A static list of domains known to operate as temporary-inbox services
(`tempmail.com`, `10minutemail.com`, etc.). Signup against these domains
returns 400.

### Rate limit event

A row in `rate_limit_events`, written whenever a signup, polish, or
payment endpoint processes a request subject to a rate limit.

**Dual role (pending schema finalisation):**

- **Enforcement** — the rate limit engine reads recent rows for a
  given key (IP address for per-IP limits, email domain for
  per-email-domain limits) to decide whether a new attempt is within
  the limit. This is a change from the original ADR-0001 intent where
  the table was observability-only.
- **Observability** — daily digests and anomaly detection read the
  same table.

The exact schema needed to support both roles (the ADR-0001 schema
only has an `ip` column and no allowed-vs-denied discriminator) is an
open item to be resolved when the signup route is wired up. The rate
limit engine at `src/lib/rate-limit/` is already stateless and
key-agnostic, so no engine change is expected — only the table's
column set and the SQL the route issues.

---

## Data and persistence

### Content-free database

The architectural property that the database contains only account and
usage metadata. CV text, JD text, AI responses, and cover letter text
are **never** written to any persistent store (SQLite, disk, logs).
They pass through memory and the HTTP response and disappear.

This property is load-bearing: the privacy policy promises it, GDPR
compliance depends on it, and no code should break it without an ADR
revision.

### In-flight result

A polish schema JSON that exists in React state in the user's browser
tab. Surviving a refresh requires persisting it (paid feature, deferred
to V2). MVP behaviour: refresh loses the result.

Do not use: *session* (deliberately avoided — the old SQLite `sessions`
table is being retired and the name carries baggage).

### Litestream replica

A continuously updated copy of `cvpolisher.db` on VPS B, maintained by
`litestream replicate` streaming WAL segments over the Oracle private
VCN. Used for disaster recovery. Not a live standby — promotion to
primary requires a manual `litestream restore`.

---

## Infrastructure

### VPS A

The application host. Oracle Ampere ARM, 4 OCPU, 24 GB RAM, 150 GB disk.
Runs Caddy (or `cloudflared`), Next.js, SQLite, LiteLLM gateway,
Puppeteer, litestream.

### VPS B

The backup host. Oracle x86 AMD `E2.1.Micro`, 1 OCPU, 1 GB RAM, 50 GB
disk. Runs litestream (replica mode) and Docker volume snapshot cron.
Not in the request path.

### Cloudflare edge

The Cloudflare account sitting in front of the domain. Provides DNS,
TLS termination, DDoS absorption, Turnstile, and WAF. VPS A firewall
accepts inbound only from Cloudflare's published IP ranges.

---

## Product lifecycle terms

### MVP

The scope defined by ADR-0002 Phase 1–4: one template, one provider,
Google + email/password auth, super-tokens-pack payment, no history,
no app, no LinkedIn import. Features outside this list are explicitly
V2.

### V2

Not a commitment, a container. When a feature is deferred for MVP
shipping speed, it goes into V2. At launch retrospective, V2 is
re-prioritised into real roadmap.

Do not use: *later*, *future*, *phase 2* (the word "phase" already
refers to ADR-0002's implementation phases — different concept).

---

## When a term here conflicts with code

If existing code uses a name that contradicts this glossary (e.g. the
current codebase has a `sessions` table and a `jd_snippet` field, both
retired by ADR-0001), treat the glossary as the forward direction. New
code uses these names; rename existing code when it is touched for
unrelated reasons, or in a dedicated rename CR.

Do not silently redefine a term here without updating every caller in
the same change — terminology drift is the cost being prevented.
