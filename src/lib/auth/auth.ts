/**
 * NextAuth v5 wiring — v1 Google-OAuth-only auth shape.
 *
 * Spec: docs/adr/0005-v1-auth-shape.md §1, §2, §7a.
 *
 * D.2 lands the skeleton (provider + adapter + session strategy).
 * `events.createUser` (per §5) and `callbacks.session` / `callbacks.signIn`
 * (per §3, §6) arrive in D.3 and D.4 respectively. This file's config
 * object intentionally has no `callbacks` / `events` keys yet — the
 * surface area is wiring only.
 *
 * `trustHost` is deliberately not passed: @auth/core/lib/utils/env.js
 * auto-detects via the AUTH_URL ?? AUTH_TRUST_HOST ?? VERCEL ?? CF_PAGES
 * ?? NODE_ENV !== "production" chain. Setting it explicitly to
 * `process.env.AUTH_TRUST_HOST === "true"` would clobber the dev
 * auto-true with a hard false. See ADR-0005 §7a.
 */

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';

import { db } from '@/lib/db/index';
import {
  usersTable,
  accountsTable,
  sessionsTable,
  verificationTokensTable,
} from '@/lib/db/schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable,
    accountsTable,
    sessionsTable,
    verificationTokensTable,
  }),
  providers: [Google],
  session: { strategy: 'database' },
});
