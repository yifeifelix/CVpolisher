import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KeywordsPanelProps {
  keywords: string[];
}

export function KeywordsPanel({ keywords }: KeywordsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-700">
          Top ATS Keywords
        </CardTitle>
      </CardHeader>
      <CardContent>
        {keywords.length === 0 ? (
          <p className="text-sm text-slate-400">No keywords found.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary">
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
