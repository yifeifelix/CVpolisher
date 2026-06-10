/**
 * Database client — opens the single SQLite file, runs any pending
 * Drizzle migrations, and exports the typed query builder.
 *
 * Singleton pattern: Next.js dev mode HMR reloads modules; we cache
 * the client on `globalThis` so restart cycles don't leak file
 * handles. In production the module loads once per process.
 *
 * Migration policy: migrations live in `drizzle/` (generated from
 * `src/lib/db/schema.ts` via `npm run db:generate`) and are applied
 * at first import of this module. This removes the "did you remember
 * to run migrations?" footgun — either the server starts and the
 * schema is current, or it fails to start loudly.
 */

import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";

import * as schema from "./schema";

/** Path to the SQLite database file. */
const DB_PATH = path.join(process.cwd(), "data", "cvpolisher.db");

/** Directory holding Drizzle-generated migration SQL files. */
const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

type Db = BetterSQLite3Database<typeof schema>;

interface GlobalWithDb {
  __cvpolisher_db?: Db;
}

const globalForDb = globalThis as unknown as GlobalWithDb;

function createDbClient(): Db {
  // Ensure the data/ directory exists; SQLite will not create it.
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const sqlite = new Database(DB_PATH);

  // Enable foreign key enforcement (off by default in SQLite).
  // Without this, ON DELETE CASCADE clauses in schema.ts are
  // silently ignored, producing orphaned rows.
  sqlite.pragma("foreign_keys = ON");

  // WAL mode gives us concurrent readers during writes, which
  // matters for Litestream replication (ADR-0001 §6 backup).
  sqlite.pragma("journal_mode = WAL");

  const db = drizzle(sqlite, { schema });

  // Apply any pending migrations. First-run creates every table;
  // subsequent runs are no-ops. The migrations folder is generated
  // from schema.ts by `drizzle-kit generate`.
  if (fs.existsSync(MIGRATIONS_FOLDER)) {
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  }

  return db;
}

/**
 * The singleton database client. Typed so `db.query.usersTable.findFirst(...)`
 * style calls get full IntelliSense for the schema defined in this module.
 */
export const db: Db =
  globalForDb.__cvpolisher_db ?? (globalForDb.__cvpolisher_db = createDbClient());

export { schema };
