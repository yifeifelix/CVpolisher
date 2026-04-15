"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CoverLetterEditor } from "@/components/cover-letter-editor";

interface SessionData {
  id: string;
  jdInput: string | null;
  provider: string;
  model: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

async function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function CoverLetterPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [coverLetter, setCoverLetter] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function generateCoverLetter() {
      try {
        // Get polished CV text and metadata from sessionStorage (set by result page)
        const polishedCV = sessionStorage.getItem(`cv-polished-${id}`);
        if (!polishedCV) {
          throw new Error(
            "No polished CV data found. Please go back to the CV review page first.",
          );
        }

        try {
          const meta = JSON.parse(sessionStorage.getItem(`cv-meta-${id}`) ?? "{}") as { companyName?: string };
          setCompanyName(meta.companyName ?? "");
        } catch { /* ignore */ }

        // Get session info for provider/model
        const sessionRes = await fetch(`/api/result/${id}`);
        const sessionData = (await sessionRes.json()) as SessionData & {
          error?: string;
        };
        if (!sessionRes.ok) {
          throw new Error(sessionData.error ?? "Failed to load session");
        }

        if (!sessionData.jdInput) {
          throw new Error(
            "No job description available for cover letter generation.",
          );
        }

        // Call cover letter generation API
        const response = await fetch("/api/cover-letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: id,
            polishedCV,
            provider: sessionData.provider,
            model: sessionData.model,
          }),
        });

        const data = (await response.json()) as {
          coverLetter?: string;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to generate cover letter");
        }

        setCoverLetter(data.coverLetter ?? "");
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setGenerating(false);
      }
    }

    void generateCoverLetter();
  }, [id]);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cover-letter", content: coverLetter }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Download failed");
      }
      const blob = await response.blob();
      const filename = companyName
        ? `coverletter_${companyName}.docx`
        : "cover-letter.docx";
      await triggerDownload(blob, filename);
    } catch (err: unknown) {
      setDownloadError(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  if (generating) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-4">
          Generating Cover Letter
        </h1>
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          <p>
            Creating a tailored cover letter based on your polished CV and the
            job description...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-4">
          Cover Letter
        </h1>
        <p className="text-red-500 mb-4">{error}</p>
        <Button variant="outline" onClick={() => router.push(`/result/${id}`)}>
          Back to CV Review
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Cover Letter
        </h1>
        <Link href={`/result/${id}`}>
          <Button variant="outline">Back to CV Review</Button>
        </Link>
      </header>

      <section>
        <CoverLetterEditor value={coverLetter} onChange={setCoverLetter} />
      </section>

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleDownload} disabled={downloading}>
          {downloading ? "Downloading..." : "Download Cover Letter (.docx)"}
        </Button>

        <Link href={`/result/${id}`}>
          <Button variant="ghost">Back to CV Review</Button>
        </Link>
      </div>

      {downloadError && (
        <p className="text-sm text-red-500 rounded-md bg-red-50 px-4 py-2">
          Download error: {downloadError}
        </p>
      )}
    </main>
  );
}
