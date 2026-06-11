"use client";

import { Textarea } from "@/components/ui/textarea";

interface CvPreviewProps {
  value: string;
  onChange: (value: string) => void;
}

export function CvPreview({ value, onChange }: CvPreviewProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={24}
      className="min-h-[32rem] resize-y bg-card px-4 py-3 text-sm leading-7"
      placeholder="Polished CV will appear here..."
      aria-label="Polished CV editor"
    />
  );
}
