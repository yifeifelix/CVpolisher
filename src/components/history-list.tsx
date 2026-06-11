"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface HistoryItem {
  id: string;
  created_at: string;
  jd_snippet: string | null;
  atsScore: number | null;
}

function scoreChipClasses(score: number): string {
  if (score >= 75) return "bg-success/10 text-success";
  if (score >= 50) return "bg-warning/10 text-warning";
  return "bg-destructive/10 text-destructive";
}

export function HistoryList() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch("/api/history");
        if (!response.ok) {
          throw new Error("Failed to fetch history");
        }
        const data = (await response.json()) as HistoryItem[];
        setItems(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void fetchHistory();
  }, []);

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading history…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">Error loading history: {error}</p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="panel px-5 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No polishes yet — your first one will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => router.push(`/result/${item.id}`)}
          className="panel group cursor-pointer p-4 text-left transition-colors hover:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {formatDate(item.created_at)}
            </p>
            {item.atsScore !== null && (
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${scoreChipClasses(item.atsScore)}`}
              >
                ATS {item.atsScore}
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-snug font-medium text-foreground">
            {item.jd_snippet ?? "General polish"}
          </p>
        </button>
      ))}
    </div>
  );
}
