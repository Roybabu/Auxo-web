import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { AuthService } from './authService';
import { SharedBackupService } from './sharedBackupService';
import { LocalDatabase } from '../infrastructure/localDatabase';
import { realisticSample } from '../domain/sharedFixtures';
import type { BusinessSnapshot } from '../domain/backup';

const PASS = 'long shared phrase 91';

async function ownerDatabase(name: string) {
  const db = new LocalDatabase('test-shared-' + name + '-' + crypto.randomUUID());
  const auth = new AuthService(db);
  await auth.setup(name, name.toLowerCase(), 'RiverStoneSecret91', 'RiverStoneSecret91');
  const code = await auth.startRecoveryCode();
  await auth.confirmRecoveryCode(code);
  return { db, auth, service: new SharedBackupService(db, auth) };
}

describe('shared backup service', () => {
  it('exports a shop, opens it, and restores it into another shop without touching its logins', async () => {
    const source = await ownerDatabase('Source');
    await source.db.replaceBusinessData((await realisticSample()) as unknown as BusinessSnapshot);

    const file = await source.service.export(PASS);
    const bytes = new Uint8Array(await file.arrayBuffer());
    expect(new TextDecoder().decode(bytes.subarray(0, 8))).toBe('AUXOBKUP');

    await expect(source.service.inspect(file, 'wrong phrase here')).rejects.toThrow(/Wrong passphrase/);
    const tampered = new Uint8Array(bytes);
    tampered[tampered.length - 1]! ^= 1;
    await expect(source.service.inspect(new Blob([tampered]), PASS)).rejects.toThrow(/damaged|Wrong passphrase/);

    const prepared = await source.service.inspect(file, PASS);
    expect(prepared.summary).toMatchObject({ storeName: 'Sample Shop', products: 1, invoices: 1, customers: 1 });

    const target = await ownerDatabase('Target');
    await target.service.restore(prepared);

    const restored = await target.db.snapshot();
    expect(restored.shop?.storeName).toBe('Sample Shop');
    expect(restored.products.length).toBe(1);
    expect(restored.invoices.length).toBe(1);
    expect(restored.customers.length).toBe(1);
    expect(restored.accounts.map(a => a.identifier)).toEqual(['target']);
    expect(target.auth.getSnapshot()?.name).toBe('Target');
    expect((await target.db.listRecentAudit()).some(row => row.action === 'BACKUP_RESTORED')).toBe(true);

    await source.db.close();
    await target.db.close();
  });

  it('refuses to export with a short passphrase', async () => {
    const owner = await ownerDatabase('Short');
    await expect(owner.service.export('short')).rejects.toThrow(/at least 10/);
    await owner.db.close();
  });
});
