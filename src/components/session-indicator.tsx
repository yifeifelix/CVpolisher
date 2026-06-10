"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

/**
 * Header session indicator (HANDOFF §D.5). Client component so it can
 * read the SessionProvider context; shows the signed-in email and a
 * sign-out button, or a sign-in link when anonymous.
 */
export function SessionIndicator() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return null;
  }

  if (!session?.user) {
    return (
      <Link href="/login" className="proof-link font-mono text-xs tracking-[0.18em] uppercase">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-baseline gap-4">
      <span className="font-mono text-xs tracking-wide text-muted-foreground">
        {session.user.email}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="font-mono text-[0.7rem] tracking-[0.15em] uppercase"
        onClick={() => signOut({ redirectTo: "/login" })}
      >
        Sign out
      </Button>
    </div>
  );
}
