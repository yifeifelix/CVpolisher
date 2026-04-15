"use client";

import { Textarea } from "@/components/ui/textarea";

interface Bullet {
  original: string;
  polished: string;
}

interface BulletComparisonProps {
  bullets: Bullet[];
  onChange: (bullets: Bullet[]) => void;
}

export function BulletComparison({ bullets, onChange }: BulletComparisonProps) {
  function handlePolishedChange(index: number, value: string) {
    const updated = bullets.map((bullet, i) =>
      i === index ? { ...bullet, polished: value } : bullet
    );
    onChange(updated);
  }

  if (bullets.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-4">No bullet points to compare.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 mb-2">
        <p className="text-sm font-semibold text-slate-600">Original</p>
        <p className="text-sm font-semibold text-slate-600">Polished (editable)</p>
      </div>
      {bullets.map((bullet, index) => (
        <div key={index} className="grid grid-cols-2 gap-4">
          <Textarea
            value={bullet.original}
            readOnly
            rows={3}
            className="bg-slate-100 text-slate-600 resize-none text-sm"
          />
          <Textarea
            value={bullet.polished}
            onChange={(e) => handlePolishedChange(index, e.target.value)}
            rows={3}
            className="resize-none text-sm"
          />
        </div>
      ))}
    </div>
  );
}
