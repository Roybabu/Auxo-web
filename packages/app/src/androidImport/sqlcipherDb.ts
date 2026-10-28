import initSqlite3 from "@evolu/sqlite-wasm";

export class SqlCipherError extends Error {}

export type SqlRow = Record<string, string | number | null | Uint8Array>;

/**
 * Opens the Android app's SQLCipher-encrypted database for reading, using
 * the "SQLite3 Multiple Ciphers" WASM build (which bundles explicit
 * legacy-SQLCipher compatibility — confirmed by the `sqlcipher`/
 * `SQLCipher legacy version` strings baked into its .wasm binary).
 *
 * The 64-hex-character value from the backup's `database.key` entry is
 * used as a *passphrase* to be key-derived (PBKDF2-HMAC-SHA512, SQLCipher 4
 * defaults), not as raw key bytes — confirmed from SQLCipher's own raw-key
 * documentation: raw-key mode requires the literal `x'...'` wrapper bytes
 * to be present in the key material handed to the API, and the Android
 * app's `DatabaseEncryption.kt` passes the plain hex string with no such
 * wrapper, so it goes through ordinary passphrase key derivation.
 */
export async function openAndroidDatabase(databaseBytes: Uint8Array, passphrase: string | null) {
  const sqlite3 = await initSqlite3({
    print: () => {},
    printErr: () => {},
  });

  const filename = "/android-import.db";
  sqlite3.capi.sqlite3_js_posix_create_file(filename, databaseBytes);

  const db = new sqlite3.oo1.DB(filename, "r");

  if (passphrase) {
    db.exec("PRAGMA cipher = 'sqlcipher';");
    db.exec("PRAGMA legacy = 4;");
    db.exec("PRAGMA legacy_page_size = 4096;");
    db.exec(`PRAGMA key = '${sqlEscape(passphrase)}';`);

    try {
      // A wrong key doesn't error on PRAGMA key itself — SQLCipher only
      // discovers the mismatch on the first real page read. This is that
      // first real read, used purely to verify the key is right.
      db.exec("SELECT count(*) FROM sqlite_master;");
    } catch {
      db.close();
      throw new SqlCipherError(
        "Couldn't open this database with the key from the backup. The backup file may be from an incompatible app version, or corrupted."
      );
    }
  }

  return {
    query(sql: string, bind?: unknown[]): SqlRow[] {
      return db.exec(sql, { rowMode: "object", returnValue: "resultRows", bind: bind as never }) as SqlRow[];
    },
    tableExists(name: string): boolean {
      const rows = this.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?;", [name]);
      return rows.length > 0;
    },
    close() {
      db.close();
    },
  };
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}
