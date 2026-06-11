import Link from "next/link";
import { FileText } from "lucide-react";
import { SessionIndicator } from "@/components/session-indicator";

/**
 * Shared top navigation. Solid surface, hairline bottom border — the
 * same bar on every page so the tool reads as one product.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display text-[0.95rem] font-semibold tracking-tight text-foreground"
          aria-label="CV Polisher home"
        >
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <FileText className="size-4" aria-hidden="true" />
          </span>
          CV Polisher
        </Link>
        <SessionIndicator />
      </div>
    </header>
  );
}
