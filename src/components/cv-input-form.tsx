"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProviderSelector } from "@/components/provider-selector";

interface PolishResult {
  id: string;
}

export function CvInputForm() {
  const router = useRouter();
  const [cv, setCv] = useState("");
  const [jd, setJd] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!cv.trim() || !provider || !model) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, jd: jd.trim() || null, provider, model }),
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

  const canSubmit = cv.trim().length > 0 && provider.length > 0 && model.length > 0 && !loading;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cv-input" className="font-medium">
            Your CV
          </Label>
          <Textarea
            id="cv-input"
            rows={15}
            placeholder="Paste your CV here..."
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            className="resize-none text-sm leading-relaxed"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jd-input" className="font-medium">
            Job Description{" "}
            <span className="text-slate-400 font-normal">(Optional)</span>
          </Label>
          <Textarea
            id="jd-input"
            rows={15}
            placeholder="Paste the job description here for targeted ATS optimisation..."
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            className="resize-none text-sm leading-relaxed"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <ProviderSelector
          provider={provider}
          model={model}
          onProviderChange={setProvider}
          onModelChange={setModel}
        />

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-8"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Polishing...
            </span>
          ) : (
            "Polish My CV"
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-500 rounded-md bg-red-50 px-4 py-2">
          Error: {error}
        </p>
      )}
    </div>
  );
}
