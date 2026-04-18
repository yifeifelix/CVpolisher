# CV Polisher

AI-powered CV optimisation tool that tailors your CV to job descriptions, scores ATS compatibility, and generates cover letters. Self-hosted on your local network.

## Features

- **ATS Analysis** - Extracts keywords and must-have skills from job descriptions, scores CV match (0-100)
- **CV Polish** - Rewrites with action verbs and quantified impact, outputs a complete polished CV (2-page max)
- **Cover Letter** - Generates a tailored cover letter based on your polished CV and the job description
- **Word Export** - Download as `.docx` with smart naming: `FirstName_Company.docx`
- **Multi-Provider AI** - Supports OpenRouter, AWS Bedrock, and Google Vertex AI (Claude models)
- **Two Modes** - With JD (full ATS analysis) or without JD (general polish)
- **Session History** - Browse and revisit previous sessions
- **Self-Hosted** - Runs on your local network, with optional HTTPS when local certs are available, and no data leaves your network

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | TailwindCSS + shadcn/ui |
| Database | SQLite (better-sqlite3) |
| AI | OpenRouter / AWS Bedrock / Google Vertex AI |
| Document Export | docx (npm) |
| Server | Custom Node.js server with optional self-signed TLS |

## Quick Start

```bash
# Install dependencies
npm install

# Configure API keys (at least one provider required)
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Generate HTTPS certificate if you want local HTTPS
bash scripts/generate-cert.sh

# Development
npm run dev          # http://localhost:3443

# Production
npm run build
npm start            # http://0.0.0.0:3443 by default, HTTPS when certs exist
```

## Docker Startup

Build the image:

```bash
docker build -t cvpolisher .
```

Create the host data directory before startup:

```bash
mkdir -p ./data
```

Start the container with the approved v1 contract:

```bash
docker run --rm \
  --env-file .env.local \
  -p 3443:3443 \
  -v "$(pwd)/data:/app/data" \
  cvpolisher
```

This starts over HTTP by default:

```text
http://localhost:3443
```

To enable HTTPS, mount valid cert files at `/app/certs/server.cert` and `/app/certs/server.key`:

```bash
docker run --rm \
  --env-file .env.local \
  -p 3443:3443 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/certs/server.cert:/app/certs/server.cert:ro" \
  -v "$(pwd)/certs/server.key:/app/certs/server.key:ro" \
  cvpolisher
```

For Google Vertex AI in Docker, mount the credentials file and override the runtime path:

```bash
docker run --rm \
  --env-file .env.local \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/google-credentials.json \
  -p 3443:3443 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/google-credentials.json:/app/google-credentials.json:ro" \
  cvpolisher
```

Notes:
- The host directory mounted to `/app/data` must exist before startup.
- Docker uses HTTP unless valid cert files are mounted.
- If cert files are present but invalid or unreadable, startup fails rather than falling back to HTTP.

## Public VPS Deployment

For temporary public exposure on a VPS without a domain, use the included `compose.yaml` and `Caddyfile`.

Deployment shape:
- `cvpolisher` stays on the internal Docker network and only exposes port `3443` to Caddy.
- `caddy` is the only public entrypoint and publishes port `80`.
- Caddy protects the app with `Basic Auth` and reverse-proxies traffic to `cvpolisher:3443`.
- This IP-based setup is intended for temporary controlled access, not a polished long-term public deployment.

Prepare the VPS:

```bash
mkdir -p data
cp .env.local.example .env.local
cp .env.public.example .env.public
```

Edit `.env.local` with your AI provider credentials.

Generate a Basic Auth password hash and place it in `.env.public`:

```bash
docker run --rm caddy:2.9-alpine caddy hash-password --plaintext 'change-this-password'
```

Bring the stack up:

```bash
docker compose --env-file .env.public up -d --build
```

Then access the app through your VPS public IP:

```text
http://<your-vps-ip>/
```

Operational notes:
- Open only port `80` on the VPS firewall for this temporary setup.
- Do not publish port `3443` directly on the VPS.
- `Basic Auth` protects access, but without a domain this setup does not provide production-grade HTTPS yet.
- Session history and stored CV/JD content remain in the SQLite database under `./data`.
- If you later buy a domain, update the Caddy site address from `:80` to your domain and enable HTTPS there instead of exposing app-managed TLS directly.

## Configuration

Create `.env.local` with at least one provider:

```bash
# OpenRouter (simplest setup)
CV_OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODELS=anthropic/claude-sonnet-4,anthropic/claude-haiku-4.5

# AWS Bedrock
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
BEDROCK_MODELS=anthropic.claude-sonnet-4-20250514-v1:0

# Google Vertex AI
# Use a local path for non-Docker runs. Docker overrides this path at runtime.
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_PROJECT_ID=...
GOOGLE_REGION=us-central1
GOOGLE_MODELS=claude-sonnet-4@20250514

# Server
PORT=3443
HOST=0.0.0.0
```

## User Flow

1. **Home** - Paste CV + optional Job Description, select AI provider/model, click "Polish My CV"
2. **Result** - Review ATS score, keywords, skills match, and the full polished CV (editable). Download as `.docx`
3. **Cover Letter** - Click "Create Cover Letter" to generate from your polished CV. Edit and download

## AI Prompt Rules

- British English spelling
- No fabrication of experiences or skills
- Action verbs for bullet points
- Quantified impact (never invented)
- 2-page A4 maximum

## Project Structure

```
src/
  app/                          # Pages and API routes
    page.tsx                    # Home - input form
    result/[id]/page.tsx        # Result - CV review
    result/[id]/cover-letter/   # Cover letter generation
    api/
      polish/                   # POST - CV polishing
      cover-letter/             # POST - Cover letter generation
      download/                 # POST - .docx generation
      providers/                # GET - Available providers
      history/                  # GET - Session history
      result/[id]/              # GET - Session details
  components/                   # UI components
  lib/
    ai/                         # Multi-provider abstraction
    prompts.ts                  # Prompt templates
    db.ts                       # SQLite operations
    docx-generator.ts           # Word document generation
server.ts                       # Custom HTTPS server
scripts/generate-cert.sh        # TLS certificate generator
```

## LAN Access

After starting the production server, access from any device on your network:

```
http://<your-machine-ip>:3443
```

If valid certs are present, use:

```
https://<your-machine-ip>:3443
```

With self-signed certs, the browser will show a certificate warning; add an exception to proceed.
