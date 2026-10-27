import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT_VERSION,
  assertSupportedBackupVersion,
  emptyBackupData,
  isAuxoBackupFile,
  type AuxoBackupFile,
} from "./backup.js";

function validBackup(overrides: Partial<AuxoBackupFile> = {}): AuxoBackupFile {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    deviceId: "A3K9QZ",
    data: emptyBackupData(),
    ...overrides,
  };
}

describe("isAuxoBackupFile", () => {
  it("accepts a well-formed backup", () => {
    expect(isAuxoBackupFile(validBackup())).toBe(true);
  });

  it("rejects null, arrays, and primitives", () => {
    expect(isAuxoBackupFile(null)).toBe(false);
    expect(isAuxoBackupFile([])).toBe(false);
    expect(isAuxoBackupFile("backup")).toBe(false);
    expect(isAuxoBackupFile(42)).toBe(false);
  });

  it("rejects an object missing required entity arrays", () => {
    const broken = { ...validBackup(), data: { categories: [] } };
    expect(isAuxoBackupFile(broken)).toBe(false);
  });

  it("rejects when formatVersion/createdAt/deviceId have the wrong type", () => {
    expect(isAuxoBackupFile({ ...validBackup(), formatVersion: "1" })).toBe(false);
    expect(isAuxoBackupFile({ ...validBackup(), createdAt: 123 })).toBe(false);
    expect(isAuxoBackupFile({ ...validBackup(), deviceId: null })).toBe(false);
  });
});

describe("assertSupportedBackupVersion", () => {
  it("accepts the current version", () => {
    expect(() => assertSupportedBackupVersion(validBackup())).not.toThrow();
  });

  it("rejects a backup from a newer, unsupported format version", () => {
    expect(() =>
      assertSupportedBackupVersion(validBackup({ formatVersion: BACKUP_FORMAT_VERSION + 1 }))
    ).toThrow();
  });
});
