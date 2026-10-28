import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openAndroidDatabase, SqlCipherError } from "./sqlcipherDb.js";

/**
 * This fixture was NOT created by this project's own code — it was written
 * with Python's `sqlcipher3` binding (genuine SQLCipher 4.12.0, the same
 * major version family the Android app uses via net.zetetic:sqlcipher-
 * android:4.6.1). That makes this a real cross-implementation test: if
 * openAndroidDatabase() can read it, the PRAGMA sequence here is
 * compatible with actual SQLCipher 4 output, not just internally
 * consistent with itself.
 */
const FIXTURE_PATH = fileURLToPath(new URL("./__fixtures__/real-sqlcipher.db", import.meta.url));
const FIXTURE_PASSPHRASE = "b".repeat(64);

describe("openAndroidDatabase against a database from a real, independent SQLCipher implementation", () => {
  it("opens it and reads back the real data with the correct passphrase", async () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE_PATH));
    const db = await openAndroidDatabase(bytes, FIXTURE_PASSPHRASE);
    const rows = db.query("SELECT name, price_minor FROM products ORDER BY id;");
    expect(rows).toEqual([
      { name: "Rice 1kg", price_minor: 9000 },
      { name: "Sugar 1kg", price_minor: 4500 },
    ]);
    db.close();
  });

  it("rejects the wrong passphrase", async () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE_PATH));
    await expect(openAndroidDatabase(bytes, "c".repeat(64))).rejects.toThrow(SqlCipherError);
  });
});
