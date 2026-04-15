import { NextResponse } from 'next/server';
import { getProviders } from '@/lib/ai/provider';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

export async function GET(): Promise<NextResponse> {
  try {
    const providers = getProviders();
    return NextResponse.json(providers);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `Failed to fetch providers: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
