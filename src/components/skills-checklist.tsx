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
        <CardTitle className="text-base font-semibold text-slate-700">
          Must-Have Skills
        </CardTitle>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <p className="text-sm text-slate-400">No skills listed.</p>
        ) : (
          <ul className="space-y-2">
            {skills.map(({ skill, matched }) => (
              <li key={skill} className="flex items-center gap-2 text-sm">
                {matched ? (
                  <span className="text-green-600 font-bold" aria-label="matched">
                    ✓
                  </span>
                ) : (
                  <span className="text-red-500 font-bold" aria-label="missing">
                    ✗
                  </span>
                )}
                <span className={matched ? "text-slate-700" : "text-slate-500"}>
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
