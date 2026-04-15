"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-slate-500">Loading result...</p>
      </main>
    );
  }

  if (fetchError || !session) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-red-500 mb-4">
          {fetchError ?? "Result not found."}
        </p>
        <Button variant="outline" onClick={() => router.push("/")}>
          Back to Home
        </Button>
      </main>
    );
  }

  const { result, jdInput } = session;
  const hasJd = !!jdInput;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Polish Results
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Model: {session.provider} / {session.model}
          </p>
        </div>
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </header>

      {hasJd && (
        <>
          {result.atsScore !== undefined && (
            <div className="max-w-xs">
              <AtsScoreCard score={result.atsScore} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <KeywordsPanel keywords={result.topKeywords ?? []} />
              <SkillsChecklist skills={result.mustHaveSkills ?? []} />
            </div>
            <div>
              <SuggestionsPanel suggestions={result.suggestions ?? []} />
            </div>
          </div>

          <Separator />
        </>
      )}

      {!hasJd && result.suggestions && result.suggestions.length > 0 && (
        <>
          <SuggestionsPanel suggestions={result.suggestions} />
          <Separator />
        </>
      )}

      <section>
        <h2 className="text-xl font-semibold text-slate-800 mb-4">
          Polished CV
        </h2>
        <CvPreview value={polishedCV} onChange={setPolishedCV} />
      </section>

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleDownloadCv} disabled={downloadingCv}>
          {downloadingCv ? "Downloading..." : "Download CV (.docx)"}
        </Button>

        {hasJd && (
          <Button variant="outline" onClick={handleCreateCoverLetter}>
            Create Cover Letter
          </Button>
        )}

        <Link href="/">
          <Button variant="ghost">Back to Home</Button>
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
