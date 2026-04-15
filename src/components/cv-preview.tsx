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
      className="resize-y text-sm font-mono leading-relaxed"
      placeholder="Polished CV will appear here..."
    />
  );
}
