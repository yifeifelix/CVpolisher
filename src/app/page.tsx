import { CvInputForm } from "@/components/cv-input-form";
import { HistoryList } from "@/components/history-list";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          CV Polisher
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Polish your CV with AI-powered ATS optimisation
        </p>
      </header>

      <CvInputForm />

      <Separator className="my-10" />

      <section>
        <h2 className="text-xl font-semibold text-slate-800 mb-4">
          Recent Sessions
        </h2>
        <HistoryList />
      </section>
    </main>
  );
}
