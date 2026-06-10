import { signIn } from "@/lib/auth/auth";
import { Button } from "@/components/ui/button";

/**
 * v1 login page — Google OAuth only (ADR-0005 §1). The form action is
 * a Server Action invoking NextAuth's server-side signIn; the pattern
 * is the documented v5 shape (next-auth/index.d.ts:218-230).
 */
export default function LoginPage() {
  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center px-6 pt-28 pb-24 text-center">
      <p className="reveal font-mono text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground">
        CV<span className="text-accent">·</span>Polisher — title page
      </p>

      <h1 className="reveal reveal-2 mt-8 font-display text-5xl leading-tight font-medium tracking-tight">
        The <em className="marker italic">editor</em> will see you now.
      </h1>

      <div className="reveal reveal-3 mt-8 h-[3px] w-16 bg-accent" />

      <p className="reveal reveal-3 mt-8 text-sm leading-relaxed text-muted-foreground">
        Sign in to start polishing. v1 supports Google only — email +
        password is planned for a later edition.
      </p>

      <form
        className="reveal reveal-4 mt-10"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <Button type="submit" size="lg" className="px-8">
          Continue with Google
        </Button>
      </form>

      <p className="reveal reveal-5 mt-16 font-mono text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground/70">
        Six polishes on the house for new signatures
      </p>
    </main>
  );
}
