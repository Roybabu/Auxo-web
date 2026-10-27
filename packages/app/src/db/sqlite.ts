import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { get as idbGet, set as idbSet } from "idb-keyval";

/**
 * Browser SQLite layer.
 *
 * sql.js runs SQLite compiled to WASM entirely in memory — there is no
 * native file handle to write to. So the whole database file (a single
 * byte blob) is persisted into IndexedDB after each write, debounced so
 * rapid edits don't thrash storage. This is simpler and more broadly
 * supported than OPFS-backed SQLite, at the cost of re-serializing the
 * whole DB on save; fine for a single shop's data, revisit if that ever
 * becomes a bottleneck.
 */

const IDB_KEY = "auxo-sqlite-db";
const SAVE_DEBOUNCE_MS = 400;

let sqlJs: SqlJsStatic | null = null;
let db: Database | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savePromiseChain: Promise<void> = Promise.resolve();

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS records (
  entity_type TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (entity_type, id)
);
CREATE INDEX IF NOT EXISTS idx_records_type ON records(entity_type);
CREATE INDEX IF NOT EXISTS idx_records_type_deleted ON records(entity_type, deleted_at);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/**
 * Requests that the browser not evict this origin's storage under
 * pressure. Best-effort — not supported everywhere, and the browser can
 * still say no. Called once, during database init.
 */
async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // Non-fatal: the app still works, just without the persistence hint.
  }
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  await requestPersistentStorage();

  sqlJs ??= await initSqlJs({
    locateFile: (file: string) => `${import.meta.env.BASE_URL}${file}`,
  });

  const existing = await idbGet<Uint8Array>(IDB_KEY);
  db = existing ? new sqlJs.Database(existing) : new sqlJs.Database();
  db.run(SCHEMA_SQL);

  return db;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error("Database not initialized — call initDatabase() first");
  }
  return db;
}

/** Call after any write. Debounced so a burst of writes saves once. */
export function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    savePromiseChain = savePromiseChain.then(saveNow);
  }, SAVE_DEBOUNCE_MS);
}

/** Persists immediately — use before the page unloads or after a restore. */
export async function saveNow(): Promise<void> {
  if (!db) return;
  const bytes = db.export();
  await idbSet(IDB_KEY, bytes);
}

/** Replaces the entire in-memory database (used by restore). */
export async function replaceDatabase(bytes: Uint8Array): Promise<void> {
  if (!sqlJs) {
    sqlJs = await initSqlJs({
      locateFile: (file: string) => `${import.meta.env.BASE_URL}${file}`,
    });
  }
  db?.close();
  db = new sqlJs.Database(bytes);
  db.run(SCHEMA_SQL);
  await saveNow();
}

/** Wipes all data but keeps the schema — used before a JSON import. */
export function clearAllTables(): void {
  const database = getDatabase();
  database.run("DELETE FROM records; DELETE FROM kv;");
}
