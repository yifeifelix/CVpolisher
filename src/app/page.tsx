import { CvInputForm } from "@/components/cv-input-form";
import { HistoryList } from "@/components/history-list";
import { SessionIndicator } from "@/components/session-indicator";

export default function Home() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 sm:px-10 lg:px-16">
      <header className="reveal flex items-baseline justify-between gap-4 pt-8">
        <p className="font-mono text-xs font-medium tracking-[0.22em] uppercase">
          CV<span className="text-accent">·</span>Polisher
        </p>
        <SessionIndicator />
      </header>

      <section className="pt-20 pb-16 sm:pt-28">
        <p className="reveal reveal-2 font-mono text-[0.7rem] tracking-[0.3em] uppercase text-accent">
          AI-assisted CV editing — Nº 001
        </p>
        <h1 className="reveal reveal-3 mt-6 max-w-3xl font-display text-5xl leading-[1.04] font-medium tracking-tight text-balance sm:text-7xl">
          A rough draft goes in. A <em className="marker italic">polished</em>{" "}
          CV comes out.
        </h1>
        <p className="reveal reveal-4 mt-8 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Paste your CV, add the job description, and let the editor rework
          every line for the ATS parsers that read it first — and the humans
          who read it second.
        </p>
      </section>

      <section className="reveal reveal-5">
        <div className="sheet relative rounded-[var(--radius)] p-6 sm:p-10">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-accent" />
          <p className="absolute -top-3 left-6 bg-background px-2 font-mono text-[0.65rem] tracking-[0.25em] uppercase text-muted-foreground sm:left-10">
            Draft Nº 1 — working copy
          </p>
          <CvInputForm />
        </div>
      </section>

      <section className="mt-24">
        <div className="mb-6 flex items-baseline gap-4">
          <h2 className="font-display text-3xl font-medium italic">
            Past drafts
          </h2>
          <div className="h-px flex-1 translate-y-[-0.35em] bg-border" />
        </div>
        <HistoryList />
      </section>

      <footer className="mt-28 border-t border-border pt-6">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground">
          Set in Fraunces &amp; Spline Sans — edited by machines, read by
          people
        </p>
      </footer>
    </div>
  );
}
