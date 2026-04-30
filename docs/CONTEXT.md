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
  generation, and basic `.docx` export. Subject to the free-tier quota.
- **`paid`** — a user who has made at least one successful purchase. Tier
  is latched: once a user becomes paid, they stay paid, even after
  spending all credits. Quota limits are relaxed (see *Quota*).

Do not use: *premium*, *pro*, *subscriber*. There is no subscription — a
paid user is one with purchase history, not recurring billing.

### Credit

A unit of paid entitlement. 1 credit pays for 1 PDF template export.
Credits are purchased in packs (see *Credits pack*), do not expire, and
are tracked on `app_users_meta.credits` as a non-negative integer.

Credits and quota are independent counters. Consuming a polish does not
touch credits; consuming a credit does not touch quota.

Do not use: *token* (reserved for AI-related token count), *point*, *coin*.

---

## Usage and billing

### Polish event

One invocation of the AI pipeline that produces a polished CV, cover
letter, or both. A polish event:

- consumes exactly 1 quota unit
- calls the LLM gateway once
- never persists the CV or JD text, only a row in `quota_events`

Cover-letter generation triggered from an existing polish result is a
separate polish event and consumes another quota unit (see *Shared quota
bucket*).

Do not use: *request*, *submission*, *polish session*, *run*.

### Shared quota bucket

Polish events and cover-letter events draw from the same counter. There
is no separate "cover-letter quota". UI language: "Polishes left: N".

### Quota

The free-tier entitlement to polish events. Quota is engineered as a
token bucket with a bonus phase (see *Quota lifecycle*).

Do not use: *rate limit* (that term is reserved for IP/email-domain
limits at the network/signup layer — see *Rate limit*).

### Quota lifecycle

The four phases of a free user's quota state. Accurate terminology is
required for test names and log messages.

1. **Bonus phase** — `bonus_remaining > 0`. Each polish event decrements
   `bonus_remaining`. The sliding timer is not running (`sliding_timer_started_at`
   is NULL). The refill counter is 0 and does not move.

2. **Awaiting first refill** — `bonus_remaining = 0`,
   `sliding_timer_started_at` is the timestamp of the last bonus-phase
   polish, refill is 0. The user cannot polish. Duration: 5 hours from
   `sliding_timer_started_at`.

3. **First refill** — at the instant `now >= sliding_timer_started_at + 5h`,
   refill is set to 3 in a single atomic step. There is no 1/3 → 2/3 → 3/3
   gradient during the first refill.

4. **Steady state** (token bucket) — each polish event decrements refill
   by 1 and inserts a `quota_events` row. Exactly 5 hours after a row's
   `created_at`, that row contributes 1 back to refill, independently of
   other rows. Refill is capped at `refill_cap` (3 for free, 10 for paid).

In steady state, refill = `refill_cap - COUNT(quota_events WHERE user_id = ?
AND event_type IN ('polish','cover-letter') AND created_at > now - 5h)`
(clamped to >= 0).

### Daily cap

A safety net ceiling on polish events per server-day per user.
Free: 8. Paid: 30. Resets at midnight server time. Applies on top of the
quota mechanism — if quota says yes but daily cap says no, the answer is
no.

### Credits pack

A Stripe-billed purchase that grants credits to a user. MVP offers one
pack: £5 → 10 credits. A successful purchase:

- inserts a row into `payments`
- increments `app_users_meta.credits` by the pack's `credits_granted`
- latches the user's tier to `paid` if previously `free`

Do not use: *bundle*, *package*, *top-up*.

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

- consumes 1 credit per export
- takes the polish schema's JSON as input
- renders to HTML, is opened in a shared Puppeteer-controlled browser,
  and returns a PDF

MVP ships one template: `modern-blue`. Additional templates are pure
additions (new directory under `src/templates/`).

Do not use: *theme*, *style*, *layout*.

### ATS-safe export

The free-tier export path. Takes the polished CV as plain text, uses
`docx-generator.ts`, returns a `.docx` with minimal formatting designed
to parse cleanly in applicant tracking systems. Consumes 0 credits.

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
payment endpoint rejects a request due to a rate limit. Used only for
observability — daily digests, anomaly detection. Never consulted by the
rate-limit logic itself.

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
Google + email/password auth, credits-pack payment, no history,
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
