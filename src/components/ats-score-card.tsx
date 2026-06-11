import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AtsScoreCardProps {
  score: number;
}

function getScoreTone(score: number): { text: string; bar: string } {
  if (score >= 75) return { text: "text-success", bar: "bg-success" };
  if (score >= 50) return { text: "text-warning", bar: "bg-warning" };
  return { text: "text-destructive", bar: "bg-destructive" };
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "Strong match";
  if (score >= 50) return "Moderate match";
  return "Needs improvement";
}

export function AtsScoreCard({ score }: AtsScoreCardProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const tone = getScoreTone(clamped);
  const label = getScoreLabel(clamped);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ATS match score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <p className={`font-display text-5xl font-semibold tracking-tight ${tone.text}`}>
            {clamped}
          </p>
          <p className="text-sm text-muted-foreground">/ 100</p>
        </div>
        <div
          role="meter"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="ATS match score"
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={`h-full rounded-full ${tone.bar}`}
            style={{ width: `${clamped}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-medium text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
