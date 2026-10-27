import type { Entity } from "./entity.js";
import type { UUID } from "./ids.js";

/**
 * Generic storage port for a single entity type. Implemented by the
 * browser's SQLite-WASM layer today; a desktop (Tauri) or server
 * implementation can satisfy the same interface later without core
 * or UI code changing.
 */
export interface Repository<T extends Entity> {
  /** All non-deleted records. */
  list(): Promise<T[]>;
  /** All records including soft-deleted ones — used for backup/export and sync. */
  listAll(): Promise<T[]>;
  get(id: UUID): Promise<T | null>;
  /** Upsert — callers pass the full record, already carrying updated timestamps. */
  save(record: T): Promise<void>;
  softDelete(id: UUID): Promise<void>;
}

export interface SettingsStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
