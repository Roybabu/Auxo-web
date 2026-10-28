import { unzipSync } from "fflate";
import { parseJavaProperties } from "./javaProperties.js";

/** Mirrors BackupArchive.kt's entry names. */
const MANIFEST_ENTRY = "manifest.properties";
const DATABASE_ENTRY = "auxo.db";
const DATABASE_KEY_ENTRY = "database.key";

export class AndroidBackupError extends Error {}

export interface AndroidBackupManifest {
  app: string;
  format: number;
  createdAtMillis: number;
  databaseVersion: number;
  appVersion: string;
  shopName: string;
}

export interface ExtractedAndroidBackup {
  manifest: AndroidBackupManifest;
  /** The (still SQLCipher-encrypted) database file bytes. */
  database: Uint8Array;
  /** The passphrase the database is encrypted with — see sqlcipherDb.ts for why this is treated as a passphrase, not a raw key. */
  databaseKey: string | null;
}

const KEY_FORMAT = /^[0-9a-f]{64}$/;

/** Unzips the (already passphrase-decrypted, if applicable) backup and parses its entries. */
export function extractAndroidBackup(zipBytes: Uint8Array): ExtractedAndroidBackup {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch {
    throw new AndroidBackupError("This doesn't look like a valid Auxo backup file (couldn't read it as a zip).");
  }

  const manifestBytes = entries[MANIFEST_ENTRY];
  if (!manifestBytes) {
    throw new AndroidBackupError("This file doesn't look like an Auxo app backup (missing manifest).");
  }
  const manifest = parseManifest(new TextDecoder().decode(manifestBytes));

  const database = entries[DATABASE_ENTRY];
  if (!database) {
    throw new AndroidBackupError("This backup is missing its database — it may be corrupted.");
  }

  const keyBytes = entries[DATABASE_KEY_ENTRY];
  let databaseKey: string | null = null;
  if (keyBytes) {
    const text = new TextDecoder().decode(keyBytes).trim();
    if (!KEY_FORMAT.test(text)) {
      throw new AndroidBackupError("This backup's database key looks corrupted.");
    }
    databaseKey = text;
  }

  return { manifest, database, databaseKey };
}

function parseManifest(text: string): AndroidBackupManifest {
  const props = parseJavaProperties(text);
  const app = props.app;
  if (!app) throw new AndroidBackupError("This file doesn't look like an Auxo app backup.");
  if (app !== "auxo") {
    throw new AndroidBackupError(`This backup is from a different app ("${app}"), not Auxo.`);
  }
  const format = Number.parseInt(props.format ?? "", 10);
  if (!Number.isFinite(format)) {
    throw new AndroidBackupError("This file doesn't look like an Auxo app backup.");
  }
  const SUPPORTED_FORMAT = 1;
  if (format > SUPPORTED_FORMAT) {
    throw new AndroidBackupError(
      "This backup was made by a newer version of the Auxo app than this importer understands."
    );
  }
  const databaseVersion = Number.parseInt(props.database_version ?? "", 10);
  if (!Number.isFinite(databaseVersion)) {
    throw new AndroidBackupError("This backup looks corrupted (missing database version).");
  }

  return {
    app,
    format,
    createdAtMillis: Number.parseInt(props.created ?? "0", 10) || 0,
    databaseVersion,
    appVersion: props.app_version ?? "",
    shopName: props.shop ?? "",
  };
}
