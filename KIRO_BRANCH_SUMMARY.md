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


---

## 9. Session 2 Addendum — Phase 1 TDD Traps (2026-04-30)

The first session produced design. The second session — same day —
started implementation. Shape of the session: super-token pricing
re-grill, then TDD loops for the quota engine, email normalisation,
disposable blacklist, and rate-limit engine. 33 commits, 28 tests,
two ADR edits, one ADR created.

Everything in sections 1–8 above continued to hold. This section
records **only what was new or went wrong in session 2** — the traps
that a future agent starting session 3 (or starting any implementation
phase on any project) should watch for.

Each trap has the same shape: *what happened*, *why it's a trap*, and
*implication for the agent*.

---

### Trap 1 — Writing ADRs / CONTEXT.md before the decision chain is stable

**What happened.** Session 1 closed with ADR-0001 + ADR-0002 + CONTEXT.md
all written and committed. Session 2 opened with me recommending TDD
start; Yifei asked about cover-letter quota semantics, then about
paid-tier token behaviour, then about daily cap. Each question
unwound a decision the written ADR had fossilised. Result: by the
time super-tokens pricing landed, CONTEXT.md's §Polish event, §Tier,
§Daily cap, §Credits pack sections all had to be rewritten, plus an
entire new ADR-0003, plus in-place "superseded" annotations across
ADR-0001 §1, §3, §8, §13.

**Why it's a trap.** Written documents become gravity. Once committed
they feel like "real" decisions, and reopening them feels like going
backwards. But the actual cost of written reversal is higher than
the cost of pausing before writing — every affected section needs
manual audit, every quoted number has to be chased down.

**Implication for the agent.** *Do not write ADRs or CONTEXT.md
during the design session.* Take structured notes in the running
conversation context, and write the docs after the user has
concretely validated the decision chain — ideally by working through
one or two specific scenarios with the numbers. An ADR whose numbers
haven't been attacked with arithmetic is not yet a stable ADR.

---

### Trap 2 — Configuration numbers given from feel rather than arithmetic

**What happened.** ADR-0001 set paid `refill_cap = 10` and paid
`daily_cap = 30`. Both came from "paid should be more generous than
free", no calculation. In session 2 Yifei asked "can an always-awake
user actually hit 30?" — the 24h bot ceiling at refill_cap=10 is
~40, so the 30 cap almost never triggers. The numbers had been
decorative.

The corrected derivation: a non-stop user maxes `refill_cap ×
(24 / window_hours)` polishes per day. Free: `3 × (24/5) ≈ 12`, so
cap 8 bites at polish 9. Paid: `5 × (24/5) ≈ 20`, so cap 15 bites at
polish 16. Same ratio, both caps now do the job.

**Why it's a trap.** Every number in a rate-limit / quota / abuse-
defence system is either doing work or decorative. Decorative numbers
are worse than no number because they suggest protection that isn't
there — and because new arrivals to the codebase assume they were
chosen carefully.

**Implication for the agent.** When proposing any configured numeric
threshold, **show the derivation in the same message as the number**.
If the derivation is "matches what similar products do", say so — do
not present it as if it were tuned. Do not commit a number to an ADR
until the grill has produced the derivation.

---

### Trap 3 — "Preserve the ADR" bias overriding the user's business motive

**What happened.** When Yifei proposed that paid tokens should be
usable for polish acceleration (not just PDF export), my first
recommendation was Option A — keep ADR-0001 as-is. My reasoning was
"the ADR has just been written and has coherent rationale; changing
it now costs a rewrite". That reasoning is technically correct but
structurally wrong: the ADR was stable, but the *product motive*
hadn't been. One-SKU pricing that answers two purchase motivations
converts better than a single-motivation pricing model. The ADR
needed to move.

**Why it's a trap.** Programmer bias is towards *keep existing
decisions consistent* because code consistency is cheap and rewrites
are expensive. Product bias is towards *maximise revenue per user*.
When those conflict, the agent must resist its own pull toward
stability.

**Implication for the agent.** When your instinct is to recommend
"keep the existing ADR", check whether you're defending *the
document* or *the underlying motive*. If the user's reframe introduces
a new motive that isn't mentioned in the existing ADR, the ADR is
probably wrong, not the reframe. Ask: "is this ADR the right shape
of decision, or just the shape that happened to get written first?"

---

### Trap 4 — CONTEXT.md rules not self-consistent with engine arithmetic

**What happened.** CONTEXT.md §Polish event said "free-pool polishes
(bonus or refill) insert a quota_events row so the 5-hour refill
window can be computed". Plausible at writing time — both kinds of
consumption are free-pool events, so both should be counted.

But during TDD cycle 8 I noticed: the quota formula is `refill_cap −
count(events in last 5h)`. If bonus consumption inserts a row at
time T, the phase-3 first refill at T+5h arrives with one row
already inside the window — the calculated refill is `3 − 1 = 2`,
not the correct `3`. CONTEXT.md had a rule that quietly broke the
cap at the moment it mattered most.

Fix: bonus consumption does **not** insert quota_events rows. Refill
consumption does. CONTEXT.md rewritten accordingly (commit 257a6d3).

**Why it's a trap.** Rules that interact across phases or tiers can
be independently sensible and collectively wrong. The failure doesn't
appear on one of the phases — it appears at a *transition*.

**Implication for the agent.** Whenever CONTEXT.md or an ADR states
a rule about *how* something is recorded / counted / computed, trace
the rule through every lifecycle transition it touches. If a rule
says "both X and Y insert a row", check whether consuming X does
anything to the window that Y owns. "It's symmetric" is not a proof.

---

### Trap 5 — Negative ADR clauses hiding positive assumptions

**What happened.** ADR-0001 §6 schema said `rate_limit_events ... —
observability only, not used for enforcement`. That negative clause
silently presumed enforcement would live elsewhere (in-memory, Redis).
MVP has neither: in-memory doesn't survive multi-process, and Redis
was rejected as over-engineering. Rate-limit enforcement therefore
had to use `rate_limit_events` after all. The clause was not wrong
— it was stale as soon as a later decision removed the unstated
alternative.

**Why it's a trap.** Every "we don't do X here" clause assumes X is
done somewhere else. When later decisions eliminate the "somewhere
else", the negative clause silently flips from true to load-bearing
— and nothing draws attention to it.

**Implication for the agent.** When writing an ADR clause that says
"not used for Y" or "never Z", spell out *where Y / Z does live*.
"Observability only, not enforcement — enforcement lives in
`ratelimit.ts`'s in-memory cache" stays honest across later refactors;
the naked negative does not.

---

### Trap 6 — Defence-in-depth inside pure engines — when yes, when no

**What happened.** Two engines added behaviour that was already the
caller's responsibility:
- `isDisposable` lowercased the domain internally even though the
  caller contract promised normalised input.
- `isAllowed` filtered `recentAttempts` by window even though the
  caller's SQL already applied the same window.

Both were good choices. A future caller who forgets one step doesn't
create a security gap; the engine notices.

Not every engine should do this. The quota engine does **not**
internally re-validate `QuotaState` fields (e.g. it trusts that
`bonusRemaining >= 0`). That's the right call — an engine that
re-validates every input turns into a defensive mess.

**Why it's a pattern worth naming, not a trap.** The lines between
"trust the caller", "defence in depth", and "validate inputs" are
load-bearing and not obvious.

**Implication for the agent.** Use defence-in-depth **only** when:
1. The extra work is O(1) or trivially bounded (lowercase a short
   string, filter a short list).
2. The consequence of the caller getting it wrong is a *security*
   failure (a disposable domain accepted, a rate limit bypassed), not
   just a functional one.
3. The re-done check is *exactly the same logic* as the caller's,
   not a new business rule.

If any of those three is missing, keep the engine lean and document
the caller contract in a comment.

---

### Trap 7 — Adding a TDD branch regressed previously-passing tests

**What happened.** Cycle 4 of the quota engine added the `refill`
pool branch to `canConsume`. The naive implementation — "if bonus=0,
compute refillRemaining, if >0 allow" — immediately regressed cycle 2
and cycle 3, because those tests set up "awaiting first refill" state
where `slidingTimerStartedAt` is non-null but `recentFreepoolEvents`
is empty. The new branch saw empty events and greenlit the polish,
bypassing the phase-2 gate.

Only after `npx vitest run` showed 2 failures did I add the
`slidingTimerStartedAt === null` guard. Quick fix, but should have
been caught before running the test.

**Why it's a trap.** TDD's red-green-refactor loop assumes you'll
check "did the change regress anything" by running the full suite.
That check works. But it's reactive — you write a bad branch, run
tests, fix it. Better: before writing the branch, think about what
other state combinations this branch will now match.

**Implication for the agent.** When adding a new branch to a
cascading policy function, check *every already-passing test's state*
against the new predicate. If any previously-denying state would now
match the new branch, the predicate needs a guard before writing
code. It's a 30-second audit that prevents a round-trip.

---

### Trap 8 — Descriptive tests vs driving tests

**What happened.** Three tests across the session (cycle 7 quota,
cycle 2 disposable, cycle 4 rate-limit) passed immediately without
a red step. Each was *describing* an invariant the implementation
already satisfied (bonus-over-refill priority, mainstream domain
falseness, exclusive window edge) rather than driving new code.

The TDD skill is silent on this. Strict TDD says these tests
shouldn't be written — if there's no red step, the test isn't
earning its place. But they earn their place as *regression locks*:
a future refactor that flips the priority order or the boundary
inequality is caught by them.

**Why it's a trap.** Writing descriptive tests without distinguishing
them from driving tests corrodes TDD discipline — suddenly every
"just to be safe" idea becomes a test. Writing none of them leaves
load-bearing invariants unprotected.

**Implication for the agent.** When a test passes immediately, name
it in the commit message — `test(...)` prefix, not `feat(...)`,
and the body should say *"descriptive, did not go red first"* plus
the invariant being locked. This keeps the distinction explicit in
the git history and stops the practice from quietly becoming
"tests for the sake of coverage".

Rule of thumb: **if you can't describe a future refactor that would
make this test fail, the test doesn't earn its keep.**

---

### Trap 9 — "One test at a time" applied too literally to parameterised cases

**What happened.** Cycle 5 of email normalisation needed to cover
five malformed-input cases (empty / whitespace / no @ / empty local
/ empty domain). Running strict TDD produces five red-green cycles
and five commits. Over-ritualised for something that's one business
rule ("reject malformed inputs") with five boundary cases.

I collapsed them into one `it.each` block and one commit. The red
step still happened — all five failed at once, then all five passed
at once.

**Why it's a trap.** The TDD skill's wording suggests "one test →
one implementation". Taken literally, parameterised cases violate the
rule. Taken pragmatically, they express "one behaviour with five
boundary points" in the minimum amount of ceremony.

**Implication for the agent.** TDD discipline is "**one behaviour at
a time**", not "one assert at a time". When a behaviour has multiple
boundary cases that share logic, `it.each` is the right tool —
provided the red step still fires for every case before the green
step. If any case is green from the start, split it out as a
descriptive test (trap 8).

---

### Trap 10 — Time-as-dependency vs time-as-parameter

**What happened.** Every time-sensitive engine in this session
takes `now: Date` as an explicit parameter. Not a single call to
`Date.now()` or `new Date()` inside engine code. As a consequence,
tests use literal `new Date("2026-05-01T10:00:00Z")` and their
arithmetic is trivial — no `vi.useFakeTimers()` needed anywhere.

This is not an innovation; it's the textbook "dependency injection
for the clock" pattern. But session 2 made the payoff concrete: 28
tests exercising 5h sliding windows, 1h rate windows, daily caps,
and phase-3 first refills, with zero fake-timer infrastructure.

**Why it's worth pinning as a trap even though we got it right.**
The default JavaScript/TypeScript instinct is to call `Date.now()`
inline — "it's just the current time, why not?" — and then you end
up reaching for fake timers, sinon, `vi.setSystemTime()`, and a
tangled test setup.

**Implication for the agent.** **Every pure engine function that
cares about time takes `now: Date` as a parameter.** The route
handler supplies `new Date()` at the call site; the engine never
reads the wall clock. This is a rule, not a convention. Violating
it immediately drags fake-timer infrastructure into the test suite.

---

### Trap 11 — Commit-message follow-up promises with no tracking

**What happened.** Two commits in session 2 ended with "this will be
fixed in a follow-up doc commit":
- `feat(quota): recordConsumption emits mutations for bonus` (commit
  f5d23fb) — promised to tighten CONTEXT.md §Polish event wording.
- `feat(rate-limit): tracer bullet for the rate limit engine` (commit
  2e6545c) — promised to update CONTEXT.md §Rate limit event.

Both promises *were* kept. But the mechanism was purely "the agent
remembered before context compaction". On a longer session or with
a context reset between writing and following up, either could
easily have been forgotten.

**Why it's a trap.** Documentation drift from unfulfilled follow-ups
is the classic slow-poison for codebases. "I'll update the doc later"
scales terribly.

**Implication for the agent.** Two rules:
1. **Prefer not deferring.** If you know a doc update is needed, do
   it in the same cycle (but in a separate commit — see trap 12).
2. **If you must defer,** create a concrete todo entry immediately,
   never a mental note. The todo tool exists for exactly this.

---

### Trap 12 — Tooling install and first usage must be separate commits

**What happened.** When installing Vitest I nearly bundled "install
vitest" and "first test passes" into one commit. Stopped in time,
made two commits:
- `chore(test): install vitest for Phase 1 TDD` (9763916)
- `feat(quota): tracer bullet for the quota engine` (b051c21)

The split paid off every time I contemplated resetting the quota
engine work — the tooling commit was a stable base to reset to
without losing Vitest.

**Why it's a trap.** Bundled "install X + first use of X" commits
are hard to revert independently. If the first-use code is wrong,
reverting it takes the install with it, forcing a re-install on the
next cycle.

**Implication for the agent.** Every tooling / dependency install is
its own commit with a `chore(...)` prefix. The first piece of code
that uses the tool is a separate `feat(...)` commit. Even if you
are writing the code five minutes later, split the commits.

---

### Trap 13 — Skipping the pre-TDD grill

**What happened.** Yifei opened session 2 with "use tdd skill, start
Phase 1". My first reaction was to install Vitest and write the
tracer-bullet test. I stopped myself — ran a mini-grill instead
(quota engine signature, state shape, denial reason shape, consumption
order). That grill uncovered super-tokens pricing, cover-letter
entitlement, paid-tier number tuning — all of which would have been
painful mid-TDD discoveries.

Had I started TDD immediately, cycle 1 would have been an `is this
just bonus?` test with two-pool thinking baked in. Cycle 8 would
have discovered the third pool and forced a full rewrite.

**Why it's worth logging as a trap even though we avoided it.**
The rhythm of "user says go → agent starts" is productive most of
the time. It's wrong when the ADR→code mapping has gaps the ADR
doesn't reveal.

**Implication for the agent.** Before starting TDD on a new module,
check three things:
1. Is the module's interface fully specified by the existing ADRs
   / CONTEXT.md? Or are there signature-level questions unanswered?
2. Does the domain model have any ambiguity the tests would
   inadvertently fossilise? (Cover letter as "polish event" vs "own
   entity" was exactly this.)
3. Are any of the numbers in the module's rules un-derived?

If any of those is a "no, there's a gap" — grill first. One grill
cycle is cheaper than six TDD rewrites.

---

## 10. Session 2 Output (for the record)

- **5 ADR / CONTEXT changes**: ADR-0003 created, ADR-0001 partially
  superseded, CONTEXT.md refactored for super tokens + cover letter
  entitlement + rate-limit dual-role.
- **4 pure-logic modules fully TDD'd:**
  - `src/lib/quota/engine.ts` — 12 tests
  - `src/lib/email/normalise.ts` — 9 tests
  - `src/lib/email/disposable.ts` — 3 tests
  - `src/lib/rate-limit/rate-limit.ts` — 4 tests
- **33 commits** on branch `kiro`, linear history, not pushed.
- **28 tests**, all green, ~250ms total run time.
- **Tooling added**: Vitest only. No MSW, no in-memory SQLite
  harness, no fake timers.

What's left in ADR-0002 Phase 1: schema + NextAuth wiring, signup
route (uses email + disposable + rate-limit modules), `/api/polish`
rewrite to use the quota engine, prompt Zod validation, Stripe
checkout in test mode, template rendering via Puppeteer.

---

## 11. New One-Line Summary for Session 2 onward

> Keep numbers derived, negative ADR clauses paired with their
> positives, CONTEXT.md consistent across phase transitions, and
> engines pure with `now` as a parameter. Grill before TDD. Split
> tooling commits from feature commits. Mark descriptive tests
> explicitly.
