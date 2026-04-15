import Database from "better-sqlite3";
import path from "path";

export interface SessionRow {
  id: string;
  cv_input: string;
  jd_input: string | null;
  provider: string;
  model: string;
  result: string;
  created_at: string;
}

export interface RecentSessionSummary {
  id: string;
  created_at: string;
  jd_snippet: string | null;
  atsScore: number | null;
}

export interface CreateSessionParams {
  id: string;
  cvInput: string;
  jdInput: string | null;
  provider: string;
  model: string;
  result: string;
}

const DB_PATH = path.join(process.cwd(), "data", "cvpolisher.db");

let dbInstance: Database.Database | null = null;

export function initDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = new Database(DB_PATH);

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      cv_input   TEXT NOT NULL,
      jd_input   TEXT,
      provider   TEXT NOT NULL,
      model      TEXT NOT NULL,
      result     TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return dbInstance;
}

export function createSession(params: CreateSessionParams): void {
  const db = initDb();

  const stmt = db.prepare(`
    INSERT INTO sessions (id, cv_input, jd_input, provider, model, result)
    VALUES (@id, @cvInput, @jdInput, @provider, @model, @result)
  `);

  stmt.run({
    id: params.id,
    cvInput: params.cvInput,
    jdInput: params.jdInput,
    provider: params.provider,
    model: params.model,
    result: params.result,
  });
}

export function getSession(id: string): SessionRow | null {
  const db = initDb();

  const stmt = db.prepare<[string], SessionRow>(
    "SELECT * FROM sessions WHERE id = ?",
  );

  return stmt.get(id) ?? null;
}

export function getRecentSessions(limit = 10): RecentSessionSummary[] {
  const db = initDb();

  const stmt = db.prepare<[number], Pick<SessionRow, 'id' | 'created_at' | 'jd_input' | 'result'>>(`
    SELECT id, created_at, jd_input, result
    FROM sessions
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit);

  return rows.map((row) => {
    let atsScore: number | null = null;

    try {
      const parsed = JSON.parse(row.result) as { atsScore?: number };
      atsScore = typeof parsed.atsScore === "number" ? parsed.atsScore : null;
    } catch {
      // result JSON is malformed — leave atsScore as null
    }

    return {
      id: row.id,
      created_at: row.created_at,
      jd_snippet:
        row.jd_input != null ? row.jd_input.slice(0, 100) : null,
      atsScore,
    };
  });
}
