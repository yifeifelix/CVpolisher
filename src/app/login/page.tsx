import { FileText } from "lucide-react";
import { signIn } from "@/lib/auth/auth";
import { Button } from "@/components/ui/button";

/**
 * v1 login page — Google OAuth only (ADR-0005 §1). The form action is
 * a Server Action invoking NextAuth's server-side signIn; the pattern
 * is the documented v5 shape (next-auth/index.d.ts:218-230).
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="reveal flex flex-col items-center">
        <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <FileText className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-3 font-display text-base font-semibold tracking-tight">
          CV Polisher
        </p>
      </div>

      <div className="panel-raised reveal reveal-2 mt-8 w-full max-w-sm px-6 py-8 text-center sm:px-8">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Sign in to start polishing
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          v1 supports Google only — email + password is planned for a later
          release.
        </p>

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit" size="lg" className="w-full">
            Continue with Google
          </Button>
        </form>
      </div>

      <p className="reveal reveal-3 mt-6 text-xs text-muted-foreground">
        New accounts include six free polishes.
      </p>
    </main>
  );
}
