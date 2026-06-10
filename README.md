# CV Polisher

AI-powered CV optimisation. Rewrites CVs against job descriptions,
scores ATS compatibility, generates cover letters.

> **Status — work in progress.** This repository is mid-rewrite from
> a self-hosted LAN tool to a freemium SaaS. Authoritative design
> docs:
>
> - [`docs/adr/0001-saas-architecture.md`](docs/adr/0001-saas-architecture.md) — product shape, account model, quota, payments
> - [`docs/adr/0002-mvp-implementation-plan.md`](docs/adr/0002-mvp-implementation-plan.md) — phased implementation plan
> - [`docs/adr/0003-super-token-pricing-model.md`](docs/adr/0003-super-token-pricing-model.md) — paid-tier pricing
> - [`docs/CONTEXT.md`](docs/CONTEXT.md) — domain glossary (authoritative when terminology conflicts with code)
>
> What works right now: pure-logic modules (quota engine, rate-limit
> engine, email normalisation, disposable blacklist) plus the content-
> free Drizzle schema. NextAuth wiring, signup / login routes, and the
> polish-flow rewrite are not yet wired up.

## Developer setup (new machine)

The path from `git clone` to running tests, on a fresh machine.

### 1. Node

Requires **Node 20.9+ or Node 22.x** (LTS). Node 21.x is *not*
supported — `better-sqlite3@12` does not ship binaries for it. If you
use `nvm`:

```bash
nvm install 22
nvm use 22
```

Verify:

```bash
node --version   # should print v20.x or v22.x (not v21.x)
```

### 2. Native build dependencies for `better-sqlite3`

`better-sqlite3` is a native module. On first install it downloads a
prebuilt binary for your platform; if no prebuild matches it falls
back to compiling from source and will need a working C++ toolchain.

- **macOS** — install Xcode Command Line Tools: `xcode-select --install`
- **Linux (Debian/Ubuntu)** — `apt install -y build-essential python3`
- **Windows** — install "Desktop development with C++" via Visual Studio Build Tools

If `npm install` finishes with no `better-sqlite3` compile errors, you
got the prebuilt binary and this step was unnecessary.

### 3. Install Node dependencies

```bash
git clone <repo-url>
cd CVpolisher
npm install
```

This reads `package.json` + `package-lock.json` and reproduces the
exact dependency tree. `package-lock.json` is the source of truth for
versions — don't hand-edit it.

### 4. Environment variables

Copy the example file and fill in the values you need:

```bash
cp .env.local.example .env.local
```

The example documents every variable. For running the **test suite**
(`npm test`), no env vars are needed — the engines are pure and do
not hit any external service.

For running `npm run dev` against real LLMs, you'll need at least one
provider key (Bedrock / OpenRouter / Google Vertex). During Phase 1
development, the engines and DB can be exercised without any provider
key.

### 5. Generate the initial database

```bash
npm run db:generate    # only if you touched src/lib/db/schema.ts
```

This uses `drizzle-kit` to emit SQL migrations in `drizzle/` from the
TypeScript schema. **Checked-in migrations in `drizzle/` are the
authoritative schema**; running `db:generate` after a fresh clone is
a no-op if the schema hasn't changed since the last committed
migration.

The runtime client (`src/lib/db/index.ts`) applies any pending
migrations on first import, so you don't run a separate `migrate`
command — just start the app and it catches up.

The SQLite file itself lives at `data/cvpolisher.db` (gitignored).
It's created automatically on first run; delete it to reset.

### 6. Running

```bash
npm test              # 53 unit tests, ~3s — should be green
npm run dev           # dev server on http://localhost:3443
npm run build         # production build
npm run lint          # ESLint
```

### Optional — Drizzle Studio

```bash
npm run db:studio     # open a browser UI to inspect the SQLite DB
```

## Authentication (v1)

v1 ships **Google OAuth only** — NextAuth v5, Drizzle adapter,
database sessions. Spec: `docs/adr/0005-v1-auth-shape.md`. v2 adds
email + password; see `docs/BRANCH_KIRO_STATUS.md` for the deferral
rationale.

### Google Cloud Console — OAuth client (one-time, human-only)

1. Open <https://console.cloud.google.com/apis/credentials> and pick
   (or create) a project.
2. APIs & Services → OAuth consent screen → **External**, Testing
   mode (limits sign-in to listed test emails until published).
3. Scopes: `openid`, `email`, `profile`.
4. Credentials → Create Credentials → OAuth client ID → **Web
   application**.
5. Authorised redirect URI:
   `http://localhost:3443/api/auth/callback/google` (add the
   production host's equivalent when it exists).
6. Copy the Client ID and Client secret into `.env.local`
   immediately — the secret is shown in full only once.

If the console UI has drifted from these steps, the intent to hold
onto is: *create an OAuth 2.0 Web application client with
`/api/auth/callback/google` as a redirect URI*.

### Required env vars

| Key | How to get it |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 33` (or `npm exec auth secret`) |
| `AUTH_GOOGLE_ID` | OAuth client from the Console steps above |
| `AUTH_GOOGLE_SECRET` | Same dialog as the ID |

All three must be set in `.env.local` before `npm run dev` for the
sign-in flow to work. Leave `AUTH_TRUST_HOST` unset in dev (NextAuth
auto-trusts when `NODE_ENV !== "production"`); set it to `true` in
production behind a reverse proxy.

### What's gated

`POST /api/polish`, `/api/cover-letter` and `/api/download` return
`401 {"error":"unauthorised"}` without a signed-in session. Sign in
at `/login`. New users get the signup bonus on first sign-in
(`events.createUser` → `app_users_meta`).

## Design reference — key decisions

If you're reading the code and something seems arbitrary, it probably
isn't. The ADRs explain the *why*:

- **"Content-free database"** — CV and JD text are *never* persisted
  anywhere. The DB only holds accounts, quota state, payments, and
  rate-limit event counts. See [ADR-0001 §6](docs/adr/0001-saas-architecture.md).
- **Super tokens vs credits** — the paid entitlement unit is called
  "super tokens", not credits. `app_users_meta.super_tokens` is the
  column. See [ADR-0003](docs/adr/0003-super-token-pricing-model.md).
- **Quota lifecycle** — four-phase token bucket (bonus → awaiting
  first refill → first refill → steady state) with a 5h sliding
  window. See [CONTEXT.md §Quota lifecycle](docs/CONTEXT.md).
- **Time as parameter** — every pure engine takes `now: Date` as an
  argument. Engines never call `Date.now()`. See
  [KIRO_BRANCH_SUMMARY §9 Trap 10](KIRO_BRANCH_SUMMARY.md).
- **Rate-limit event table is dual-role** — both enforcement and
  observability, keyed on `(key_type, key_value)`. See
  [CONTEXT.md §Rate limit event](docs/CONTEXT.md).

## Project structure (Phase 1)

```
src/
  lib/
    db/
      index.ts              # Drizzle client (singleton, WAL mode)
      schema.ts             # authoritative column list
    quota/engine.ts         # pure-function quota policy
    rate-limit/rate-limit.ts  # pure-function rate-limit policy
    email/normalise.ts      # Gmail dots/+aliases stripping
    email/disposable.ts     # blacklist check
    db.ts                   # LEGACY LAN-tool code — @deprecated,
                            # retiring with the /api/* route refactor
  app/
    api/polish/             # LEGACY — will be rewritten in Phase 1
    api/cover-letter/       # LEGACY — ditto
    api/history/            # LEGACY — to be removed (no history in MVP)
    api/result/[id]/        # LEGACY — to be removed (no persistence)
    api/download/           # stays — .docx export
    ...
drizzle/
  0000_*.sql                # generated initial migration
  meta/                     # drizzle-kit bookkeeping
docs/
  adr/                      # architectural decision records
  CONTEXT.md                # domain glossary
KIRO_BRANCH_SUMMARY.md      # design / TDD traps log
```

## AI prompt rules

(Carried from the LAN-tool version; still valid.)

- British English spelling
- No fabrication of experiences or skills
- Action verbs for bullet points
- Quantified impact (never invented)
- 2-page A4 maximum

---

## Legacy — LAN-tool Docker / VPS instructions

These instructions are for the pre-SaaS self-hosted version of the
app. They remain functional for running the old flow locally but will
be replaced once the SaaS deployment topology (ADR-0001 §9, §10) is
wired up.

### Docker

Build:

```bash
docker build -t cvpolisher .
```

Create the host data directory:

```bash
mkdir -p ./data
```

Run:

```bash
docker run --rm \
  --env-file .env.local \
  -p 3443:3443 \
  -v "$(pwd)/data:/app/data" \
  cvpolisher
```

Default is HTTP on `http://localhost:3443`. To enable HTTPS, mount
valid cert files at `/app/certs/server.cert` and `/app/certs/server.key`:

```bash
docker run --rm \
  --env-file .env.local \
  -p 3443:3443 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/certs/server.cert:/app/certs/server.cert:ro" \
  -v "$(pwd)/certs/server.key:/app/certs/server.key:ro" \
  cvpolisher
```

For Google Vertex AI in Docker, mount the credentials file:

```bash
docker run --rm \
  --env-file .env.local \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/google-credentials.json \
  -p 3443:3443 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/google-credentials.json:/app/google-credentials.json:ro" \
  cvpolisher
```

### Public VPS via Caddy

For temporary public exposure on a VPS without a domain, use
`compose.yaml` + `Caddyfile`:

- `cvpolisher` stays on the internal Docker network, exposing port
  `3443` to Caddy only.
- `caddy` is the only public entrypoint, on port `80`, protecting the
  app with Basic Auth.

Prepare:

```bash
mkdir -p data
cp .env.local.example .env.local
cp .env.public.example .env.public
```

Fill `.env.local` with AI provider credentials. Generate a Basic Auth
password hash for `.env.public`:

```bash
docker run --rm caddy:2.9-alpine caddy hash-password --plaintext 'change-this-password'
```

Bring up:

```bash
docker compose --env-file .env.public up -d --build
```

### LAN access (self-hosted mode)

```
http://<your-machine-ip>:3443
```

If valid certs are present:

```
https://<your-machine-ip>:3443
```

With self-signed certs, the browser will show a warning; add an
exception to proceed.

### Generating a self-signed cert for local HTTPS

```bash
bash scripts/generate-cert.sh
```

---

## License

See [LICENSE](LICENSE).
