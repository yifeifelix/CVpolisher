export interface PolishWithJDResult {
  firstName: string;
  companyName: string;
  atsScore: number;
  topKeywords: string[];
  mustHaveSkills: { skill: string; matched: boolean }[];
  polishedCV: string;
  suggestions: string[];
}

export interface CoverLetterResult {
  coverLetter: string;
}

export interface PolishWithoutJDResult {
  firstName: string;
  polishedCV: string;
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
6. CONCISENESS IS CRITICAL — the polished CV MUST fit on 2 A4 pages maximum. To achieve this:
   - Profile/Summary: maximum 2-3 concise sentences. Cut filler words and redundant phrases.
   - Each bullet point: one impactful line, ideally under 15 words. Do NOT pad with adjectives or restate context already clear from the job title.
   - Keep only the 3-5 strongest bullets per role. Merge or drop weaker ones.
   - For older or less relevant roles, use 1-2 bullets maximum.
   - Skills: list as comma-separated keywords, not full sentences.
   - Remove "References available upon request" — it wastes space.
   - Prioritise recent and relevant experience. Trim older roles aggressively.
`.trim();

const WITH_JD_SCHEMA = `
Output schema (strict JSON, no extra fields):
{
  "firstName": "<candidate's first name extracted from the CV>",
  "companyName": "<hiring company name extracted from the JD, use short form e.g. 'Google' not 'Google LLC'>",
  "atsScore": <integer 0–100 representing keyword match between CV and JD>,
  "topKeywords": [<up to 10 most important keywords from the JD>],
  "mustHaveSkills": [
    { "skill": "<skill name>", "matched": <true if present in CV, false otherwise> }
  ],
  "polishedCV": "<the COMPLETE polished CV as a single string, preserving all sections (Profile, Skills, Experience, Education, etc.) with line breaks (\\n) between lines and double line breaks (\\n\\n) between sections>",
  "suggestions": [<up to 5 actionable improvement suggestions as strings>]
}
`.trim();

const WITHOUT_JD_SCHEMA = `
Output schema (strict JSON, no extra fields):
{
  "firstName": "<candidate's first name extracted from the CV>",
  "polishedCV": "<the COMPLETE polished CV as a single string, preserving all sections (Profile, Skills, Experience, Education, etc.) with line breaks (\\n) between lines and double line breaks (\\n\\n) between sections>",
  "suggestions": [<up to 5 actionable improvement suggestions as strings>]
}
`.trim();

export function buildPolishWithJDPrompt(
  cv: string,
  jd: string,
): { system: string; user: string } {
  const system = `You are an expert CV writer and ATS (Applicant Tracking System) specialist with 15+ years of experience helping candidates land roles at top companies.

${COMMON_RULES}

Your task: analyse the candidate's CV against the provided Job Description (JD), then return a structured JSON object that polishes the CV bullets and scores ATS alignment.

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

const COVER_LETTER_SCHEMA = `
Output schema (strict JSON, no extra fields):
{
  "coverLetter": "<full cover letter text, paragraphs separated by \\n\\n>"
}
`.trim();

export function buildCoverLetterPrompt(
  polishedCV: string,
  jd: string,
): { system: string; user: string } {
  const system = `You are an expert cover letter writer with 15+ years of experience crafting compelling, tailored cover letters that help candidates stand out.

${COMMON_RULES}

Your task: write a professional cover letter tailored to the Job Description, drawing on the candidate's polished CV. The letter should highlight the candidate's most relevant experience and skills for this specific role.

${COVER_LETTER_SCHEMA}`;

  const user = `Write a cover letter for the following candidate and role.

--- POLISHED CV START ---
${polishedCV}
--- POLISHED CV END ---

--- JOB DESCRIPTION START ---
${jd}
--- JOB DESCRIPTION END ---

Return only the JSON object described in your instructions.`;

  return { system, user };
}
