# CV Polisher - Design Spec

## Context

Two family members are actively job searching and need a tool to tailor CVs to specific job descriptions. The goal is a self-hosted web app on the local network that:
- Extracts ATS keywords and must-have skills from job descriptions
- Rewrites CV bullet points with action verbs and quantified impact
- Scores ATS compatibility and provides improvement suggestions
- Generates a matching cover letter
- Also supports general CV polishing without a job description

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| UI | TailwindCSS + shadcn/ui |
| Database | SQLite (better-sqlite3) |
| AI | Multi-provider: OpenRouter, AWS Bedrock, Google Vertex AI |
| Document Export | `docx` npm package (.docx) |
| HTTPS | Self-signed certificate, custom Node.js HTTPS server |

## Architecture

### Project Structure

```
cvpolisher/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Home - input CV & JD
│   │   ├── result/[id]/
│   │   │   └── page.tsx        # Result - review & download
│   │   ├── api/
│   │   │   ├── polish/route.ts # POST - submit CV+JD, call AI
│   │   │   ├── history/route.ts# GET - session history
│   │   │   ├── result/[id]/route.ts # GET - single result
│   │   │   └── download/[id]/route.ts # GET - generate & download .docx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── cv-input-form.tsx
│   │   ├── provider-selector.tsx
│   │   ├── ats-score-card.tsx
│   │   ├── keywords-panel.tsx
│   │   ├── skills-checklist.tsx
│   │   ├── bullet-comparison.tsx
│   │   ├── cover-letter-editor.tsx
│   │   ├── suggestions-panel.tsx
│   │   └── history-list.tsx
│   └── lib/
│       ├── ai/
│       │   ├── provider.ts     # AIProvider interface
│       │   ├── openrouter.ts   # OpenRouter implementation
│       │   ├── bedrock.ts      # AWS Bedrock implementation
│       │   └── google.ts       # Google Vertex AI implementation
│       ├── db.ts               # SQLite operations
│       ├── docx-generator.ts   # Word document generation
│       └── prompts.ts          # Claude prompt templates
├── data/                       # SQLite database file
├── certs/                      # Self-signed TLS certificates
├── server.ts                   # Custom HTTPS server entry point
├── .env.local                  # API keys and config
└── package.json
```

### AI Provider System

A unified `AIProvider` interface that each provider implements:

```typescript
interface AIProvider {
  name: string;
  models: string[];
  chat(model: string, messages: Message[]): Promise<string>;
}
```

Providers configured via `.env.local`:

```
# OpenRouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODELS=anthropic/claude-sonnet-4-20250514,anthropic/claude-haiku-4-5-20251001

# AWS Bedrock
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
BEDROCK_MODELS=anthropic.claude-sonnet-4-20250514-v1:0,anthropic.claude-haiku-4-5-20251001-v1:0

# Google Vertex AI
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_PROJECT_ID=...
GOOGLE_REGION=us-central1
GOOGLE_MODELS=claude-sonnet-4@20250514,claude-haiku-4-5@20251001
```

The UI presents two dropdowns: **Provider** and **Model** (model list updates based on selected provider).

## Two Operating Modes

### Mode 1: With Job Description (Full ATS Analysis)

Input: CV text + JD text

Output:
- ATS compatibility score (0-100)
- Top ATS keywords extracted from JD
- Must-have skills with match/no-match status
- Polished CV bullet points (original vs. improved, side by side)
- Improvement suggestions
- Cover letter

### Mode 2: Without Job Description (General Polish)

Input: CV text only (JD field left empty)

Output:
- Polished CV bullet points (original vs. improved, side by side)
- General improvement suggestions

Hidden in this mode: ATS score, keywords, skills checklist, cover letter.

## Claude Prompt Constraints

The AI prompt enforces these rules:
1. **British English** - Use British spelling throughout (organisation, optimised, behaviour, etc.)
2. **No fabrication** - Only improve expression and phrasing. Never invent, fabricate, or add experiences, skills, or achievements not present in the original CV.
3. **Action verbs** - Start bullet points with strong action verbs
4. **Quantify impact** - Add metrics and numbers where the original implies them, but never invent numbers
5. **Structured JSON output** - Return results in a defined JSON schema for reliable parsing

### Prompt Output Schema

```json
{
  "atsScore": 78,
  "topKeywords": ["cloud infrastructure", "CI/CD", "microservices"],
  "mustHaveSkills": [
    { "skill": "Kubernetes", "matched": true },
    { "skill": "Terraform", "matched": false }
  ],
  "polishedBullets": [
    {
      "original": "Worked on cloud projects",
      "polished": "Architected and deployed 15+ cloud-native microservices on AWS EKS, reducing deployment time by 40%"
    }
  ],
  "suggestions": [
    "Consider adding specific metrics to the project management bullets",
    "The skills section could include Terraform to match the JD requirement"
  ],
  "coverLetter": "Dear Hiring Manager,\n\n..."
}
```

When no JD is provided, the response omits `atsScore`, `topKeywords`, `mustHaveSkills`, and `coverLetter`.

## Database

Single SQLite table, stored at `data/cvpolisher.db`:

```sql
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  cv_input   TEXT NOT NULL,
  jd_input   TEXT,              -- NULL when no JD provided
  provider   TEXT NOT NULL,
  model      TEXT NOT NULL,
  result     TEXT NOT NULL,     -- Full JSON response from AI
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/polish` | Submit CV (+optional JD), call AI, store result, return result JSON |
| GET | `/api/history` | List recent sessions (id, created_at, jd snippet, ats score) |
| GET | `/api/result/[id]` | Fetch full result for a session |
| POST | `/api/download` | Accept edited content + type (cv/cover-letter), generate and download .docx |

## UI Pages

### Page 1: Home (Input)

- App title and brief description
- Two side-by-side textareas: "Your CV" | "Job Description (Optional)"
- Bottom row: Provider dropdown + Model dropdown + "Polish My CV" button
- Below: Recent history list (last 10 sessions, clickable to view results)

### Page 2: Result (Review & Download)

- **ATS Score Card** (top) - Large score with colour coding: red <50, amber 50-75, green >75. Hidden when no JD.
- **Two-column layout**:
  - Left: Top ATS Keywords (tags) + Must-Have Skills (green tick / red cross). Hidden when no JD.
  - Right: Improvement Suggestions (list)
- **Polished CV** - Side-by-side comparison: Original | Polished (polished side is editable)
- **Cover Letter** - Full-width editable text area. Hidden when no JD.
- **Action buttons**: "Download CV (.docx)" | "Download Cover Letter (.docx)" | "Re-polish" | "Back to Home"

### UI Principles

- Clean, professional design (shadcn/ui defaults)
- English interface throughout
- Responsive but optimised for desktop (primary use case)
- Loading state with progress indication during AI processing

## HTTPS & Deployment

- `server.ts` creates an HTTPS server wrapping the Next.js app
- Self-signed certificate generated via a setup script (`scripts/generate-cert.sh`)
- Start command: `npm start` (runs the custom HTTPS server)
- Accessible at `https://<host-ip>:<port>` from any device on the local network
- Default port: 3443

## Document Generation

Using the `docx` npm package to generate .docx files:

- **CV document**: Professional formatting with sections, bullet points, and clean typography
- **Cover letter document**: Standard business letter format
- User reviews and optionally edits content on the result page before downloading
- Download sends the current (potentially edited) content from the browser to a POST endpoint, which generates the .docx and returns it as a binary download

## Non-Goals

- No user authentication or accounts
- No PDF export (Word only for now)
- No file upload (text paste only)
- No multi-language support (English only)
- No resume templates or formatting customisation

## Verification Plan

1. Start dev server, open in browser, verify home page loads
2. Paste sample CV + JD, select provider/model, click Polish
3. Verify result page shows ATS score, keywords, skills, polished bullets, suggestions, cover letter
4. Edit polished content, download .docx, verify document opens correctly in Word
5. Test without JD: verify only polished bullets and suggestions shown
6. Test history: verify previous sessions appear and are clickable
7. Test HTTPS: access via https://localhost:3443 and https://<lan-ip>:3443
8. Verify British English in all AI output
9. Verify no fabricated content in polished CV
