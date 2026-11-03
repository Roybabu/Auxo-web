import type { AuthService } from './authService';
import type { BusinessSnapshot } from '../domain/backup';
import { PRODUCT_PHOTO_MIME, type StoredProductPhoto } from '../domain/productPhotos';
import { decryptSharedBackup, encryptSharedBackup } from '../domain/sharedBackup';
import { fromSharedPayload, toSharedPayload, type SharedPayload, type SharedPhoto } from '../domain/sharedPayload';
import { validateSharedPayload } from '../domain/sharedValidate';

/** What the shared backup needs from storage. Accounts are never read into or written from a backup. */
export interface SharedBackupStorage {
  snapshot(): Promise<BusinessSnapshot>;
  replaceBusinessData(data: BusinessSnapshot): Promise<void>;
  recordAudit(actor: { id: string; name: string; role: 'SUPER_ADMIN' | 'EMPLOYEE' } | null, action: 'BACKUP_CREATED' | 'BACKUP_RESTORED', entityType: 'backup', entityId: string | null, summary: string): Promise<void>;
}

export type SharedBackupSummary = {
  storeName: string;
  createdAt: number;
  products: number;
  invoices: number;
  customers: number;
};

export type PreparedSharedBackup = {
  summary: SharedBackupSummary;
  /** Business data from the file, with no accounts. Local logins are kept when this is restored. */
  data: BusinessSnapshot;
};

const MIN_PASSPHRASE = 10;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Makes and restores the shared auxo-backup file. This is the format both apps will use. */
export class SharedBackupService {
  constructor(private readonly storage: SharedBackupStorage, private readonly auth: AuthService) {}

  async export(passphrase: string): Promise<Blob> {
    await this.auth.require('BACKUP_AND_RESTORE');
    if (passphrase.length < MIN_PASSPHRASE) throw new Error(`Backup passphrase must be at least ${MIN_PASSPHRASE} characters.`);
    const { accounts: _accounts, productPhotos, ...business } = await this.storage.snapshot();
    const photos: SharedPhoto[] = await Promise.all((productPhotos as StoredProductPhoto[]).map(async photo => ({
      id: photo.id,
      mimeType: PRODUCT_PHOTO_MIME,
      dataBase64: toBase64(new Uint8Array(await photo.blob.arrayBuffer())),
    })));
    const payload = await toSharedPayload({ snapshot: business, photos, createdAt: Date.now(), appVersion: 'web' });
    const check = validateSharedPayload(JSON.parse(JSON.stringify(payload)));
    if (!check.valid) {
      const first = check.problems.slice(0, 3).map(p => `${p.table}${p.index === null ? '' : `[${p.index}]`}.${p.field ?? ''} ${p.message}`).join('; ');
      throw new Error(`This data cannot be backed up yet: ${first}`);
    }
    const file = await encryptSharedBackup(JSON.stringify(payload), passphrase);
    const actor = this.auth.getSnapshot();
    await this.storage.recordAudit(actor ? { id: actor.id, name: actor.name, role: actor.role } : null, 'BACKUP_CREATED', 'backup', null, 'Created a shared encrypted business backup');
    return new Blob([file as BlobPart], { type: 'application/octet-stream' });
  }

  async inspect(file: Blob, passphrase: string): Promise<PreparedSharedBackup> {
    await this.auth.require('BACKUP_AND_RESTORE');
    if (!passphrase) throw new Error('Enter the backup passphrase.');
    const json = await decryptSharedBackup(new Uint8Array(await file.arrayBuffer()), passphrase);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('Backup contents are damaged.');
    }
    const check = validateSharedPayload(parsed);
    if (!check.valid) {
      const first = check.problems.slice(0, 3).map(p => `${p.table}${p.index === null ? '' : `[${p.index}]`}.${p.field ?? ''} ${p.message}`).join('; ');
      throw new Error(`This backup failed checks and was not opened: ${first}`);
    }
    const payload = parsed as SharedPayload;
    const business = fromSharedPayload(payload);
    const productPhotos: StoredProductPhoto[] = payload.photos.map(photo => ({
      id: photo.id,
      blob: new Blob([fromBase64(photo.dataBase64) as BlobPart], { type: PRODUCT_PHOTO_MIME }),
    }));
    return {
      summary: {
        storeName: payload.shopName,
        createdAt: payload.createdAt,
        products: payload.tables.products.length,
        invoices: payload.tables.invoices.length,
        customers: payload.tables.customers.length,
      },
      data: { ...business, accounts: [], productPhotos } as unknown as BusinessSnapshot,
    };
  }

  /** Replaces business data. Logins, sessions and this device's database key are not changed. */
  async restore(prepared: PreparedSharedBackup): Promise<void> {
    await this.auth.require('BACKUP_AND_RESTORE');
    await this.storage.replaceBusinessData(prepared.data);
    // Written after the data is in place, so the record of the restore is kept (the replacement clears the old log).
    const actor = this.auth.getSnapshot();
    await this.storage.recordAudit(actor ? { id: actor.id, name: actor.name, role: actor.role } : null, 'BACKUP_RESTORED', 'backup', null, `Restored a shared backup from ${prepared.summary.storeName}`);
  }
}
