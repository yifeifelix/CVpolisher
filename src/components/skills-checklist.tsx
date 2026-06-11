import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Skill {
  skill: string;
  matched: boolean;
}

interface SkillsChecklistProps {
  skills: Skill[];
}

export function SkillsChecklist({ skills }: SkillsChecklistProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Must-have skills</CardTitle>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills listed.</p>
        ) : (
          <ul className="space-y-2.5">
            {skills.map(({ skill, matched }) => (
              <li key={skill} className="flex items-start gap-2.5 text-sm">
                {matched ? (
                  <span
                    className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-success/10 text-success"
                    aria-label="matched"
                  >
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                ) : (
                  <span
                    className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive"
                    aria-label="missing"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </span>
                )}
                <span
                  className={matched ? "text-foreground" : "text-muted-foreground"}
                >
                  {skill}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
