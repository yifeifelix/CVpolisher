# ADR-0001: Evolve CVpolisher from self-hosted LAN tool to freemium SaaS

- **Status**: Accepted (partially superseded — see below)
- **Date**: 2026-04-30
- **Deciders**: yifeifelix
- **Supersedes**: aspects of `docs/superpowers/specs/2026-04-15-cv-polisher-design.md`
  (which designed CVpolisher as a self-hosted LAN tool)
- **Superseded in part by**: [ADR-0003](./0003-super-token-pricing-model.md)
  — §1 product shape (paid value proposition), §8 payments (credits →
  super tokens, two-use), §13 hard values (`refill_cap` paid 10→5,
  `daily_cap` paid 30→15, "credits pack" → "super tokens pack")

## Context

CVpolisher was originally built as a self-hosted Next.js app for family
members job-searching on a local network. The current architecture reflects
that:

- No authentication, no user model, no multi-tenancy
- AI provider keys (`CV_OPENROUTER_API_KEY`, AWS creds, Google creds) live
  in Next.js server `.env.local` — suitable for a single trusted user
- SQLite `sessions` table stores CV/JD/result content in plain text;
  anyone with the session id can read any session via `/api/result/[id]`
- Deployment target: `docker run` behind Caddy + basic auth on an
  Oracle VPS, intended for temporary public exposure

Goal: make the product available to the general public as a freemium SaaS,
with a future path to a mobile app. Value proposition: AI-driven CV polish
with ATS analysis (free) plus paid export through visually differentiated
templates (paid).

This ADR records the decisions made during a design grill session on
2026-04-30 that cover product shape, AI provider, infrastructure, auth,
payments, rendering, quotas, and abuse defence. It replaces the LAN-tool
architecture end-to-end.

## Decision

### 1. Product shape — freemium SaaS

> **Superseded in part by [ADR-0003](./0003-super-token-pricing-model.md)**:
> the paid value proposition has expanded — super tokens now cover both
> PDF template export **and** polish acceleration. The phrase below
> "1 credit = one PDF export" no longer applies; see ADR-0003 §1.

- Not an open-source self-hosted tool; not a pure subscription product
- Free tier: account-gated AI polish + ATS analysis + basic `.docx` export
- Paid: £5 buys 10 credits; 1 credit = one PDF export through a visually
  differentiated template
- Primary user base: UK/EU job seekers (GDPR compliance is a first-class
  concern)
- Mobile app deferred to V2; MVP is web only

### 2. Account system — mandatory signup, no anonymous use

- **Rationale**: paid model and AI cost control both require per-user
  tracking. IP-based anonymous limits are trivially defeated by rotating IPs
- Stack: **NextAuth v5** with SQLite adapter
- Providers for MVP:
  - **Google OAuth** (primary)
  - **Email + password** (fallback for users avoiding Google)
- LinkedIn/GitHub/Apple/WeChat deferred to V2
- Email addresses must be verified before bonus credits are issued;
  OAuth users are treated as pre-verified
- Mail service: **Resend** (3000 emails/month free tier)

### 3. Quota mechanism — token bucket with bonus phase

> **Superseded in part by [ADR-0003](./0003-super-token-pricing-model.md)**:
> the four-phase lifecycle (bonus → awaiting first refill → first refill →
> steady state) is unchanged, but:
> - paid `refill_cap` is **5** (not 10)
> - paid `daily_cap` is **15** (not 30)
> - daily cap applies **only** to free-pool consumption; super-token
>   polishes are uncapped
> - a third pool — `super_tokens` — is consumed **after** `bonus` and
>   `refill`, with no daily cap

Free tier quota has two sequential phases:

```
Registration: bonus = 6, refill = 0, sliding_timer = off

Phase 1 (bonus phase):
  each polish decrements bonus
  sliding_timer does not run, refill stays 0

Phase 2 (bonus exhausted):
  sliding_timer starts now + 5h
  refill stays 0 until timer fires
  user cannot polish

Phase 3 (first refill):
  after 5h, refill becomes 3 atomically (not gradual)
  switch to token-bucket mode

Phase 4 (steady state):
  each polish decrements refill and records a timestamp
  timestamp + 5h later, refill += 1 (independent per consumption)
  refill is capped at 3
```

Additional constraints:

- **Daily cap**: free users 8/day, paid users 30/day (safety net regardless
  of window state)
- **Paid users** (anyone who has ever purchased credits): refill cap raised
  from 3 to 10
- `polish` and `cover-letter` share the same quota bucket — UI shows a
  single counter

### 4. AI provider — Bedrock DeepSeek V3 behind a LiteLLM gateway

- **Default model**: AWS Bedrock DeepSeek V3, preferring EU region where
  available (`eu-west-2` / `eu-west-1`), falling back to US
  (`us-east-1`) only if necessary
- **Rationale** over alternatives:
  - DeepSeek V3 is ~6× cheaper than Claude Haiku 4.5 (£0.003/call vs
    £0.019/call), ~8× cheaper than DeepSeek-V4-Flash is not in Bedrock yet
  - Bedrock keeps data in AWS regions we control, sidestepping the GDPR
    concerns of routing UK/EU CV data through China-based DeepSeek API
  - Existing code already has a `bedrock.ts` adapter — zero new SDK
- **Gateway**: LiteLLM proxy in a separate Docker container on VPS A,
  reachable only via the Docker internal network
- **Why a gateway**:
  - The Next.js app does not hold any real provider keys; only a token to
    call the gateway. A compromised Next.js process cannot exfiltrate
    Bedrock/OpenRouter/Nvidia credentials.
  - Model selection, cost routing, and future fallback chains become
    runtime config (LiteLLM YAML), not code + redeploy.
  - Per-user rate limiting at the gateway is a defence-in-depth layer on
    top of app-level quota.
- **IAM**: Bedrock calls use a dedicated IAM user with `bedrock:InvokeModel`
  restricted to a specific model ARN — minimal blast radius if the gateway
  is ever breached
- **Future providers** (V2 only, not MVP):
  - Local Qwen 7B on VPS A's 24GB ARM instance
  - Nvidia free tier
  - Claude Haiku 4.5 as paid-tier quality upgrade
  - Fallback chains are configured at the gateway, not the app

### 5. AI output format — structured JSON, not plain text

Current system outputs plain-text CV. MVP changes the prompt contract so
Bedrock returns:

```json
{
  "personal": { "name", "email", "phone", "location" },
  "summary": "...",
  "experience": [{ "company", "title", "dates", "bullets": [...] }],
  "education": [...],
  "skills": [...],
  "atsScore": 78,
  "topKeywords": [...],
  "mustHaveSkills": [{ "skill", "matched" }],
  "suggestions": [...],
  "coverLetter": "...",          // present only when JD provided + flow requests it
  "rejected": false,             // true when input is not a CV/JD; response omits polish fields
  "rejectionReason": "..."       // present only when rejected=true
}
```

Structured output enables template rendering (see 7) and per-section UI
editing without heuristic plain-text parsing.

### 6. Database — SQLite, content-free

> **Superseded in part by [ADR-0003](./0003-super-token-pricing-model.md)**
> — three schema lines below are stale. Authoritative column names are
> pinned in `src/lib/db/schema.sql` and described in `docs/CONTEXT.md`.
> The original SQL block is kept for audit trail; the diffs are:
>
> - `app_users_meta.credits INT` → **`super_tokens INT`** (rename; same
>   column role, per ADR-0003 §1 product naming change)
> - `quota_events.event_type 'polish'|'cover-letter'|'refill'` → in
>   practice **`event_type` is always `'polish'`** in MVP. Cover letter
>   is tracked as a per-polish entitlement in React state, not as a row
>   (ADR-0003 §6 + CONTEXT.md §Cover letter entitlement). Refill is not
>   a separate event — the engine derives refill remaining from the
>   count of `'polish'` rows in the last 5h (CONTEXT.md §Quota lifecycle
>   phase 4). The column stays for forward compatibility.
> - `rate_limit_events (id, ip, event_type, created_at)` → final
>   columns are **`id`, `key_type ('ip' | 'email_domain')`,
>   `key_value`, `event_type`, `outcome ('allowed' | 'denied')`,
>   `created_at`**, indexed on `(key_type, key_value, created_at)`.
>   The original ADR-0001 §11 intent that this table was
>   observability-only is superseded by the dual-role decision in
>   `CONTEXT.md` §Rate limit event — the rate-limit engine reads this
>   table for enforcement, so it needs to key on both IP and email
>   domain and needs an outcome discriminator for observability.

- **Engine**: SQLite via `better-sqlite3` (existing choice, no migration
  to Postgres in MVP)
- **Backup**: `litestream` continuous WAL replication to VPS B over the
  Oracle private VCN
- **Schema** (content-free — CVs, JDs, AI responses are never persisted):

```sql
-- NextAuth-managed (created by its SQLite adapter)
users             (id, email, email_normalized UNIQUE, name, image,
                   email_verified, created_at)
accounts          (id, user_id, provider, provider_account_id, ...)
sessions          (id, session_token, user_id, expires)
verification_tokens (...)

-- Business state
app_users_meta    (user_id PK FK users.id,
                   tier 'free'|'paid',
                   bonus_remaining INT,
                   credits INT,
                   sliding_timer_started_at TIMESTAMP NULL)

quota_events      (id, user_id FK, event_type 'polish'|'cover-letter'|'refill',
                   created_at,
                   INDEX (user_id, created_at))

payments          (id, user_id FK, amount_pence, stripe_session_id UNIQUE,
                   credits_granted, created_at)

rate_limit_events (id, ip, event_type, created_at)
                  -- observability only, not used for enforcement
```

- The old `sessions` table (which stored CV/JD/result) **is dropped**
- Polish results live only in the browser's React state for the duration
  of the tab. Refreshing the page loses the result — this is an accepted
  UX trade and the basis for a future "save history" paid feature
- `email_normalized` strips Gmail dots and `+alias` suffixes and is the
  unique key, preventing trivial bonus farming via Gmail aliases

### 7. Export — HTML/CSS templates rendered via Puppeteer → PDF

- Free export: the existing `docx-generator.ts` `.docx` path stays — an
  ATS-safe plain version that costs zero credits
- Paid export: **HTML/CSS template rendered to PDF via Puppeteer**
  - Templates are React components + CSS in `src/templates/<name>/`
  - Puppeteer runs inside the Next.js container; one Chromium browser
    instance is warmed at process start and reused per request
  - First visual reference: user-supplied LaTeX template with
    `#00199e` deep blue headings, `#2ec1e0` cyan subheadings, Source Sans
    Pro, compact section spacing
- **Rationale** over alternatives:
  - docxtemplater (.docx templates): Word's layout capabilities cap the
    "WOW" factor — the premium vibe we need to justify a £5 paywall is
    hard to hit in docx
  - Server-side LaTeX: unlocks the best visual output but adds TeXLive
    (1–8 GB image), LaTeX injection surface, and a second designer skill
    set. Worth revisiting in V2 for specific template styles.
  - Client-side PDF (html2pdf): inconsistent output across devices,
    unacceptable for a paid product
- MVP ships **one** paid template. Additional templates are
  configuration plus a new component; adding a template does not require
  architectural changes.

### 8. Payments — Stripe Checkout, credits pack

> **Superseded by [ADR-0003](./0003-super-token-pricing-model.md)**:
> "credits" is renamed to "super token" and each super token is spendable
> on **either** a PDF export **or** a polish event (1:1 with any action).
> Consumption happens automatically in the order `bonus → refill →
> super_tokens`, not user-chosen. See ADR-0003 §1, §2.

- **Provider**: Stripe Checkout (hosted payment page)
- **Product**: £5 = 10 credits; credits never expire
- **Not** single-purchase £1 — Stripe fees (£0.20 + 1.5%) consume 21% of
  a £1 transaction, which breaks the unit economics
- **Not** subscription — job seekers use the product in short bursts
  (weeks during an active job hunt), so a monthly sub has poor LTV and
  high churn vs credits
- Stripe webhook `/api/stripe-webhook` verifies signature using
  `stripe.webhooks.constructEvent` before crediting the user. Unsigned
  or invalid-signature calls return 403.
- Failed webhooks (signature failure, DB write failure) emit an alert —
  a user who paid but did not receive credits is a critical bug

### 9. Infrastructure — two Oracle Cloud VPSes, same VCN

```
VPS A (ARM Ampere, 4 OCPU, 24 GB RAM, 150 GB disk) — application host
  ├── Next.js app (Docker, port 3000 internal)
  ├── LiteLLM router (Docker, port 4000 internal, not exposed externally)
  ├── SQLite file /data/cvpolisher.db
  ├── Puppeteer (inside Next.js container)
  ├── Caddy or Cloudflare Tunnel (public ingress)
  └── litestream → VPS B

VPS B (AMD E2.1.Micro, 1 OCPU, 1 GB RAM, 50 GB disk) — backup host
  ├── litestream replica of cvpolisher.db
  └── Docker volume snapshots (7-day rolling)
```

- Same VCN → free, low-latency private networking between A and B
- **Reserved RAM on VPS A** for future local LLM experiments (Qwen 7B Q4
  fits in ~8 GB; room to try Q14B)

### 10. Public ingress — Cloudflare in front

- Registrar: **Cloudflare Registrar**, domain `cvpolisher.<tld>` — TLD
  depends on availability (`.app`, `.io`, `.co`, etc.)
- Cloudflare provides free TLS, DDoS protection, and CDN
- VPS A firewall accepts inbound only from Cloudflare's published IP
  ranges — origin IP is not directly reachable from the public internet
- Cloudflare Tunnel (`cloudflared`) is the preferred form in V2:
  VPS A opens no public ports at all; Cloudflare connects outbound

### 11. Abuse defence — 17 controls

Registration (6):
1. Email verification gate before bonus credits
2. Disposable-email domain blacklist
3. Honeypot hidden field in signup form
4. Cloudflare Turnstile invisible mode
5. Per-IP registration rate limit (1/hour)
6. Per-email-domain rate limit (3/hour), with allowlist for Gmail/Outlook/
   other major providers

Usage quota (3):
7. Bonus (6) + sliding token bucket (3 @ 5h) already described
8. Daily cap (free 8, paid 30)
9. Tier-aware caps (free vs paid)

Input (2):
10. Hard character limits: CV ≤ 8000, JD ≤ 4000
11. AI returns `rejected: true` for non-CV/non-JD input; the app
    does **not** debit quota for rejected inputs

LLM call (4):
12. `max_tokens` capped at ~3000
13. Strict Zod-validated JSON schema on AI response
14. Retry ceiling: maximum 2 retries (3 attempts total) on parse failure
15. After 3 failed attempts, 1 quota unit is debited — this prevents
    crafted inputs from triggering an infinite free-retry loop

Prompt (2):
16. User input is wrapped in XML/tag boundaries in the system prompt
17. System prompt explicitly refuses any task that is not CV polish /
    cover-letter generation; structured `rejected` output is the
    first-class signal, not prose refusal

### 12. Test strategy — four stages

- **Stage 1** (CI): Unit + integration tests per defence control, using
  Vitest + MSW to mock Bedrock and Resend. Database isolated to an
  in-memory SQLite per test.
- **Stage 2** (pre-deploy): Automated E2E scripts against a staging
  environment, simulating each attack scenario.
- **Stage 3** (red team, pre-launch): manual half-day of adversarial
  probing — prompt injection variants, Gmail alias farming, concurrent
  quota race, Stripe signature forgery, etc. Full playbook in
  ADR-0002.
- **Stage 4** (production): AWS Cost Anomaly Detection + Budget hard
  stop, `rate_limit_events` daily digest, Stripe webhook failure alerts.

### 13. Hard configuration values

> **Superseded in part by [ADR-0003](./0003-super-token-pricing-model.md)**
> — three numbers changed:
> - `refill cap (paid) = 10` → **5**
> - `daily cap (paid) = 30` → **15**
> - `credits pack = £5 → 10 credits` → `super tokens pack = £5 → 10 super tokens`
>   (1 super token = 1 polish event OR 1 PDF export)
>
> Daily cap applies only to free-pool consumption (bonus + refill);
> super-token polishes are uncapped. Values below are the original ADR-0001
> figures, kept for audit trail; authoritative values are in `docs/CONTEXT.md`.

```
Quota:
  bonus = 6
  refill cap (free) = 3, window = 5h
  refill cap (paid) = 10
  daily cap (free) = 8
  daily cap (paid) = 30

Input limits:
  CV max characters = 8000
  JD max characters = 4000

LLM:
  max_tokens = 3000
  parse retry limit = 2 (total 3 attempts)

Rate limits:
  per-IP registration = 1/hour
  per-email-domain registration = 3/hour (major providers allowlisted)

Payments:
  credits pack = £5 → 10 credits
  credit cost per template export = 1
  credit expiry = never
```

## Consequences

### Positive

- GDPR posture is strong: CV content never persists; DB stores only
  account state, usage counters, and payment records
- Provider keys live in one container on one host; rotating or swapping a
  provider is a config change, not a deploy
- Quota mechanism handles the trio of cost control / abuse resistance /
  good-faith user experience with a single coherent model
- Template architecture scales — adding templates is a designer +
  frontend task, not an architecture task
- Infrastructure fits inside Oracle's Always Free tier; monthly hard cost
  is the domain (£8–12/year) and AI usage (variable, capped by AWS
  Budget)

### Negative

- Free users lose history — refresh = lost polish. Positioned as a
  feature difference vs paid tier, but will produce occasional support
  questions
- LiteLLM is an additional moving part to operate and upgrade
- Puppeteer / headless Chromium adds ~200–400 MB RAM and has a non-zero
  rate of rendering quirks
- Single-VPS application deployment has no automatic failover. If VPS A
  goes down the service is offline; VPS B holds data for recovery but
  not a live standby. Acceptable for MVP given expected traffic.
- Self-implemented Gmail alias normalisation and disposable-email
  blacklisting require ongoing list maintenance

### Neutral

- Moves from self-hosted LAN tool to SaaS — changes the product, support
  burden, and legal posture (privacy policy, terms of service, VAT
  considerations are now real concerns, addressed in ADR-0002's V2 list)

## Rejected alternatives

- **Anonymous free tier** — abandoned due to cost-control and abuse
  risks with publicly available LLM endpoints
- **Subscription-only pricing** — poor fit for short-burst job-seeker
  usage; high churn
- **Postgres for MVP** — existing `better-sqlite3` integration is
  synchronous and deep; swap not justified by MVP-scale load
- **Clerk / Supabase Auth** — moves PII to a third party, complicating
  GDPR deletion and adding a dependency that can take the product down
- **Client-side LaTeX / WASM LaTeX** — font and rendering inconsistency
  unacceptable for a paid product
- **Single-call fallback from free provider to paid provider** —
  invisibly bills the operator for users who believe they are on the
  free tier; replaced with strict per-tier provider isolation

## Links

- Prior design (superseded): `docs/superpowers/specs/2026-04-15-cv-polisher-design.md`
- Implementation plan: `docs/adr/0002-mvp-implementation-plan.md`
- Agent tooling docs: `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`
