import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@/lib/auth/auth';
import { getServerRoute } from '@/lib/ai/provider';
import { buildPolishWithJDPrompt, buildPolishWithoutJDPrompt } from '@/lib/prompts';
import { createSession } from '@/lib/db';

interface PolishRequestBody {
  cv: string;
  jd?: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ADR-0005 §7 — handler-level gate; 401, never a redirect. The UI
  // owns bouncing anonymous users to /login.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  let body: PolishRequestBody;

  try {
    body = (await request.json()) as PolishRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { cv, jd } = body;

  if (!cv || typeof cv !== 'string' || cv.trim().length === 0) {
    return NextResponse.json({ error: 'cv is required' }, { status: 400 });
  }

  // The server picks the model — free tier rides the configured free
  // route, paid tier the paid route (POLISH_MODEL_FREE / _PAID).
  let provider, model;
  try {
    ({ provider, model } = getServerRoute(session.user.tier));
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }

  const prompt =
    jd && typeof jd === 'string' && jd.trim().length > 0
      ? buildPolishWithJDPrompt(cv, jd)
      : buildPolishWithoutJDPrompt(cv);

  let rawResponse: string;
  try {
    rawResponse = await provider.chat(model, [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ]);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `AI provider error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }

  let parsedResult: unknown;
  try {
    // Strip markdown code fences if the model wraps JSON in ```json ... ```
    let jsonStr = rawResponse.trim();
    const fenceMatch = jsonStr.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }
    parsedResult = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json(
      { error: 'AI returned invalid JSON response', raw: rawResponse.substring(0, 500) },
      { status: 500 },
    );
  }

  const sessionId = uuidv4();

  try {
    createSession({
      id: sessionId,
      cvInput: cv,
      jdInput: jd && jd.trim().length > 0 ? jd : null,
      provider: provider.name,
      model,
      result: JSON.stringify(parsedResult),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `Database error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: sessionId, ...(parsedResult as object) });
}
