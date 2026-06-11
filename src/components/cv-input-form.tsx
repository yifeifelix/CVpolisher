"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PolishResult {
  id: string;
}

export function CvInputForm() {
  const router = useRouter();
  const [cv, setCv] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!cv.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, jd: jd.trim() || null }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Polish request failed");
      }

      const result = (await response.json()) as PolishResult;
      router.push(`/result/${result.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setLoading(false);
    }
  }

  const canSubmit = cv.trim().length > 0 && !loading;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="cv-input" className="text-sm font-semibold">
              Your CV
            </Label>
            <span className="text-xs font-medium text-destructive">
              Required
            </span>
          </div>
          <Textarea
            id="cv-input"
            rows={15}
            placeholder="Paste your CV here..."
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            className="min-h-80 resize-none bg-card text-sm leading-relaxed"
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="jd-input" className="text-sm font-semibold">
              Job description
            </Label>
            <span className="text-xs text-muted-foreground">Optional</span>
          </div>
          <Textarea
            id="jd-input"
            rows={15}
            placeholder="Paste the job description here for targeted ATS optimisation..."
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            className="min-h-80 resize-none bg-card text-sm leading-relaxed"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-6 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">
          CV Polisher selects the best available model for each polish.
        </p>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="lg"
          className="min-h-10 gap-2 px-6"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Polishing...
            </span>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden="true" />
              Polish my CV
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
