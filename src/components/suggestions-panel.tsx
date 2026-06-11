import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SuggestionsPanelProps {
  suggestions: string[];
}

export function SuggestionsPanel({ suggestions }: SuggestionsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Improvement suggestions</CardTitle>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suggestions.</p>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2.5 text-sm leading-6">
                <Lightbulb
                  className="mt-1 size-3.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
