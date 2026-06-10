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
      <Link href="/login">
        <Button variant="outline" size="sm">
          Sign in
        </Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-500">{session.user.email}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign out
      </Button>
    </div>
  );
}
