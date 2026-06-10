import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { generateCVDocx, generateCoverLetterDocx } from "@/lib/docx-generator";

interface DownloadRequestBody {
  type: "cv" | "cover-letter";
  content: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ADR-0005 §7 — handler-level gate; 401, never a redirect.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  let body: DownloadRequestBody;

  try {
    body = (await request.json()) as DownloadRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, content } = body;

  if (!type || (type !== "cv" && type !== "cover-letter")) {
    return NextResponse.json(
      { error: 'type must be "cv" or "cover-letter"' },
      { status: 400 },
    );
  }

  if (!content || typeof content !== "string") {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 },
    );
  }

  let buffer: Buffer;
  let filename: string;

  try {
    if (type === "cv") {
      buffer = await generateCVDocx(content);
      filename = "cv-polished.docx";
    } else {
      buffer = await generateCoverLetterDocx(content);
      filename = "cover-letter.docx";
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `Document generation error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": DOCX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
