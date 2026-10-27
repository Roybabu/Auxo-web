/**
 * Ports (interfaces) that the core package depends on but never
 * implements. Browser code implements these with SQLite-WASM,
 * File System Access API, window.print(), etc. A future desktop
 * build (Tauri) implements the same interfaces against native APIs.
 * Core logic never imports from "browser-land" directly.
 */

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface BackupFile {
  /** Format version of the neutral JSON export, for forward compatibility. */
  formatVersion: number;
  createdAt: string;
  deviceId: string;
  data: unknown;
}

export interface BackupPort {
  export(): Promise<BackupFile>;
  import(backup: BackupFile): Promise<void>;
}

export interface PrintJob {
  html: string;
}

export interface PrinterPort {
  print(job: PrintJob): Promise<void>;
}
