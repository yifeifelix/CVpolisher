import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getProvider } from '@/lib/ai/provider';
import { buildPolishWithJDPrompt, buildPolishWithoutJDPrompt } from '@/lib/prompts';
import { createSession } from '@/lib/db';

interface PolishRequestBody {
  cv: string;
  jd?: string | null;
  provider: string;
  model: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: PolishRequestBody;

  try {
    body = (await request.json()) as PolishRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { cv, jd, provider: providerName, model } = body;

  if (!cv || typeof cv !== 'string' || cv.trim().length === 0) {
    return NextResponse.json({ error: 'cv is required' }, { status: 400 });
  }
  if (!providerName || typeof providerName !== 'string') {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 });
  }
  if (!model || typeof model !== 'string') {
    return NextResponse.json({ error: 'model is required' }, { status: 400 });
  }

  let provider;
  try {
    provider = getProvider(providerName);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
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
      provider: providerName,
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
