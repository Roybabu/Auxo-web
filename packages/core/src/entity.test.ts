import { describe, expect, it } from "vitest";
import { newEntityBase, isDeleted, softDelete, touch } from "./entity.js";

describe("entity", () => {
  it("creates a new entity with a UUID and matching timestamps", () => {
    const e = newEntityBase();
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(e.createdAt).toBe(e.updatedAt);
    expect(e.deletedAt).toBeNull();
    expect(isDeleted(e)).toBe(false);
  });

  it("softDelete sets deletedAt and bumps updatedAt", () => {
    const e = newEntityBase();
    const deleted = softDelete(e);
    expect(deleted.deletedAt).not.toBeNull();
    expect(isDeleted(deleted)).toBe(true);
    expect(deleted.id).toBe(e.id);
  });

  it("touch updates updatedAt without touching createdAt or id", () => {
    const e = newEntityBase();
    const touched = touch(e);
    expect(touched.createdAt).toBe(e.createdAt);
    expect(touched.id).toBe(e.id);
  });

  it("generates distinct ids across entities", () => {
    const a = newEntityBase();
    const b = newEntityBase();
    expect(a.id).not.toBe(b.id);
  });
});
