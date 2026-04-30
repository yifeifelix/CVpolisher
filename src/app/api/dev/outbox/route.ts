/**
 * Dev-only route for inspecting the mock mail outbox. See ADR-0004 §3
 * "Layer B" for the why: Phase 2 E2E tests need to extract the
 * verification link machine-readably, and scraping stdout across
 * process managers is fragile.
 *
 * Gated on NODE_ENV !== 'production'. In production the route
 * behaves as if it does not exist (404) so a misconfigured deploy
 * cannot leak arbitrary recipient mail content.
 *
 * Namespace: this is the first route under `/api/dev/*`, establishing
 * the convention pinned by ADR-0004 §3. Any future dev-only
 * introspection endpoint (e.g. `/api/dev/quota`) goes under the same
 * prefix with the same gate.
 */

import { NextResponse } from "next/server";
import { getRecentMail } from "@/lib/auth/mail";

export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  // Ignore non-positive or NaN limits — fall back to the default
  // (the full buffer). Defensive: an invalid query string must not
  // 500 a dev endpoint that testing depends on.
  const sanitisedLimit =
    limit !== undefined && Number.isInteger(limit) && limit > 0
      ? limit
      : undefined;

  const mails = getRecentMail(sanitisedLimit);
  return NextResponse.json({ mails });
}
