import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KeywordsPanelProps {
  keywords: string[];
}

export function KeywordsPanel({ keywords }: KeywordsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top ATS keywords</CardTitle>
      </CardHeader>
      <CardContent>
        {keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground">No keywords found.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
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
