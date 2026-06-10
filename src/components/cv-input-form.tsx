"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="cv-input"
            className="font-mono text-[0.65rem] font-medium tracking-[0.25em] uppercase"
          >
            Your CV <span className="text-accent">— required</span>
          </Label>
          <Textarea
            id="cv-input"
            rows={15}
            placeholder="Paste your CV here..."
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            className="resize-none bg-background/60 text-sm leading-relaxed"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="jd-input"
            className="font-mono text-[0.65rem] font-medium tracking-[0.25em] uppercase"
          >
            Job description{" "}
            <span className="font-normal text-muted-foreground normal-case tracking-normal">
              (optional)
            </span>
          </Label>
          <Textarea
            id="jd-input"
            rows={15}
            placeholder="Paste the job description here for targeted ATS optimisation..."
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            className="resize-none bg-background/60 text-sm leading-relaxed"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-6 border-t border-dashed border-border pt-6">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground">
          The editor picks the model — upgrades sharpen the pen
        </p>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="lg"
          className="px-8 hover:bg-accent hover:text-accent-foreground"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Polishing…
            </span>
          ) : (
            "Polish my CV"
          )}
        </Button>
      </div>

      {error && (
        <p className="border-l-2 border-accent bg-accent/8 px-4 py-2 text-sm text-accent">
          Error: {error}
        </p>
      )}
    </div>
  );
}
