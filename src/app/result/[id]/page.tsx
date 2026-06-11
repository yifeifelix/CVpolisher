"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CircleAlert, Download, Mail } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { AtsScoreCard } from "@/components/ats-score-card";
import { KeywordsPanel } from "@/components/keywords-panel";
import { SkillsChecklist } from "@/components/skills-checklist";
import { SuggestionsPanel } from "@/components/suggestions-panel";
import { CvPreview } from "@/components/cv-preview";

interface Skill {
  skill: string;
  matched: boolean;
}

interface PolishResult {
  firstName?: string;
  companyName?: string;
  atsScore?: number;
  topKeywords?: string[];
  mustHaveSkills?: Skill[];
  polishedCV: string;
  suggestions: string[];
}

interface SessionData {
  id: string;
  cvInput: string;
  jdInput: string | null;
  provider: string;
  model: string;
  result: PolishResult;
  createdAt: string;
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

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [polishedCV, setPolishedCV] = useState("");
  const [downloadingCv, setDownloadingCv] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchSession() {
      try {
        const response = await fetch(`/api/result/${id}`);
        const data = (await response.json()) as SessionData & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load result");
        }
        setSession(data);
        setPolishedCV(data.result.polishedCV ?? "");
      } catch (err: unknown) {
        setFetchError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    void fetchSession();
  }, [id]);

  async function handleDownloadCv() {
    setDownloadingCv(true);
    setDownloadError(null);
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cv", content: polishedCV }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Download failed");
      }
      const blob = await response.blob();
      const firstName = session?.result.firstName ?? "cv";
      const company = session?.result.companyName ?? "polished";
      await triggerDownload(blob, `${firstName}_${company}.docx`);
    } catch (err: unknown) {
      setDownloadError(getErrorMessage(err));
    } finally {
      setDownloadingCv(false);
    }
  }

  function handleCreateCoverLetter() {
    sessionStorage.setItem(`cv-polished-${id}`, polishedCV);
    sessionStorage.setItem(`cv-meta-${id}`, JSON.stringify({
      firstName: session?.result.firstName ?? "",
      companyName: session?.result.companyName ?? "",
    }));
    router.push(`/result/${id}/cover-letter`);
  }

  if (loading) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">Loading result...</p>
        </main>
      </>
    );
  }

  if (fetchError || !session) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{fetchError ?? "Result not found."}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/")}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to workbench
          </Button>
        </main>
      </>
    );
  }

  const { result, jdInput } = session;
  const hasJd = !!jdInput;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="reveal flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Polish results
            </h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {session.provider} / {session.model}
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to workbench
            </Button>
          </Link>
        </header>

        {hasJd && (
          <section
            aria-label="Match analysis"
            className="reveal reveal-2 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <div className="space-y-4">
              {result.atsScore !== undefined && (
                <AtsScoreCard score={result.atsScore} />
              )}
              <KeywordsPanel keywords={result.topKeywords ?? []} />
            </div>
            <SkillsChecklist skills={result.mustHaveSkills ?? []} />
            <SuggestionsPanel suggestions={result.suggestions ?? []} />
          </section>
        )}

        {!hasJd && result.suggestions && result.suggestions.length > 0 && (
          <section aria-label="Improvement suggestions" className="reveal reveal-2">
            <SuggestionsPanel suggestions={result.suggestions} />
          </section>
        )}

        <section aria-labelledby="polished-cv-heading" className="reveal reveal-3">
          <div className="panel-raised overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
              <div>
                <h2
                  id="polished-cv-heading"
                  className="font-display text-base font-semibold tracking-tight"
                >
                  Polished CV
                </h2>
                <p className="text-xs text-muted-foreground">
                  Edit freely before downloading — this text is yours.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasJd && (
                  <Button variant="outline" onClick={handleCreateCoverLetter}>
                    <Mail className="size-4" aria-hidden="true" />
                    Create cover letter
                  </Button>
                )}
                <Button onClick={handleDownloadCv} disabled={downloadingCv}>
                  <Download className="size-4" aria-hidden="true" />
                  {downloadingCv ? "Downloading..." : "Download .docx"}
                </Button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <CvPreview value={polishedCV} onChange={setPolishedCV} />
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
