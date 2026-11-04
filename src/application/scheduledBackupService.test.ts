import { describe, expect, it } from 'vitest';
import { ScheduledBackupService, scheduledFileName, type BackupFolder, type FolderPermission, type PassphraseWrapper, type ScheduleStore } from './scheduledBackupService';

class MemoryStore implements ScheduleStore {
  private readonly values = new Map<string, unknown>();
  async get<T>(key: string) { return this.values.get(key) as T | undefined; }
  async set(key: string, value: unknown) { this.values.set(key, value); }
}

class MemoryFolder implements BackupFolder {
  readonly name = 'Backups';
  files = new Map<string, Blob>();
  permissionState: FolderPermission = 'granted';
  async permission() { return this.permissionState; }
  async requestPermission() { this.permissionState = 'granted'; return 'granted' as const; }
  async writeFile(name: string, data: Blob) { this.files.set(name, data); }
  async listFiles() { return [...this.files.keys()]; }
  async removeFile(name: string) { this.files.delete(name); }
}

const plainWrapper: PassphraseWrapper = {
  async wrap(passphrase) { return { iv: new Uint8Array([0]), data: new TextEncoder().encode(passphrase) }; },
  async unwrap(sealed) { return new TextDecoder().decode(sealed.data); },
};

const MINUTE = 60_000;

function setup(overrides: { requireAccess?: () => Promise<void> } = {}) {
  const store = new MemoryStore();
  const folder = new MemoryFolder();
  let clock = Date.UTC(2026, 10, 3, 6, 0, 0);
  const used: string[] = [];
  const service = new ScheduledBackupService({
    store,
    openFolder: handle => handle as BackupFolder,
    exportFile: async passphrase => { used.push(passphrase); return new Blob([`backup-${used.length}`]); },
    requireAccess: overrides.requireAccess ?? (async () => {}),
    wrapper: plainWrapper,
    now: () => clock,
  });
  return { service, store, folder, used, advance: (ms: number) => { clock += ms; }, now: () => clock };
}

describe('scheduled backups', () => {
  it('does nothing when switched off', async () => {
    const { service, folder } = setup();
    await service.chooseFolder(folder);
    expect(await service.runIfDue()).toBe(false);
    expect(folder.files.size).toBe(0);
  });

  it('will not switch on until a folder and a passphrase are set', async () => {
    const { service, folder } = setup();
    await expect(service.configure({ enabled: true, intervalMinutes: 60, keepCount: 5 })).rejects.toThrow(/folder/);
    await service.chooseFolder(folder);
    await expect(service.configure({ enabled: true, intervalMinutes: 60, keepCount: 5 })).rejects.toThrow(/passphrase/);
    await service.setPassphrase('long scheduled phrase');
    await service.configure({ enabled: true, intervalMinutes: 60, keepCount: 5 });
    expect((await service.status()).settings.enabled).toBe(true);
  });

  it('refuses a short passphrase', async () => {
    const { service } = setup();
    await expect(service.setPassphrase('short')).rejects.toThrow(/at least 10/);
  });

  it('writes an encrypted file when due, and not again until the interval passes', async () => {
    const { service, folder, used, advance, now } = setup();
    await service.chooseFolder(folder);
    await service.setPassphrase('long scheduled phrase');
    await service.configure({ enabled: true, intervalMinutes: 60, keepCount: 5 });
    expect(await service.runIfDue()).toBe(true);
    expect(used).toEqual(['long scheduled phrase']);
    expect([...folder.files.keys()]).toEqual([scheduledFileName(now())]);
    advance(30 * MINUTE);
    expect(await service.runIfDue()).toBe(false);
    advance(31 * MINUTE);
    expect(await service.runIfDue()).toBe(true);
    expect(folder.files.size).toBe(2);
  });

  it('keeps only the newest files', async () => {
    const { service, folder, advance } = setup();
    await service.chooseFolder(folder);
    await service.setPassphrase('long scheduled phrase');
    await service.configure({ enabled: true, intervalMinutes: 15, keepCount: 2 });
    for (let i = 0; i < 4; i++) {
      expect(await service.runIfDue()).toBe(true);
      advance(16 * MINUTE);
    }
    const names = [...folder.files.keys()].sort();
    expect(names).toHaveLength(2);
    expect(names[1]! > names[0]!).toBe(true);
  });

  it('records a clear error and writes nothing when folder access is not allowed', async () => {
    const { service, folder } = setup();
    await service.chooseFolder(folder);
    await service.setPassphrase('long scheduled phrase');
    await service.configure({ enabled: true, intervalMinutes: 60, keepCount: 5 });
    folder.permissionState = 'prompt';
    expect(await service.runIfDue()).toBe(false);
    expect(folder.files.size).toBe(0);
    expect((await service.status()).settings.lastError).toMatch(/Allow AUXO/);
  });

  it('does not write when nobody with backup permission is signed in', async () => {
    const { service, folder } = setup({ requireAccess: async () => { throw new Error('Sign in to continue.'); } });
    await service.chooseFolder(folder);
    await service.setPassphrase('long scheduled phrase');
    await service.configure({ enabled: true, intervalMinutes: 60, keepCount: 5 });
    expect(await service.runIfDue()).toBe(false);
    expect(folder.files.size).toBe(0);
    expect((await service.status()).settings.lastError).toBe('Sign in to continue.');
  });

  it('clears the error after a successful backup', async () => {
    const { service, folder, store } = setup();
    await service.chooseFolder(folder);
    await service.setPassphrase('long scheduled phrase');
    await service.configure({ enabled: true, intervalMinutes: 60, keepCount: 5 });
    await store.set('settings', { ...(await store.get('settings')) as object, lastError: 'old problem' });
    expect(await service.runIfDue()).toBe(true);
    expect((await service.status()).settings.lastError).toBeNull();
  });
});
