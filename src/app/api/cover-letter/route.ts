import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/ai/provider";
import { buildCoverLetterPrompt } from "@/lib/prompts";
import { getSession } from "@/lib/db";

interface CoverLetterRequestBody {
  sessionId: string;
  polishedCV: string;
  provider: string;
  model: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: CoverLetterRequestBody;

  try {
    body = (await request.json()) as CoverLetterRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, polishedCV, provider: providerName, model } = body;

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 },
    );
  }
  if (!polishedCV || typeof polishedCV !== "string") {
    return NextResponse.json(
      { error: "polishedCV is required" },
      { status: 400 },
    );
  }
  if (!providerName || !model) {
    return NextResponse.json(
      { error: "provider and model are required" },
      { status: 400 },
    );
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (!session.jd_input) {
    return NextResponse.json(
      { error: "No job description found for this session" },
      { status: 400 },
    );
  }

  let provider;
  try {
    provider = getProvider(providerName);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }

  const prompt = buildCoverLetterPrompt(polishedCV, session.jd_input);

  let rawResponse: string;
  try {
    rawResponse = await provider.chat(model, [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ]);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `AI provider error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }

  let parsedResult: { coverLetter?: string };
  try {
    let jsonStr = rawResponse.trim();
    const fenceMatch = jsonStr.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }
    parsedResult = JSON.parse(jsonStr) as { coverLetter?: string };
  } catch {
    return NextResponse.json(
      { error: "AI returned invalid JSON response" },
      { status: 500 },
    );
  }

  if (
    !parsedResult.coverLetter ||
    typeof parsedResult.coverLetter !== "string"
  ) {
    return NextResponse.json(
      { error: "AI did not return a cover letter" },
      { status: 500 },
    );
  }

  return NextResponse.json({ coverLetter: parsedResult.coverLetter });
}
