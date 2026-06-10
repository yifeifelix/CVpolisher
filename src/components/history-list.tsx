"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

interface HistoryItem {
  id: string;
  created_at: string;
  jd_snippet: string | null;
  atsScore: number | null;
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
    return (
      <p className="font-mono text-xs tracking-wider text-muted-foreground">
        Pulling drafts from the drawer…
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-accent">Error loading history: {error}</p>;
  }

  if (items.length === 0) {
    return (
      <p className="font-mono text-xs tracking-wider text-muted-foreground">
        Nothing in the drawer yet — your first polish lands here.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card
          key={item.id}
          className="group cursor-pointer rounded-[var(--radius)] ring-border transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_color-mix(in_oklch,var(--foreground)_10%,transparent)]"
          onClick={() => router.push(`/result/${item.id}`)}
        >
          <CardContent className="py-3">
            <p className="mb-2 font-mono text-[0.65rem] tracking-[0.15em] uppercase text-muted-foreground">
              {formatDate(item.created_at)}
            </p>
            <p className="mb-3 line-clamp-2 text-sm leading-snug">
              {item.jd_snippet ?? "General polish"}
            </p>
            {item.atsScore !== null && (
              <p className="font-mono text-[0.7rem] tracking-wider uppercase text-muted-foreground">
                ATS{" "}
                <span
                  className={
                    item.atsScore >= 75
                      ? "font-semibold text-emerald-700"
                      : item.atsScore >= 50
                        ? "font-semibold text-amber-600"
                        : "font-semibold text-accent"
                  }
                >
                  {item.atsScore}
                </span>
                <span className="ml-1 text-muted-foreground/60">/100</span>
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
