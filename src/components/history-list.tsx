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
    return <p className="text-sm text-slate-400">Loading history...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">Error loading history: {error}</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-400">No history yet.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card
          key={item.id}
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => router.push(`/result/${item.id}`)}
        >
          <CardContent className="py-3">
            <p className="text-xs text-slate-400 mb-1">{formatDate(item.created_at)}</p>
            <p className="text-sm text-slate-700 line-clamp-2 mb-2">
              {item.jd_snippet ?? "General Polish"}
            </p>
            {item.atsScore !== null && (
              <p className="text-xs font-semibold text-slate-600">
                ATS Score:{" "}
                <span
                  className={
                    item.atsScore >= 75
                      ? "text-green-600"
                      : item.atsScore >= 50
                        ? "text-amber-500"
                        : "text-red-500"
                  }
                >
                  {item.atsScore}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
