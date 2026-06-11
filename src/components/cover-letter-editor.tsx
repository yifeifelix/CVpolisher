"use client";

import { Textarea } from "@/components/ui/textarea";

interface CoverLetterEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function CoverLetterEditor({ value, onChange }: CoverLetterEditorProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={16}
      className="min-h-[24rem] w-full resize-y bg-card px-4 py-3 text-sm leading-7"
      placeholder="Cover letter will appear here..."
      aria-label="Cover letter editor"
    />
  );
}
