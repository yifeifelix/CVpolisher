import { AppHeader } from "@/components/app-header";
import { CvInputForm } from "@/components/cv-input-form";
import { HistoryList } from "@/components/history-list";
import { FileSearch, ListChecks, PenLine } from "lucide-react";

const workflowSteps = [
  {
    icon: FileSearch,
    title: "Reads the role",
    description: "Extracts the keywords and skills the job description asks for.",
  },
  {
    icon: PenLine,
    title: "Rewrites your evidence",
    description: "Sharpens weak bullets into specific, quantified statements.",
  },
  {
    icon: ListChecks,
    title: "Scores the match",
    description: "Shows your ATS score, matched skills, and what's missing.",
  },
];

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <section className="reveal pt-12 pb-10 sm:pt-16">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-primary">
            AI CV workbench
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Polish your CV for the role in front of you.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Paste your CV and the job description. CV Polisher rewrites the
            wording, aligns it with the role&apos;s keywords, and reports the
            ATS match — without inventing anything you didn&apos;t do.
          </p>

          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            {workflowSteps.map((step) => (
              <div key={step.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-highlight text-primary">
                  <step.icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <dt className="text-sm font-semibold">{step.title}</dt>
                  <dd className="mt-0.5 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <section
          id="polish-workbench"
          aria-labelledby="workbench-heading"
          className="reveal reveal-2 scroll-mt-20"
        >
          <div className="panel-raised overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-5 py-4 sm:px-8">
              <h2
                id="workbench-heading"
                className="font-display text-lg font-semibold tracking-tight"
              >
                New polish
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Your CV stays the source of truth — the model only sharpens
                how it reads.
              </p>
            </div>
            <div className="p-5 sm:p-8">
              <CvInputForm />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="history-heading"
          className="reveal reveal-3 mt-14"
        >
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2
                id="history-heading"
                className="font-display text-lg font-semibold tracking-tight"
              >
                Recent polishes
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Pick up where you left off.
              </p>
            </div>
          </div>
          <HistoryList />
        </section>
      </main>

      <footer className="mt-auto border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <p>CV Polisher — AI-assisted, human-approved.</p>
          <p>Nothing is fabricated. Every edit is yours to keep or reject.</p>
        </div>
      </footer>
    </>
  );
}
