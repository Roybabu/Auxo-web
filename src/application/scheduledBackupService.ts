// Scheduled encrypted backups written into a folder the person chooses.
// The browser cannot write files on its own, so a backup is written while AUXO is open, and only once the
// person has entered the passphrase for it. The passphrase is never stored.

export const SCHEDULE_INTERVALS = [15, 60, 360, 1440] as const;
export type ScheduleInterval = (typeof SCHEDULE_INTERVALS)[number];
export type FolderPermission = 'granted' | 'denied' | 'prompt';

/** A folder the person picked. The browser version wraps a FileSystemDirectoryHandle; tests use an in-memory one. */
export interface BackupFolder {
  readonly name: string;
  permission(): Promise<FolderPermission>;
  requestPermission(): Promise<FolderPermission>;
  writeFile(name: string, data: Blob): Promise<void>;
  listFiles(): Promise<string[]>;
  removeFile(name: string): Promise<void>;
}

/** Small key-value store for schedule settings. The browser version uses IndexedDB. */
export interface ScheduleStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

export type ScheduleSettings = {
  enabled: boolean;
  intervalMinutes: ScheduleInterval;
  keepCount: number;
  lastSuccessAt: number | null;
  lastError: string | null;
};

export type ScheduleStatus = {
  folderName: string | null;
  permission: FolderPermission | 'none';
  settings: ScheduleSettings;
  /** The next backup is due and needs the passphrase from the person. */
  passphraseNeeded: boolean;
  nextDueAt: number | null;
};

export type RunResult = 'written' | 'not-due' | 'needs-passphrase' | 'failed';

export type ScheduledBackupDeps = {
  store: ScheduleStore;
  /** Turns a stored folder handle into a BackupFolder. Handles are stored raw because only they can be saved in the browser. */
  openFolder(handle: unknown): BackupFolder;
  /** Creates the encrypted file for a passphrase. The real one is the shared backup export. */
  exportFile(passphrase: string): Promise<Blob>;
  /** Throws unless someone with backup permission is signed in. */
  requireAccess(): Promise<void>;
  now?(): number;
};

const DEFAULT_SETTINGS: ScheduleSettings = { enabled: false, intervalMinutes: 60, keepCount: 10, lastSuccessAt: null, lastError: null };
const FILE_PREFIX = 'auxo-auto-';
const FILE_SUFFIX = '.auxoshared';
const MIN_PASSPHRASE = 10;

export function scheduledFileName(now: number): string {
  return `${FILE_PREFIX}${new Date(now).toISOString().replace(/[:.]/g, '-')}${FILE_SUFFIX}`;
}

export class ScheduledBackupService {
  constructor(private readonly deps: ScheduledBackupDeps) {}

  private now() {
    return this.deps.now?.() ?? Date.now();
  }

  private async settings(): Promise<ScheduleSettings> {
    return { ...DEFAULT_SETTINGS, ...((await this.deps.store.get<ScheduleSettings>('settings')) ?? {}) };
  }

  private async folder(): Promise<BackupFolder | null> {
    const handle = await this.deps.store.get<unknown>('folderHandle');
    return handle ? this.deps.openFolder(handle) : null;
  }

  private isDue(settings: ScheduleSettings, now: number): boolean {
    return !settings.lastSuccessAt || now - settings.lastSuccessAt >= settings.intervalMinutes * 60_000;
  }

  async chooseFolder(handle: unknown): Promise<void> {
    await this.deps.store.set('folderHandle', handle);
  }

  async configure(input: Pick<ScheduleSettings, 'enabled' | 'intervalMinutes' | 'keepCount'>): Promise<void> {
    if (!SCHEDULE_INTERVALS.includes(input.intervalMinutes)) throw new Error('Choose a valid backup interval.');
    if (!Number.isInteger(input.keepCount) || input.keepCount < 1 || input.keepCount > 60) throw new Error('Keep between 1 and 60 backup files.');
    if (input.enabled && !(await this.folder())) throw new Error('Choose a backup folder first.');
    await this.deps.store.set('settings', { ...(await this.settings()), ...input });
  }

  async status(): Promise<ScheduleStatus> {
    const settings = await this.settings();
    const folder = await this.folder();
    const permission = folder ? await folder.permission() : 'none';
    const now = this.now();
    return {
      folderName: folder?.name ?? null,
      permission,
      settings,
      passphraseNeeded: settings.enabled && this.isDue(settings, now),
      nextDueAt: settings.enabled && settings.lastSuccessAt ? settings.lastSuccessAt + settings.intervalMinutes * 60_000 : null,
    };
  }

  /** Called from a button press, so the browser can show the permission prompt. */
  async allowFolder(): Promise<FolderPermission> {
    const folder = await this.folder();
    if (!folder) throw new Error('Choose a backup folder first.');
    return folder.requestPermission();
  }

  private async saveResult(patch: Partial<ScheduleSettings>): Promise<void> {
    await this.deps.store.set('settings', { ...(await this.settings()), ...patch });
  }

  /**
   * Writes a backup when one is due, or always when [force] is set ("Back up now").
   * Without a passphrase nothing is written: a due backup reports 'needs-passphrase' so the app can ask for it.
   */
  async run(options: { passphrase?: string; force?: boolean } = {}): Promise<RunResult> {
    const settings = await this.settings();
    const now = this.now();
    if (!options.force && (!settings.enabled || !this.isDue(settings, now))) return 'not-due';
    if (options.passphrase === undefined) return 'needs-passphrase';
    try {
      if (options.passphrase.length < MIN_PASSPHRASE) throw new Error(`The backup passphrase must be at least ${MIN_PASSPHRASE} characters.`);
      await this.deps.requireAccess();
      const folder = await this.folder();
      if (!folder) throw new Error('Choose a backup folder first.');
      if ((await folder.permission()) !== 'granted') throw new Error('Allow AUXO to write to the backup folder, then try again.');
      const file = await this.deps.exportFile(options.passphrase);
      await folder.writeFile(scheduledFileName(now), file);
      await this.prune(folder, settings.keepCount);
      await this.saveResult({ lastSuccessAt: now, lastError: null });
      return 'written';
    } catch (error) {
      await this.saveResult({ lastError: error instanceof Error ? error.message : 'The scheduled backup failed.' });
      return 'failed';
    }
  }

  private async prune(folder: BackupFolder, keepCount: number): Promise<void> {
    const ours = (await folder.listFiles()).filter(name => name.startsWith(FILE_PREFIX) && name.endsWith(FILE_SUFFIX)).sort();
    for (const old of ours.slice(0, Math.max(0, ours.length - keepCount))) await folder.removeFile(old);
  }
}
