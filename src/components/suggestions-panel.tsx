import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SuggestionsPanelProps {
  suggestions: string[];
}

export function SuggestionsPanel({ suggestions }: SuggestionsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-700">
          Improvement Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <p className="text-sm text-slate-400">No suggestions.</p>
        ) : (
          <ul className="space-y-2 list-disc list-inside">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-slate-700 leading-relaxed">
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
