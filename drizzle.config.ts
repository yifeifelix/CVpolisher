/**
 * drizzle-kit configuration — governs `npm run db:generate` and
 * `npm run db:studio`. The runtime loader in src/lib/db/index.ts
 * reads migrations from the `out` directory below.
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "./data/cvpolisher.db",
  },
});
