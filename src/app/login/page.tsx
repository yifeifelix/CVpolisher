import { signIn } from "@/lib/auth/auth";
import { Button } from "@/components/ui/button";

/**
 * v1 login page — Google OAuth only (ADR-0005 §1). The form action is
 * a Server Action invoking NextAuth's server-side signIn; the pattern
 * is the documented v5 shape (next-auth/index.d.ts:218-230).
 */
export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Sign in to CV Polisher
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        v1 supports Google sign-in only. Email + password is planned for a
        later release.
      </p>
      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <Button type="submit" size="lg">
          Sign in with Google
        </Button>
      </form>
    </main>
  );
}
