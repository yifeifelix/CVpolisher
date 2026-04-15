export interface PolishWithJDResult {
  atsScore: number;
  topKeywords: string[];
  mustHaveSkills: { skill: string; matched: boolean }[];
  polishedBullets: { original: string; polished: string }[];
  suggestions: string[];
  coverLetter: string;
}

export interface PolishWithoutJDResult {
  polishedBullets: { original: string; polished: string }[];
  suggestions: string[];
}

export type PolishResult = PolishWithJDResult | PolishWithoutJDResult;

const COMMON_RULES = `
CRITICAL RULES — you MUST follow these without exception:
1. Use British English spelling throughout (e.g. organisation, optimised, behaviour, recognise, colour, analyse, programme, licence, whilst, amongst, favour, honour).
2. NEVER fabricate, invent, or add experiences, skills, achievements, or qualifications not present in the original CV. If it is not in the CV, do not add it.
3. Begin every bullet point with a strong action verb (e.g. Architected, Delivered, Spearheaded, Implemented, Streamlined, Orchestrated, Negotiated, Cultivated).
4. Quantify impact where the original CV implies metrics, but NEVER invent specific numbers that are not in the original.
5. Return ONLY valid JSON — no markdown fences, no prose, no extra keys.
`.trim();

const WITH_JD_SCHEMA = `
Output schema (strict JSON, no extra fields):
{
  "atsScore": <integer 0–100 representing keyword match between CV and JD>,
  "topKeywords": [<up to 10 most important keywords from the JD>],
  "mustHaveSkills": [
    { "skill": "<skill name>", "matched": <true if present in CV, false otherwise> }
  ],
  "polishedBullets": [
    { "original": "<exact bullet or sentence from CV>", "polished": "<improved version>" }
  ],
  "suggestions": [<up to 5 actionable improvement suggestions as strings>],
  "coverLetter": "<full cover letter text, paragraphs separated by \\n\\n>"
}
`.trim();

const WITHOUT_JD_SCHEMA = `
Output schema (strict JSON, no extra fields):
{
  "polishedBullets": [
    { "original": "<exact bullet or sentence from CV>", "polished": "<improved version>" }
  ],
  "suggestions": [<up to 5 actionable improvement suggestions as strings>]
}
`.trim();

export function buildPolishWithJDPrompt(
  cv: string,
  jd: string,
): { system: string; user: string } {
  const system = `You are an expert CV writer and ATS (Applicant Tracking System) specialist with 15+ years of experience helping candidates land roles at top companies.

${COMMON_RULES}

Your task: analyse the candidate's CV against the provided Job Description (JD), then return a structured JSON object that polishes the CV bullets, scores ATS alignment, and drafts a tailored cover letter.

${WITH_JD_SCHEMA}`;

  const user = `Please analyse and polish the following CV against the Job Description.

--- CV START ---
${cv}
--- CV END ---

--- JOB DESCRIPTION START ---
${jd}
--- JOB DESCRIPTION END ---

Return only the JSON object described in your instructions.`;

  return { system, user };
}

export function buildPolishWithoutJDPrompt(cv: string): {
  system: string;
  user: string;
} {
  const system = `You are an expert CV writer with 15+ years of experience helping candidates present their experience compellingly.

${COMMON_RULES}

Your task: review the candidate's CV and return a structured JSON object that polishes each bullet point and provides improvement suggestions.

${WITHOUT_JD_SCHEMA}`;

  const user = `Please analyse and polish the following CV.

--- CV START ---
${cv}
--- CV END ---

Return only the JSON object described in your instructions.`;

  return { system, user };
}
