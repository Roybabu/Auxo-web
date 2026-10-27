import { newId, type UUID } from "./ids.js";

/** ISO-8601 timestamp string (UTC), e.g. "2026-10-28T01:57:00.000Z". */
export type ISODateTime = string;

export function nowISO(): ISODateTime {
  return new Date().toISOString();
}

/**
 * Fields shared by every stored record.
 *
 * - Soft deletes (`deletedAt`) instead of row removal, so deletions are
 *   just another timestamped fact that can be synced/undone later.
 * - `createdAt`/`updatedAt` are set by the storage layer, never computed
 *   ad hoc in UI code.
 */
export interface Entity {
  id: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null;
}

/** Creates the base fields for a brand-new entity. */
export function newEntityBase(): Entity {
  const ts = nowISO();
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}

export function isDeleted(entity: Entity): boolean {
  return entity.deletedAt !== null;
}

export function touch<T extends Entity>(entity: T): T {
  return { ...entity, updatedAt: nowISO() };
}

export function softDelete<T extends Entity>(entity: T): T {
  const ts = nowISO();
  return { ...entity, deletedAt: ts, updatedAt: ts };
}
