/**
 * Drizzle schema — authoritative column list for the content-free
 * database. This file is the forward direction referenced by ADR-0001
 * §6 (in the Superseded-by-ADR-0003 annotation block).
 *
 * Layout:
 * - NextAuth tables (`user`, `account`, `session`, `verificationToken`)
 *   are hand-written here in the exact shape expected by
 *   `@auth/drizzle-adapter`. The adapter has an internal
 *   `defineTables()` helper but it is not exported; per the adapter's
 *   official docs you supply your own schema and pass it to
 *   `DrizzleAdapter(db, { usersTable, accountsTable, ... })`. Copied
 *   from the upstream SQLite default so signup / OAuth / magic link
 *   all just work.
 * - Business tables (app_users_meta, quota_events, payments,
 *   rate_limit_events) are defined below. Column naming follows
 *   CONTEXT.md §Super token, §Quota lifecycle, §Rate limit event.
 *
 * Migration policy: `npm run db:generate` emits SQL in `drizzle/`.
 * Server boot applies any pending migration via `migrate()` (see
 * src/lib/db/index.ts). Editing this file without running
 * db:generate + committing the SQL diff is a bug.
 */

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// --- NextAuth-managed tables --------------------------------------------
//
// Shape must stay byte-for-byte compatible with the adapter's default
// (see https://github.com/nextauthjs/next-auth/blob/main/packages/adapter-drizzle/src/lib/sqlite.ts).
// Diverging here silently breaks createUser / linkAccount / etc.

export const usersTable = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accountsTable = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessionsTable = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokensTable = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => [
    primaryKey({
      columns: [vt.identifier, vt.token],
    }),
  ],
);

// --- Auth-adjacent tables (owned by us, not NextAuth) -------------------

/**
 * Password credentials for users who registered via the credentials
 * provider. OAuth-only users have no row here. Kept separate from the
 * NextAuth `user` table per ADR-0004 §5 — a nullable password_hash on
 * `user` would be a schema lie about OAuth users, and future auth
 * methods (passkeys / 2FA) belong on this table's side of the boundary
 * rather than bloating `user`.
 *
 * `password_hash` format is pinned by ADR-0004 §2:
 *
 *   scrypt:N=131072,r=8,p=1:<16-byte-salt-hex>:<64-byte-hash-hex>
 *
 * The algorithm name and parameters are embedded so parameter upgrades
 * are a hot re-hash at next login, not a schema migration.
 *
 * `updated_at` is touched on every successful hot re-hash so that
 * "users still on legacy parameters" is a queryable set.
 */
export const credentialsTable = sqliteTable("credentials", {
  userId: text("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// --- Business tables ----------------------------------------------------
//
// Every business column is justified by a CONTEXT.md / ADR reference
// in its inline comment. Changes here require updating the reference.

/**
 * Per-user business state. Row is created at signup (bonus allocated
 * after email verification, per ADR-0001 §2) and lives for the
 * user's lifetime.
 *
 * Authoritative for: tier gating, bonus countdown, refill timer,
 * super token balance.
 */
export const appUsersMetaTable = sqliteTable("app_users_meta", {
  /** PK + FK to user.id. One row per user. */
  userId: text("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  /**
   * Billing tier. 'free' at signup; 'paid' after first successful
   * super-token purchase (tier is latched, see CONTEXT.md §Tier).
   */
  tier: text("tier", { enum: ["free", "paid"] })
    .notNull()
    .default("free"),

  /**
   * Free-pool bonus counter. Set to 6 on email verification per
   * CONTEXT.md §Quota lifecycle phase 1; decremented on each
   * bonus-phase polish. Never refills.
   */
  bonusRemaining: integer("bonus_remaining").notNull().default(0),

  /**
   * Paid entitlement balance. Renamed from `credits` per ADR-0003
   * §1 (and pinned in the ADR-0001 §6 annotation block). One unit
   * pays for one polish OR one PDF export. Does not expire.
   */
  superTokens: integer("super_tokens").notNull().default(0),

  /**
   * Set at the moment bonus exhausts (phase 1 → 2 transition,
   * CONTEXT.md §Quota lifecycle). NULL in phases 1 and 4. The 5h
   * window for the first refill is computed relative to this value.
   * Cleared when the first refill tick fires.
   */
  slidingTimerStartedAt: integer("sliding_timer_started_at", {
    mode: "timestamp_ms",
  }),
});

/**
 * Free-pool polish event log. Used by the quota engine to compute
 * refill-remaining in phase 4 (steady state) via a COUNT over the
 * last 5h. Super-token polishes do NOT insert a row here — the
 * paid pool is independent of refill accounting.
 *
 * event_type is kept as a column for forward compatibility but today
 * the only value written is 'polish', per the ADR-0001 §6 annotation.
 */
export const quotaEventsTable = sqliteTable(
  "quota_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    eventType: text("event_type", { enum: ["polish"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("quota_events_user_created_idx").on(t.userId, t.createdAt)],
);

/**
 * Stripe payment log. One row per successful Checkout completion,
 * keyed by the Stripe Checkout Session ID (so webhook replays are
 * naturally idempotent, see ADR-0001 §8).
 *
 * `tokens_granted` renamed from `credits_granted` per ADR-0003 §1.
 */
export const paymentsTable = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** Price paid in GBP pence, e.g. 500 for £5. */
    amountPence: integer("amount_pence").notNull(),
    /** Stripe Checkout Session ID. UNIQUE — webhook idempotency key. */
    stripeSessionId: text("stripe_session_id").notNull(),
    /** Number of super tokens this purchase added to app_users_meta. */
    tokensGranted: integer("tokens_granted").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("payments_stripe_session_id_uidx").on(t.stripeSessionId),
  ],
);

/**
 * Rate-limit attempt log. Final column set pinned by the ADR-0001 §6
 * annotation block. Dual role per CONTEXT.md §Rate limit event:
 *
 * - Enforcement — the rate-limit engine reads recent rows for a given
 *   (key_type, key_value) to decide the next attempt.
 * - Observability — daily digests count denials per key_type over
 *   time.
 *
 * `event_type` is a coarse bucket ('signup' for MVP) so the same
 * table can one day serve polish-rate enforcement; `key_type`
 * vocabulary is ('ip', 'email_domain') for MVP, with room to grow.
 */
export const rateLimitEventsTable = sqliteTable(
  "rate_limit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    keyType: text("key_type", { enum: ["ip", "email_domain"] }).notNull(),
    keyValue: text("key_value").notNull(),
    eventType: text("event_type", { enum: ["signup"] }).notNull(),
    outcome: text("outcome", { enum: ["allowed", "denied"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("rate_limit_events_key_created_idx").on(
      t.keyType,
      t.keyValue,
      t.createdAt,
    ),
  ],
);
