"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
  Download,
  LoaderCircle,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
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
      <>
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Generating cover letter
          </h1>
          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            <p>
              Creating a tailored cover letter based on your polished CV and
              the job description...
            </p>
          </div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Cover letter
          </h1>
          <div className="mt-4 mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
          <Button variant="outline" onClick={() => router.push(`/result/${id}`)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to CV review
          </Button>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="reveal flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Cover letter
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Drafted from your polished CV and the job description.
            </p>
          </div>
          <Link href={`/result/${id}`}>
            <Button variant="outline">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to CV review
            </Button>
          </Link>
        </header>

        <section aria-label="Cover letter editor" className="reveal reveal-2">
          <div className="panel-raised overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Edit freely before downloading — this text is yours.
              </p>
              <Button onClick={handleDownload} disabled={downloading}>
                <Download className="size-4" aria-hidden="true" />
                {downloading ? "Downloading..." : "Download .docx"}
              </Button>
            </div>
            <div className="p-4 sm:p-6">
              <CoverLetterEditor value={coverLetter} onChange={setCoverLetter} />
            </div>
          </div>
        </section>

        {downloadError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>Download error: {downloadError}</p>
          </div>
        )}
      </main>
    </>
  );
}
