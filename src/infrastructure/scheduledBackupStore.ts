// Browser pieces for scheduled backups: IndexedDB storage, the passphrase wrapper, and the folder adapter.
// The folder is a FileSystemDirectoryHandle (Chrome and Edge on a computer). Other browsers are reported as unsupported.

import { openDB, type IDBPDatabase } from 'idb';
import type { BackupFolder, FolderPermission, PassphraseWrapper, ScheduleStore } from '../application/scheduledBackupService';

type Sealed = { iv: Uint8Array; data: Uint8Array };
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function folderPickingSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Asks the person to choose a folder. Must be called from a button press. */
export async function pickBackupFolder(): Promise<unknown> {
  const picker = (window as unknown as { showDirectoryPicker(options: { mode: 'readwrite' }): Promise<unknown> }).showDirectoryPicker;
  return picker({ mode: 'readwrite' });
}

export class IndexedDbScheduleStore implements ScheduleStore {
  private db: Promise<IDBPDatabase<{ kv: { key: string; value: unknown } }>> | null = null;

  constructor(private readonly name = 'auxo-scheduled-backups') {}

  private connect() {
    this.db ??= openDB<{ kv: { key: string; value: unknown } }>(this.name, 1, {
      upgrade(db) { db.createObjectStore('kv'); },
    });
    return this.db;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return (await (await this.connect()).get('kv', key)) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await (await this.connect()).put('kv', value, key);
  }
}

/**
 * Wraps the backup passphrase with an AES key that the browser keeps but never exposes (non-extractable).
 * The stored text cannot be read without that key, and the key cannot be copied out of the browser.
 */
export class NonExtractableKeyWrapper implements PassphraseWrapper {
  constructor(private readonly store: ScheduleStore) {}

  private async key(): Promise<CryptoKey> {
    const existing = await this.store.get<CryptoKey>('wrapKey');
    if (existing) return existing;
    const created = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await this.store.set('wrapKey', created);
    return created;
  }

  async wrap(passphrase: string): Promise<Sealed> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await this.key(), encoder.encode(passphrase)));
    return { iv, data };
  }

  async unwrap(sealed: Sealed): Promise<string> {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv as BufferSource }, await this.key(), sealed.data as BufferSource);
    return decoder.decode(plain);
  }
}

type FileSystemHandleLike = {
  name: string;
  queryPermission(options: { mode: 'readwrite' }): Promise<FolderPermission>;
  requestPermission(options: { mode: 'readwrite' }): Promise<FolderPermission>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;
  entries(): AsyncIterable<[string, unknown]>;
  removeEntry(name: string): Promise<void>;
};

/** Wraps a browser folder handle in the BackupFolder interface. */
export function openBrowserFolder(handle: unknown): BackupFolder {
  const dir = handle as FileSystemHandleLike;
  return {
    name: dir.name,
    permission: () => dir.queryPermission({ mode: 'readwrite' }),
    requestPermission: () => dir.requestPermission({ mode: 'readwrite' }),
    async writeFile(name, data) {
      const file = await dir.getFileHandle(name, { create: true });
      const writable = await file.createWritable();
      await writable.write(data);
      await writable.close();
    },
    async listFiles() {
      const names: string[] = [];
      for await (const [name] of dir.entries()) names.push(name);
      return names;
    },
    removeFile: name => dir.removeEntry(name),
  };
}
