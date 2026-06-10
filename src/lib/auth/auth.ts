/**
 * NextAuth v5 wiring — v1 Google-OAuth-only auth shape.
 *
 * Spec: docs/adr/0005-v1-auth-shape.md.
 *
 * - §1/§2: Google-only provider list, database session strategy
 * - §3: signIn callback gates on Google's email_verified
 * - §5: events.createUser mints app_users_meta atomically (path A);
 *   the session callback lazily recovers a missing row (path B)
 * - §6: session callback hydrates tier / superTokens / bonusRemaining
 *   / quotaPhase onto session.user
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
import { and, eq, gt } from 'drizzle-orm';

import { db } from '@/lib/db/index';
import {
  usersTable,
  accountsTable,
  sessionsTable,
  verificationTokensTable,
  appUsersMetaTable,
  quotaEventsTable,
} from '@/lib/db/schema';
import { buildInitialMeta } from '@/lib/quota/initial-meta';
import {
  derivePhase,
  REFILL_WINDOW_MS,
  type QuotaState,
} from '@/lib/quota/engine';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable,
    accountsTable,
    sessionsTable,
    verificationTokensTable,
  }),
  providers: [Google],
  session: { strategy: 'database' },
  callbacks: {
    // ADR-0005 §3 — Google identities must arrive pre-verified.
    // `false` aborts the flow before any user row is created; the
    // browser lands on /api/auth/error?error=AccessDenied.
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        return profile?.email_verified === true;
      }
      return true;
    },
    // ADR-0005 §6 — hydrate business state onto the session.
    // §5 path B — lazy recovery when events.createUser never ran.
    async session({ session, user }) {
      let meta = await db
        .select()
        .from(appUsersMetaTable)
        .where(eq(appUsersMetaTable.userId, user.id))
        .get();

      if (!meta) {
        console.warn(
          `[auth] app_users_meta missing for user ${user.id}, recovering`,
        );
        await db
          .insert(appUsersMetaTable)
          .values(buildInitialMeta(user.id))
          .onConflictDoNothing({ target: appUsersMetaTable.userId });
        meta = await db
          .select()
          .from(appUsersMetaTable)
          .where(eq(appUsersMetaTable.userId, user.id))
          .get();
      }
      if (!meta) {
        // Unreachable unless the row was deleted between the recovery
        // insert and this re-read; fail loudly rather than serve a
        // session with fabricated business state.
        throw new Error(
          `[auth] app_users_meta unrecoverable for user ${user.id}`,
        );
      }

      // One quota_events query serves both QuotaState inputs: events
      // inside the 5h refill window and today's free-pool count.
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(0, 0, 0, 0);
      const windowStart = new Date(now.getTime() - REFILL_WINDOW_MS);
      const since = midnight < windowStart ? midnight : windowStart;

      const events = await db
        .select({ createdAt: quotaEventsTable.createdAt })
        .from(quotaEventsTable)
        .where(
          and(
            eq(quotaEventsTable.userId, user.id),
            gt(quotaEventsTable.createdAt, since),
          ),
        )
        .all();

      const state: QuotaState = {
        tier: meta.tier,
        bonusRemaining: meta.bonusRemaining,
        slidingTimerStartedAt: meta.slidingTimerStartedAt,
        recentFreepoolEvents: events
          .map((e) => e.createdAt)
          .filter((t) => t.getTime() > windowStart.getTime()),
        todayFreepoolCount: events.filter(
          (e) => e.createdAt.getTime() >= midnight.getTime(),
        ).length,
        superTokens: meta.superTokens,
      };

      session.user.id = user.id;
      session.user.tier = meta.tier;
      session.user.superTokens = meta.superTokens;
      session.user.bonusRemaining = meta.bonusRemaining;
      session.user.quotaPhase = derivePhase(state, now);
      // `session` arrives as { ...dbSessionRow, user } — returning it
      // verbatim leaks sessionToken/userId into the response JSON.
      // Return only the public Session shape. (expires is typed as an
      // ISO string but the database adapter hands us a Date at runtime.)
      const expires: unknown = session.expires;
      return {
        user: session.user,
        expires: expires instanceof Date ? expires.toISOString() : String(expires),
      };
    },
  },
  events: {
    // ADR-0005 §5 path A — atomic INSERT OR IGNORE, no TOCTOU window.
    // Deliberately no try/catch: failure recovery belongs to the
    // session callback's lazy path (D.4, §5 path B), and overlapping
    // mechanisms make it impossible to tell which one saved a user.
    async createUser({ user }) {
      if (!user.id) return;
      await db
        .insert(appUsersMetaTable)
        .values(buildInitialMeta(user.id))
        .onConflictDoNothing({ target: appUsersMetaTable.userId });
    },
  },
});
