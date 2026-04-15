import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AtsScoreCardProps {
  score: number;
}

function getScoreColour(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "Strong match";
  if (score >= 50) return "Moderate match";
  return "Needs improvement";
}

export function AtsScoreCard({ score }: AtsScoreCardProps) {
  const colourClass = getScoreColour(score);
  const label = getScoreLabel(score);

  return (
    <Card className="text-center">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-700">
          ATS Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-6xl font-bold ${colourClass}`}>{score}</p>
        <p className="mt-2 text-sm text-slate-500">{label}</p>
      </CardContent>
    </Card>
  );
}
