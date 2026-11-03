import { describe, expect, it } from 'vitest';
import { ScheduledBackupService, scheduledFileName, type BackupFolder, type FolderPermission, type ScheduleStore } from './scheduledBackupService';

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

const MINUTE = 60_000;
const PASS = 'long scheduled phrase';

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
    now: () => clock,
  });
  return { service, store, folder, used, advance: (ms: number) => { clock += ms; }, now: () => clock };
}

async function enabled(service: ScheduledBackupService, folder: BackupFolder, intervalMinutes = 60, keepCount = 5) {
  await service.chooseFolder(folder);
  await service.configure({ enabled: true, intervalMinutes: intervalMinutes as 60, keepCount });
}

describe('scheduled backups', () => {
  it('does nothing when switched off', async () => {
    const { service, folder } = setup();
    await service.chooseFolder(folder);
    expect(await service.run({ passphrase: PASS })).toBe('not-due');
    expect(folder.files.size).toBe(0);
  });

  it('needs only a folder to switch on, and never stores a passphrase', async () => {
    const { service, folder, store } = setup();
    await expect(service.configure({ enabled: true, intervalMinutes: 60, keepCount: 5 })).rejects.toThrow(/folder/);
    await enabled(service, folder);
    expect((await service.status()).settings.enabled).toBe(true);
    const stored = JSON.stringify([...((store as unknown as { values: Map<string, unknown> }).values.entries())]);
    expect(stored).not.toContain(PASS);
  });

  it('asks for the passphrase when a backup is due, and writes nothing without it', async () => {
    const { service, folder } = setup();
    await enabled(service, folder);
    expect(await service.run()).toBe('needs-passphrase');
    expect(folder.files.size).toBe(0);
    expect((await service.status()).passphraseNeeded).toBe(true);
  });

  it('writes an encrypted file when given the passphrase, then waits for the interval', async () => {
    const { service, folder, used, advance, now } = setup();
    await enabled(service, folder);
    expect(await service.run({ passphrase: PASS })).toBe('written');
    expect(used).toEqual([PASS]);
    expect([...folder.files.keys()]).toEqual([scheduledFileName(now())]);
    expect((await service.status()).passphraseNeeded).toBe(false);
    advance(30 * MINUTE);
    expect(await service.run({ passphrase: PASS })).toBe('not-due');
    advance(31 * MINUTE);
    expect(await service.run({ passphrase: PASS })).toBe('written');
    expect(folder.files.size).toBe(2);
  });

  it('"back up now" writes even when not due', async () => {
    const { service, folder, advance } = setup();
    await enabled(service, folder);
    expect(await service.run({ passphrase: PASS })).toBe('written');
    advance(1000);
    expect(await service.run({ passphrase: PASS, force: true })).toBe('written');
    expect(folder.files.size).toBe(2);
  });

  it('refuses a short passphrase and records the problem', async () => {
    const { service, folder } = setup();
    await enabled(service, folder);
    expect(await service.run({ passphrase: 'short' })).toBe('failed');
    expect(folder.files.size).toBe(0);
    expect((await service.status()).settings.lastError).toMatch(/at least 10/);
  });

  it('keeps only the newest files', async () => {
    const { service, folder, advance } = setup();
    await enabled(service, folder, 15, 2);
    for (let i = 0; i < 4; i++) {
      expect(await service.run({ passphrase: PASS })).toBe('written');
      advance(16 * MINUTE);
    }
    expect(folder.files.size).toBe(2);
  });

  it('records a clear error and writes nothing when folder access is not allowed', async () => {
    const { service, folder } = setup();
    await enabled(service, folder);
    folder.permissionState = 'prompt';
    expect(await service.run({ passphrase: PASS })).toBe('failed');
    expect(folder.files.size).toBe(0);
    expect((await service.status()).settings.lastError).toMatch(/Allow AUXO/);
  });

  it('does not write when nobody with backup permission is signed in', async () => {
    const { service, folder } = setup({ requireAccess: async () => { throw new Error('Sign in to continue.'); } });
    await enabled(service, folder);
    expect(await service.run({ passphrase: PASS })).toBe('failed');
    expect(folder.files.size).toBe(0);
    expect((await service.status()).settings.lastError).toBe('Sign in to continue.');
  });

  it('clears the error after a successful backup', async () => {
    const { service, folder, store } = setup();
    await enabled(service, folder);
    await store.set('settings', { ...(await service.status()).settings, lastError: 'old problem' });
    expect(await service.run({ passphrase: PASS })).toBe('written');
    expect((await service.status()).settings.lastError).toBeNull();
  });
});
