import type { Entity, Repository, UUID } from "@auxo/core";
import { getDatabase, scheduleSave } from "./sqlite.js";

/**
 * Generic SQLite-backed Repository<T>. Records are stored as JSON blobs
 * in a single `records` table keyed by (entity_type, id) rather than one
 * normalized table per entity. That trades some query performance for a
 * much smaller amount of boilerplate while the schema is still settling
 * across steps 3–7; if a specific entity later needs real relational
 * queries or indices (billing/reporting), it can get a dedicated table
 * then without changing this port or its callers.
 */
export class SqliteRepository<T extends Entity> implements Repository<T> {
  constructor(private readonly entityType: string) {}

  async list(): Promise<T[]> {
    return this.query("SELECT data FROM records WHERE entity_type = :type AND deleted_at IS NULL");
  }

  async listAll(): Promise<T[]> {
    return this.query("SELECT data FROM records WHERE entity_type = :type");
  }

  async get(id: UUID): Promise<T | null> {
    const db = getDatabase();
    const stmt = db.prepare("SELECT data FROM records WHERE entity_type = :type AND id = :id");
    stmt.bind({ ":type": this.entityType, ":id": id });
    const row = stmt.step() ? (stmt.getAsObject() as { data: string }) : null;
    stmt.free();
    return row ? (JSON.parse(row.data) as T) : null;
  }

  async save(record: T): Promise<void> {
    const db = getDatabase();
    db.run(
      `INSERT INTO records (entity_type, id, data, updated_at, deleted_at)
       VALUES (:type, :id, :data, :updatedAt, :deletedAt)
       ON CONFLICT(entity_type, id) DO UPDATE SET
         data = excluded.data,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at`,
      {
        ":type": this.entityType,
        ":id": record.id,
        ":data": JSON.stringify(record),
        ":updatedAt": record.updatedAt,
        ":deletedAt": record.deletedAt,
      }
    );
    scheduleSave();
  }

  async softDelete(id: UUID): Promise<void> {
    const existing = await this.get(id);
    if (!existing) return;
    const deletedAt = new Date().toISOString();
    await this.save({ ...existing, deletedAt, updatedAt: deletedAt });
  }

  private query(sql: string): T[] {
    const db = getDatabase();
    const stmt = db.prepare(sql);
    stmt.bind({ ":type": this.entityType });
    const results: T[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { data: string };
      results.push(JSON.parse(row.data) as T);
    }
    stmt.free();
    return results;
  }
}
