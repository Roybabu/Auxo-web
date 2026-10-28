import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { AndroidBackupError, extractAndroidBackup } from "./androidBackupArchive.js";

function buildZip(overrides: {
  manifest?: string;
  database?: Uint8Array;
  databaseKey?: string | null;
}): Uint8Array {
  const manifest =
    overrides.manifest ??
    [
      "app=auxo",
      "format=1",
      "created=1700000000000",
      "database_version=23",
      "app_version=1.0.0",
      "shop=Roy Stores",
    ].join("\n");

  const files: Record<string, Uint8Array> = {
    "manifest.properties": new TextEncoder().encode(manifest),
    "auxo.db": overrides.database ?? new TextEncoder().encode("SQLite format 3\u0000fake content"),
  };
  if (overrides.databaseKey !== null) {
    files["database.key"] = new TextEncoder().encode(
      overrides.databaseKey ?? "a".repeat(64)
    );
  }
  return zipSync(files);
}

describe("extractAndroidBackup", () => {
  it("parses a well-formed backup", () => {
    const zip = buildZip({});
    const result = extractAndroidBackup(zip);
    expect(result.manifest.app).toBe("auxo");
    expect(result.manifest.shopName).toBe("Roy Stores");
    expect(result.manifest.databaseVersion).toBe(23);
    expect(result.databaseKey).toBe("a".repeat(64));
    expect(new TextDecoder().decode(result.database)).toContain("SQLite format 3");
  });

  it("works without a database.key entry (unlocked database)", () => {
    const zip = buildZip({ databaseKey: null });
    const result = extractAndroidBackup(zip);
    expect(result.databaseKey).toBeNull();
  });

  it("rejects a backup from a different app", () => {
    const zip = buildZip({ manifest: "app=someotherapp\nformat=1\ndatabase_version=1\n" });
    expect(() => extractAndroidBackup(zip)).toThrow(AndroidBackupError);
  });

  it("rejects a backup from a newer, unsupported format version", () => {
    const zip = buildZip({ manifest: "app=auxo\nformat=99\ndatabase_version=1\n" });
    expect(() => extractAndroidBackup(zip)).toThrow(AndroidBackupError);
  });

  it("rejects a malformed database key", () => {
    const zip = buildZip({ databaseKey: "not-a-valid-hex-key" });
    expect(() => extractAndroidBackup(zip)).toThrow(AndroidBackupError);
  });

  it("rejects something that isn't a zip at all", () => {
    expect(() => extractAndroidBackup(new TextEncoder().encode("not a zip file"))).toThrow(AndroidBackupError);
  });

  it("rejects a zip missing the manifest", () => {
    const zip = zipSync({ "auxo.db": new TextEncoder().encode("data") });
    expect(() => extractAndroidBackup(zip)).toThrow(AndroidBackupError);
  });
});
