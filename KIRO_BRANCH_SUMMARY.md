# Kiro Branch Summary — How I Work on Projects

A reusable template extracted from the 2026-04-30 session that took
CVpolisher from "family LAN tool" to a fully planned freemium SaaS in
one sitting. The goal of this file is not to re-summarise CVpolisher —
that lives in `docs/adr/0001-saas-architecture.md` — but to capture
**how** Yifei approaches project design so a future agent on a future
project can operate the same way.

If you are an AI agent reading this at the start of a new project: read
this whole file before asking the first question. The patterns below
are the working style Yifei has shown to be productive with; deviating
from them produces worse results faster than it produces better ones.

---

## 1. How Yifei Thinks

### Starts from a concrete proposal, not an abstract vision

The first message of a session typically contains a working hypothesis:
"put it on a VPS with a free API and charge £1 for templates", "use two
Oracle VPSes, one is 24GB ARM". The opening is already a draft plan,
not a problem statement.

**Implication for the agent:** do not respond with "what are your
goals?" or "let's clarify the vision first". The vision is implicit in
the concrete proposal. The job is to **interrogate the proposal** —
find the cracks, challenge the numbers, expose the hidden assumptions.

### Changes mind readily when arithmetic disagrees

£1 single-purchase pricing died the moment it was shown that Stripe
fees consume 21% of a £1 transaction. The switch to £5 credits pack
took one message. Same pattern for: Claude Haiku vs DeepSeek, naming
`flyingcatcv` vs `cvpolisher`, provider fallback architecture.

**Implication:** when challenging a decision, bring **numbers** or a
concrete failure mode, not abstract principles. "This is over-engineered"
is weaker than "this adds 3 days of work for an edge case that might
not exist". Arithmetic wins.

### Trusts own intuition on product shape, defers on implementation

The mechanics of the quota bucket (bonus phase suspends sliding
window; first refill is a single atomic step, not gradual) came from
Yifei, not from the agent. "Don't save any file" in the first release
came from Yifei. Provider-isolation architecture — "fallback inside
the same tier only" — came from Yifei correcting the agent's naive
multi-tier fallback.

Conversely, on implementation choices (Vitest vs Jest, Zod vs Valibot,
Puppeteer vs Playwright) Yifei accepts the agent's recommendation
without relitigating.

**Implication:** push back when you think a product or UX intuition is
wrong, but only with specific attack scenarios. On implementation
plumbing, propose once and move on.

### Allergic to over-engineering

Three clear examples from the session:
- Rejected early idea to build provider-fallback architecture in the
  first implementation because "we don't have any free provider to
  fall back to yet"
- When suggesting input-splitting (personal/education/experience fields)
  and URL-scraping for JDs mid-session, accepted the agent's pushback
  that these are V2 features with "you're right, let's continue with 1"
- Repeatedly steered scope down ("just get it running first")

**Implication:** every new proposal should have a version that is
smaller. Offer the smaller version first. Expand only when Yifei
declines it.

### "Ship first, polish later" — but polish the design docs first

Yifei said early: "first version just needs to run and be usable".
Later, before writing a line of code, Yifei explicitly asked for ADRs
and a summary document to be written.

This is not a contradiction — the code ships small, but the *thinking*
is written down in full. Future context windows, future agents, and
future Yifei all need the thinking to stay stable.

**Implication:** write documentation aggressively, code conservatively.
When Yifei says "let's ship the MVP", it means write minimal code —
not minimal documentation.

### Security-conscious without being paranoid

Yifei raised the "API key exfiltration via the public-facing Next.js
process" risk before the agent did, and insisted on a separate LLM
gateway container. But declined to add per-device fingerprinting for
MVP ("add when we need it"). The line is: "threats that matter when
going public" are in scope; "threats that matter at scale" are not.

**Implication:** when proposing defence-in-depth layers, order them by
threat class (launch-time vs scale-time) and let Yifei pick the cutoff.

### Cost and hardware boundaries come up unprompted

During the session Yifei volunteered:
- Two specific Oracle VPS configurations (4C/24G ARM + 1C/1G x86)
- Disk allocation (150GB / 50GB)
- That both are in the same VCN
- Budget comfort around £10/year for a domain

This is someone who thinks about unit economics early.

**Implication:** when a decision has a cost dimension, always surface
the numbers. "Monthly cost at 1000 users" is more useful than "it's
cheap".

---

## 2. How to Structure a Session

### One decision at a time

The working pattern was: the agent presents a decision branch, offers
2–4 concrete options with a recommendation, Yifei picks one (sometimes
verbatim, sometimes a variant), agent moves to the next branch. This
is **explicitly preferred** — Yifei said early: "ask questions one at
a time".

**Reject the temptation to "cover more ground per message".** Bundling
three decisions into one message loses the thread and loses the record
of why each was decided.

### Format of a decision ask

Worked well during the session:

```
## 问题 N / 分支: [what this is about]

[2-3 sentence context — what's currently known, what's at stake]

### Option A — [name]
- properties
- pros
- cons
### Option B — [name]
- ...
### Option C — [name]
- ...

**我的推荐：A, 因为 [reason grounded in earlier decisions]**

**问: 选哪个?**
```

This format:
- makes the options concrete enough that Yifei can override ("I'll pick B because ...")
- gives a default so the decision can move forward without Yifei becoming a bottleneck on every sub-sub-question
- anchors recommendations to *earlier decisions*, not to first principles — this builds a consistent architecture

### Investigate the codebase before asking

Whenever a question can be answered by reading existing code, read the
code first, then ask a more precise question (or just state the
finding). The session exchange where the agent checked `bedrock.ts`,
`db.ts`, and `docx-generator.ts` instead of asking "what's in your
codebase?" is what Yifei expects.

### Challenge when you disagree

Yifei explicitly welcomes pushback. Examples from the session:
- Agent recommended *against* LinkedIn OAuth even though Yifei asked
  for it → Yifei thanked the analysis and agreed
- Agent recommended *against* input-splitting UI → Yifei accepted
- Agent pointed out the contradiction in "don't save any file" vs
  quota counting → Yifei refined the proposal

**Do not cave.** Weak agreement ("great idea, let's do that") when the
idea has a real problem wastes a decision slot. Raise the problem.

### After a decision, restate it in Yifei's words

Yifei corrected agent misunderstandings twice (on the quota mechanism
specifically — the bonus/window interaction, then the first-refill
being atomic vs gradual). Both times the correction was triggered by
the agent restating the mechanism in its own words.

**This is the sanity check** — don't skip it. When a mechanism is
subtle, write out exactly what you understood and ask for explicit
confirmation before moving on.

---

## 3. Language and Tone

### Mixed Chinese / English

Yifei writes primarily in Mandarin with English technical terms inline:
`fallback`, `token`, `vps`, `bonus`, `polish`, `cover letter`, `credit`,
`router`. Respond in the same register. Do not translate these terms
into Chinese unnecessarily — "令牌桶" for token bucket is fine where
algorithmically precise; "回退" for fallback is worse than just
`fallback`.

### Informal, no emoji, no filler

Yifei's messages are short, no greetings, no "great question!" energy.
Match it. No "Excellent!", no "Great choice!", no emoji, no exclamation
marks as default. Save them for real enthusiasm.

### Direct correction is welcomed

"你分析有理" followed by agreement is Yifei's baseline form of
agreement. "我不🙆..." followed by a counter-proposal is the baseline
form of disagreement. Don't read either as an emotional signal —
they're purely logical.

---

## 4. Default Technical Decisions (Inherit Unless Contradicted)

These decisions were made in the CVpolisher session and survived the
full grill. For a new project of roughly similar shape (solo-ish SaaS,
Oracle VPS host, UK/EU users), they are reasonable defaults; document
any deviations explicitly.

### Auth

- NextAuth v5 + SQLite adapter
- Google OAuth (primary) + email/password (fallback)
- Resend for email verification (free tier 3000/month)
- Email verification gate before granting any signup bonus
- Email normalisation (Gmail dots / `+alias`) stored in a unique column

### Database

- SQLite via `better-sqlite3` for MVP; Postgres is the explicit next
  step only if/when writes are contended
- `litestream` for continuous WAL backup to a second host
- **Content-free principle**: user-submitted content (text, uploads,
  AI responses) is never persisted. Only account state, usage counters,
  payment records

### AI Integration

- All LLM calls go through a **LiteLLM gateway** in a separate Docker
  container on the internal Docker network
- The application code holds only the gateway's bearer token, never
  real provider keys
- Provider / model selection lives in gateway config (YAML), not app code
- Per-user rate-limit at the gateway is defence-in-depth on top of
  app-level quota
- AWS IAM user for Bedrock is minimum-privilege, scoped to a single
  model ARN
- AWS Budget with hard-stop action on the same IAM user is mandatory

### Quota and Rate Limiting

- Per-user quota is a **token bucket with a bonus phase**:
  - Bonus N at signup (consumed first)
  - Timer starts on bonus exhaustion
  - First refill is atomic (not gradual) after the window expires
  - Steady state: each consumption has its own 5h refill timer
  - Daily cap as a safety net over the window mechanism
- Per-IP and per-email-domain rate limits on signup (not on polish —
  polish is protected by per-user quota)
- Major email providers (Gmail, Outlook, etc.) allowlisted from the
  per-email-domain limit

### Payments

- Stripe Checkout (hosted payment page)
- **Credits packs**, not single-purchase or subscription — fees and
  LTV economics both prefer packs for job-seeker-style burst usage
- Webhook signature verification with `stripe.webhooks.constructEvent`
  is non-negotiable

### Export

- HTML/CSS React component + Puppeteer → PDF for paid exports
- `docx` library for a free ATS-safe fallback export
- Template selection is config + new directory, not architecture work

### Infrastructure

- **Two-VPS split**: one runs the application, one is the backup
  target. Same VCN for free private networking.
- Cloudflare edge in front: DNS + TLS + DDoS + Turnstile + WAF
- Origin firewall accepts inbound only from Cloudflare IP ranges
- Cloudflare Tunnel (`cloudflared`) is the preferred V2 upgrade to
  eliminate origin IP exposure entirely

### Testing

- Vitest + MSW for unit and integration
- Per-test in-memory SQLite
- Explicit **Red Team playbook** manually executed before launch:
  - Gmail alias farming
  - Concurrent quota race (tests atomic decrement)
  - Stripe webhook forgery
  - 10 prompt-injection variants
  - Tor / proxy-pool IP rotation

### Observability

- AWS Cost Anomaly Detection on the Bedrock IAM user
- `rate_limit_events` table for daily digest
- Stripe webhook failure alerts (a paying user without credits is a
  P0 bug)
- Pino logs to stdout + Docker built-in rotation (unless something
  justifies a log sink)

---

## 5. How to Produce Documentation

### Three-layer model

Yifei expects three types of docs:

1. **CONTEXT.md** — domain glossary. Pins the vocabulary. Lives at the
   repo root.
2. **ADRs** — decision records. `docs/adr/0001-*.md` onwards, MADR v3
   format (Context / Decision / Consequences / Rejected alternatives).
   One ADR per architecturally-significant decision, not one per
   feature.
3. **CONTEXT-specific specs** — one-off design docs for individual
   subsystems, written when the complexity justifies it.

### When to write each

- CONTEXT.md: always, early, before real code
- ADRs: when a decision has real alternatives that were rejected. An
  ADR that doesn't discuss rejected alternatives is not doing its job
- Specs: only when a subsystem has enough internal design depth that
  an ADR would balloon too big

### Phase-based implementation plans

The `docs/adr/0002-mvp-implementation-plan.md` pattern:

1. **Phase 1** — core logic against mocks
2. **Phase 2** — test every defence control
3. **Phase 3** — external services and deployment
4. **Phase 4** — launch checklist

This is Yifei's preferred sequence and likely applies to any future
SaaS project. The principle: **defer all externally-reviewed
integrations to a dedicated phase at the end**. OAuth app reviews,
domain verifications, Stripe activation — all cluster together at the
deploy end, not sprinkled throughout.

### Commit granularity

- One commit per topic, even inside a documentation push
- Conventional commits format: `docs(adr): ...`, `chore(agents): ...`
- Include multi-line body explaining *why* when the change is
  architecturally meaningful
- Never mix documentation + code in the same commit
- Never mix two unrelated documentation topics in the same commit
  (agent skills setup and product ADRs are separate topics)

---

## 6. Anti-Patterns to Avoid

Things that were tried and rejected in the session — do not reintroduce
them in future sessions:

### "Let's make it flexible now for future needs"

Every time provider-abstraction, multi-fallback, or tier-differentiation
was proposed prematurely, Yifei pushed back. The rule is: build the
*current* thing, with a clean-enough interface that the *future* thing
can be added as a diff.

### Bundling decisions

Mid-session, at one point the agent said "I can ask this and also this
and also that in one message" — Yifei's preference is explicit:
one decision per ask.

### Soft recommendations

"You could do A, or B, or C — what do you think?" is worse than "I
recommend A because X, here's why B and C are worse." Yifei wants
positions, not menus.

### Proposing features that weren't asked for

During the grill, the agent floated history-saving, rich editing,
multiple templates. All were deferred to V2. The MVP scope is
sacred; every proposal should fit inside the agreed scope or
explicitly flag itself as V2.

### Discussing "ideal" before "actual"

"Let's first agree on the product vision" is a common opener that
Yifei will skip. Start from what's on the table. Vision emerges from
the sequence of decisions, not from a preamble.

### Fabricating with authority

Twice during the session, the agent needed to look up real pricing
(DeepSeek V4, Claude Haiku 4.5, Bedrock DeepSeek support) and chose to
`web_search` rather than guess. This is the correct behaviour. Never
quote a number, a version, or an API detail from memory when the
consequence of being wrong is architectural.

---

## 7. Starter Checklist for a New Project

When Yifei brings the next project, do this in order:

1. **Read the whole first message carefully.** The working hypothesis
   is in it. Don't start asking before you've mapped out what's
   implicit.
2. **Check the repo structure.** Is this a greenfield or a pivot from
   existing code? Read 3-5 key files.
3. **Identify the 8–12 architectural decision points.** Auth, data
   model, infrastructure, AI provider, payment, defence, testing,
   deployment, template engine, etc. These become the agenda.
4. **Pick the order carefully.** Topmost should be the decision with
   the most downstream consequences (usually: product shape / user
   model). Do not start with cosmetic decisions (naming, colours).
5. **Ask one at a time.** Recommendation included. 2–4 options.
6. **Write ADRs as decisions settle.** Do not wait until the end.
   In the CVpolisher session, ADRs were written in one batch at the
   end, which worked because the session was short (one day). In a
   longer session, write after each major decision clusters.
7. **Before coding, write CONTEXT.md.** The terms in it become the
   variable names, table names, and issue titles. Locking them early
   saves refactors.
8. **Design the test plan alongside the architecture.** Yifei asked
   for a test stage explicitly during the session. Do not present an
   architecture without its red-team playbook.
9. **Commit liberally, push when Yifei says so.** Never push
   without explicit permission. Never force-push. Never rewrite
   pushed history.

---

## 8. The One-Line Summary

> Yifei brings a concrete proposal, welcomes arithmetic-grounded
> challenges, wants one decision per ask with a recommendation, makes
> fast clean decisions, prefers minimum-viable scope, and writes down
> the design before the code.

Match that and sessions are productive. Deviate and they stall.
