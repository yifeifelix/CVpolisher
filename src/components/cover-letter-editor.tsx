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
      className="w-full text-sm leading-relaxed resize-none"
      placeholder="Cover letter will appear here..."
    />
  );
}
