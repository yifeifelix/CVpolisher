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
      <Link
        href="/login"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline">
        {session.user.email}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => signOut({ redirectTo: "/login" })}
      >
        Sign out
      </Button>
    </div>
  );
}
