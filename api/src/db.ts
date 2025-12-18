import Database from "better-sqlite3";

export type Db = Database.Database;

type Stmts = {
  insertEvent: Database.Statement;
  selectLeadByKey: Database.Statement;
  selectEvents: Database.Statement;
  deleteAllEvents: Database.Statement;
  deleteAllLeads: Database.Statement;
};

const stmtCache = new WeakMap<Db, Stmts>();

function getStmts(db: Db): Stmts {
  const cached = stmtCache.get(db);
  if (cached) return cached;

  const stmts: Stmts = {
    insertEvent: db.prepare(
      "INSERT INTO events (lead_id, type, status, detail, created_at) VALUES (?, ?, ?, ?, ?)"
    ),
    selectLeadByKey: db.prepare(
      "SELECT id, email FROM leads WHERE idempotency_key = ? LIMIT 1"
    ),
    selectEvents: db.prepare(
      "SELECT id, lead_id, type, status, detail, created_at FROM events ORDER BY id DESC LIMIT ?"
    ),
    deleteAllEvents: db.prepare("DELETE FROM events"),
    deleteAllLeads: db.prepare("DELETE FROM leads"),
  };

  stmtCache.set(db, stmts);
  return stmts;
}

export function openDb(dbPath: string): Db {
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT NOT NULL,
      company TEXT,
      message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_events_lead_id ON events(lead_id);
  `);

  return db;
}

export function insertEvent(
  db: Db,
  leadId: number | null,
  type: string,
  status: string,
  detail?: string,
  createdAt?: string
) {
  const { insertEvent } = getStmts(db);
  const ts = createdAt ?? new Date().toISOString();
  insertEvent.run(leadId, type, status, detail ?? null, ts);
}

export function getLeadByIdempotencyKey(
  db: Db,
  key: string
): { id: number; email: string } | null {
  const { selectLeadByKey } = getStmts(db);
  const row = selectLeadByKey.get(key) as { id: number; email: string } | undefined;
  return row ?? null;
}

export function listEvents(db: Db, limit: number) {
  const { selectEvents } = getStmts(db);
  return selectEvents.all(limit) as Array<{
    id: number;
    lead_id: number | null;
    type: string;
    status: string;
    detail: string | null;
    created_at: string;
  }>;
}

export function clearEvents(db: Db, vacuum = false): number {
  const { deleteAllEvents } = getStmts(db);
  const info = deleteAllEvents.run();

  // VACUUM can't run inside a transaction reliably, so keep it outside.
  if (vacuum) db.exec("VACUUM");
  return info.changes;
}

export function resetDemo(db: Db, vacuum = false): { deletedEvents: number; deletedLeads: number } {
  const { deleteAllEvents, deleteAllLeads } = getStmts(db);

  const tx = db.transaction(() => {
    const ev = deleteAllEvents.run().changes;
    const ld = deleteAllLeads.run().changes;

    // Reset AUTOINCREMENT counters (for demo)
    try {
      const hasSeq = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence' LIMIT 1")
        .get();
      if (hasSeq) {
        db.exec("DELETE FROM sqlite_sequence WHERE name IN ('leads','events');");
      }
    } catch {
      // If sqlite_sequence isn't there yet, not a problem.
    }

    return { deletedEvents: ev, deletedLeads: ld };
  });

  const result = tx();
  if (vacuum) db.exec("VACUUM");
  return result;
}
