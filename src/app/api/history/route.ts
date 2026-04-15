import { NextResponse } from 'next/server';
import { getRecentSessions } from '@/lib/db';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

export async function GET(): Promise<NextResponse> {
  try {
    const sessions = getRecentSessions();
    return NextResponse.json(sessions);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `Failed to fetch history: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
