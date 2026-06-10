# ADR-0003: Super token pricing model supersedes credits-only pack

- **Status**: Accepted
- **Date**: 2026-04-30
- **Deciders**: yifeifelix
- **Supersedes**: ADR-0001 §1 (product shape — paid value proposition)
  and §8 (payments — credits pack semantics). ADR-0001 §13 daily cap
  numbers are revised here; refill cap (paid) is revised here.

## Context

ADR-0001 defined a **credits-only** paid model:

- £5 buys 10 **credits**
- 1 credit = 1 PDF template export
- Polish (the AI-driven CV rewrite) is powered entirely by the free-tier
  quota; payment cannot accelerate polish
- Free vs paid tier differed in (a) refill cap (3 vs 10) and (b) daily
  cap (8 vs 30) — both numbers applied to the same free-tier quota
  mechanism

While writing the quota engine during Phase 1, grilling the model
against realistic user behaviour exposed three problems with that
design.

### Problem 1 — Paid users have no way to spend money on urgency

A paid user who has burned through today's quota and wants to polish
their CV for one more application **cannot pay to skip the wait** under
the original model. They either wait for the 5-hour refill window or
settle for a stale version. The only thing payment bought them was the
right to export a nicer PDF — which doesn't help the urgent-applicant
persona at all.

Two real purchase motivations exist side-by-side:

- **Beauty motivation** — "I want the final CV to look premium for this
  one interview" → answered by PDF template rendering
- **Urgency motivation** — "I am applying to 30 companies this week and
  cannot wait 5 hours between polishes" → unanswered under the original
  model

A single-SKU product that answers **both** motivations from one purchase
converts better than trying to sell two separate SKUs for two separate
reasons.

### Problem 2 — ADR-0001's paid numbers don't survive the arithmetic

A user who polishes non-stop every 5 hours can hit the refill system
roughly **4.8 times per 24 hours** (`24 / 5 ≈ 4.8`). Therefore:

| refill_cap | theoretical 24h max | original daily cap | cap effective? |
|---|---|---|---|
| 3 (free) | ~12 polishes | 8 | yes — bites at #9 |
| 10 (ADR-0001 paid) | ~40 polishes | 30 | barely — bites at #31 |

The original paid daily cap of 30 is almost never hit in realistic use,
so it fails its stated purpose (a safety net against anomalous usage).
The original paid refill cap of 10 gives paid users a 3.3× uplift on
the free tier's refill — which crowds out the paid SKU itself. Why pay
if the free-tier mechanism is already 3× bigger?

The right relationship is that **paid's free-tier benefits are a small
perk, and the paid SKU is where the real capacity lives**.

### Problem 3 — User psychology around payment visibility

If paid users are forced to choose between "free quota" and "paid
tokens" on every polish (an earlier proposal), every click becomes a
money decision. That produces anxious usage. Contrast with making the
system **silently prefer free quota first** and only spend paid tokens
when free is exhausted:

- The user sees "I paid £5 last week and none of my 10 super tokens
  are gone yet" — the system appears to be looking after them
- Paid tokens become psychologically "free money I already spent" —
  sunk cost — reducing the friction of spending more
- This produces the "I already paid, I might as well use them freely"
  mindset that drives casual refill purchase behaviour

The spending-order decision is not a technical choice, it's a growth
mechanism.

## Decision

### 1. Unified "super token" replaces "credit" as the paid SKU

- The unit previously called a **credit** is renamed **super token**
- Pricing unchanged: **£5 → 10 super tokens** (no other pack sizes in MVP)
- Each super token can pay for **either**:
  - 1 PDF template export (previous credit use), **or**
  - 1 polish event (new use, addresses the urgency motivation)
- A super token is spent on whichever action the user triggers next
  from their remaining balance; no pre-allocation
- Super tokens do **not** expire

The name "super token" contrasts with "token" (already reserved in the
glossary for AI-provider token count) and with "quota" (the free-tier
polish entitlement). "Super" signals "capabilities beyond the free tier"
and scales to future additions (e.g. priority model access).

### 2. Polish event consumes pools in a fixed automatic priority order

When a user polishes, the system consumes one unit from pools in this
exact order:

1. `bonus_remaining` if > 0
2. free-tier refill if current refill remaining > 0
3. `super_tokens` if > 0

The user does not pick. No UI checkbox, no "use my super tokens"
button. The engine silently picks.

This is the **sunk cost** mechanic from problem 3 above: the system
looks out for the user, and paid tokens accumulate slowly, preserving
the "I've still got plenty left" feeling that makes the second purchase
easier.

### 3. Daily cap applies only to free-pool consumption

The daily cap (count of polishes per server-day) is a **defence against
bots and runaway usage of the free pool**, not a user limit. Once a
polish is paid for with a super token, the user has already paid for
the cost of that LLM call — capping it would be punishing the paying
customer.

Concrete rule:

- `bonus` consumption counts toward daily cap
- `refill` consumption counts toward daily cap
- `super_token` consumption **does not** count toward daily cap

### 4. Tier benefits rebalanced — paid gets a small free-pool perk, not a big one

| Number | Free | Paid | Rationale |
|---|---|---|---|
| `bonus` (signup) | 6 | 6 | Same — bonus is a signup gift, not tier-gated |
| `refill_cap` | 3 | **5** (↓ from 10) | Small perk: paid users get 2 extra tokens in a burst. The real paid benefit is super tokens; free-pool benefits stay modest. |
| `daily_cap` | 8 | **15** (↓ from 30) | Derived from the same "cap must realistically bite the 24h bot" rule that gave free=8. Free bot ceiling is ~12 → cap 8 bites. Paid bot ceiling at refill_cap=5 is ~20 → cap 15 bites similarly, scaled proportionally. |
| `refill_window` | 5h | 5h | Unchanged |

The 24h-bot derivation: a user hammering every 5h hits `refill_cap` ×
(24h / window) polishes, so `refill_cap=3, window=5h ⇒ ~12`, and
`refill_cap=5, window=5h ⇒ ~20`. The cap is set a few below that
ceiling (about 1/3 below) so a tireless user or script hits it.

### 5. Tier latch rule unchanged, but benefits take effect immediately

A user becomes `paid` the moment any super-token purchase completes,
and stays paid forever thereafter (even after burning all super
tokens). At that instant:

- `refill_cap` jumps from 3 to 5
- `daily_cap` jumps from 8 to 15
- `super_tokens` increases by the amount purchased (10 for the MVP
  pack)

If the user is still in the bonus phase at purchase time, `bonus_remaining`
is unchanged — the phase does not rewind. The paid perks simply take
effect when bonus exhausts and refill begins.

### 6. Cover letter generation leaves the quota mechanism entirely

Previously CONTEXT.md stated "polish and cover letter share the same
quota bucket — each counts as 1". The codebase reality is that the
cover letter button only appears on the post-polish result page, and
only when a JD was provided. A user cannot trigger a cover letter
without first having polished. That means:

- One polish naturally enables "one CV + one cover letter" as a
  bundled unit
- Charging separately for the cover letter feels like a surprise double
  charge for what is effectively one job application package

New rule: every polish event carries a **cover letter entitlement**
(see CONTEXT.md) — a one-time right to generate a cover letter bound to
that specific polish result. The cover letter call does not touch the
quota engine. Spending the entitlement is tracked in the in-flight
polish result object, which disappears on page refresh along with the
polish itself (consistent with the MVP "content-free database"
principle from ADR-0001 §6).

Future versions may allow regeneration of the cover letter at some
cost, or may persist the entitlement; both are V2 decisions.

## Consequences

### Positive

- **Single-SKU clarity**: one £5 purchase answers both purchase
  motivations (beauty + urgency), maximising conversion vs a split-SKU
  offering
- **Paid-pool independence from rate limits**: a user who paid can
  actually use what they paid for without hitting a cap they didn't
  know about. No support tickets of the form "I paid, why am I
  blocked?"
- **Sunk-cost spending dynamics**: the automatic priority order
  produces the psychological effect of "I've still got 8 / 10 super
  tokens untouched" even weeks after purchase, which correlates with
  repeat purchase
- **Paid daily cap is a real bot defence, not a number**: the 15 cap
  was derived from the same arithmetic that produces 8 for free. Both
  numbers bite in anomalous usage.
- **Simpler free vs paid free-pool story**: `refill_cap` difference of
  3 vs 5 is intuitive ("paid gets 2 more tokens per burst"), where the
  old 3 vs 10 was implausibly generous

### Negative

- **Deviation from industry-standard "credits" naming**: most freemium
  products call purchased units "credits". "Super token" is a coined
  term this project teaches users. Mitigated by the UI being the real
  source of user-facing language — CONTEXT.md pins the internal name,
  UI copy can still say "10 polishes + exports available"
- **PDF-export economics are now subsidised by polish economics**:
  polish calls cost real money (~£0.003 in Bedrock per call), PDF
  export costs near-zero CPU. A user who spends all 10 super tokens on
  polishes costs ~£0.03 against £5 received. A user who spends all on
  PDF exports costs ~£0 against £5. Either way the margin is fine;
  but the unit economics are now "average spending mix" rather than
  "one fixed cost per unit"
- **Implementation: the quota engine must know about super tokens as
  a third pool**, not just the two-phase free quota. `QuotaState`
  gains a `superTokens: number` field; the engine's consumption step
  becomes a cascade through three pools instead of two
- **Cover letter flow is now distinct from quota flow**: quota tests
  and cover letter tests are independent; neither can regress the
  other, which is good; but it means the cover letter entitlement
  needs its own unit tests separate from quota engine tests

### Neutral

- **Refund / chargeback handling unchanged from ADR-0001 §8** —
  webhook idempotency, signature verification, and the latch-once-paid
  rule all carry over. Only the pool the credits deposit into changes
  name.
- **Stripe Checkout integration unchanged** — still one-off purchase,
  no subscription, same £5 price point

## Rejected alternatives

- **Keep credits as PDF-only, and sell a separate "polish pack"** —
  two SKUs fragment the purchase decision; "do I need beauty credits
  or speed credits?" produces analysis paralysis at checkout and lower
  conversion than a single SKU
- **Let users pick "use free quota" vs "use super token" per polish**
  — forces a money decision on every click, defeats the sunk-cost
  mechanic. Explicitly rejected during grilling because the entire
  point of making one purchase unified is so the user doesn't have to
  think
- **Price polish higher than PDF (e.g. polish = 3 super tokens, PDF
  = 1)** — undermines the single-SKU simplicity. Users would
  start rationing super tokens based on intended use rather than
  using the product
- **Keep ADR-0001's paid daily cap of 30** — verified by arithmetic
  that it's a dead number at refill_cap=5 (and was marginal at
  refill_cap=10). A cap that never triggers is worse than no cap
  because it suggests protection that isn't there
- **Keep ADR-0001's paid refill_cap of 10** — 3.3× the free cap
  crowds out the paid SKU's reason to exist. Dropped to 5 (1.67× free)
  so the refill perk is a genuine small benefit, not a competing
  alternative to the paid SKU

## Links

- Supersedes: [ADR-0001 §1, §8, §13](./0001-saas-architecture.md)
- Implementation sequence: [ADR-0002](./0002-mvp-implementation-plan.md)
  — no changes to phase structure; the quota engine in Phase 1 now
  implements a three-pool cascade instead of a two-pool one
- Glossary: [docs/CONTEXT.md](../CONTEXT.md) — super token, cover
  letter entitlement, polish event, quota lifecycle entries
