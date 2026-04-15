import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/db';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  let session;
  try {
    session = getSession(id);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `Database error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  let parsedResult: unknown;
  try {
    parsedResult = JSON.parse(session.result);
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse stored result' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: session.id,
    cvInput: session.cv_input,
    jdInput: session.jd_input,
    provider: session.provider,
    model: session.model,
    result: parsedResult,
    createdAt: session.created_at,
  });
}
