import type { KeyValueStore, SettingsStore } from "@auxo/core";
import { getDatabase, scheduleSave } from "./sqlite.js";

/** SQLite-backed implementation of @auxo/core's KeyValueStore/SettingsStore ports. */
export class SqliteKeyValueStore implements KeyValueStore, SettingsStore {
  async get(key: string): Promise<string | null> {
    const db = getDatabase();
    const stmt = db.prepare("SELECT value FROM kv WHERE key = :key");
    stmt.bind({ ":key": key });
    const row = stmt.step() ? (stmt.getAsObject() as { value: string }) : null;
    stmt.free();
    return row ? row.value : null;
  }

  async set(key: string, value: string): Promise<void> {
    const db = getDatabase();
    db.run(
      `INSERT INTO kv (key, value) VALUES (:key, :value)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      { ":key": key, ":value": value }
    );
    scheduleSave();
  }

  async delete(key: string): Promise<void> {
    const db = getDatabase();
    db.run("DELETE FROM kv WHERE key = :key", { ":key": key });
    scheduleSave();
  }

  /** All key/value pairs — used by backup export. */
  async entries(): Promise<Record<string, string>> {
    const db = getDatabase();
    const stmt = db.prepare("SELECT key, value FROM kv");
    const out: Record<string, string> = {};
    while (stmt.step()) {
      const row = stmt.getAsObject() as { key: string; value: string };
      out[row.key] = row.value;
    }
    stmt.free();
    return out;
  }
}
