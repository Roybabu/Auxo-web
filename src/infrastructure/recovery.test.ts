import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { AuthService } from '../application/authService';
import { formatRecoveryCode, generateRecoveryCode, normalizeRecoveryCode, validRecoveryCode } from '../domain/recovery';
import { LocalDatabase } from './localDatabase';

it('generates unambiguous 100-bit codes and normalizes manual entry',()=>{
  const code=generateRecoveryCode();expect(code).toHaveLength(20);expect(validRecoveryCode(formatRecoveryCode(code).toLowerCase())).toBe(true);
  expect(normalizeRecoveryCode(formatRecoveryCode(code).toLowerCase())).toBe(code);
  expect(validRecoveryCode('OOOOO-11111-00000-IIIII')).toBe(false);
});

it('confirms a setup code and atomically rotates it with an administrator password reset',async()=>{
  const db=new LocalDatabase('test-recovery-'+crypto.randomUUID()),auth=new AuthService(db);
  await auth.setup('Owner','owner','RiverStoneSecret91','RiverStoneSecret91');
  expect(auth.getRecoveryPrompt()).toBe('required');
  const first=await auth.startRecoveryCode();
  await expect(auth.confirmRecoveryCode('WRONG')).rejects.toThrow(/does not match/);
  expect((await db.listAccounts())[0]?.recovery).toBeUndefined();
  await auth.confirmRecoveryCode(first.toLowerCase().replaceAll('-',' '));
  expect(auth.getRecoveryPrompt()).toBeNull();
  const saved=(await db.listAccounts())[0]!;expect(saved.recovery?.hash).toBeTruthy();expect(JSON.stringify(saved)).not.toContain(normalizeRecoveryCode(first));
  await auth.signOut();
  await expect(auth.resetAdminWithRecovery('WRONG','BlueOceanSecret92','BlueOceanSecret92')).rejects.toThrow(/incorrect/);
  const second=await auth.resetAdminWithRecovery(first,'BlueOceanSecret92','BlueOceanSecret92');
  expect(second).not.toBe(first);
  expect((await db.listAccounts())[0]?.recovery?.hash).not.toBe(saved.recovery?.hash);
  await expect(auth.resetAdminWithRecovery(first,'ThirdSecret93','ThirdSecret93')).rejects.toThrow(/incorrect/);
  await expect(auth.signIn('owner','RiverStoneSecret91')).rejects.toThrow(/incorrect/);
  await auth.signIn('owner','BlueOceanSecret92');expect(auth.getSnapshot()?.role).toBe('SUPER_ADMIN');
  await auth.signOut();const third=await auth.resetAdminWithRecovery(second,'ThirdSecret93','ThirdSecret93');expect(third).not.toBe(second);
  await db.close();
});

it('offers setup after sign-in to a prior account without a recovery code',async()=>{
  const db=new LocalDatabase('test-recovery-offer-'+crypto.randomUUID()),auth=new AuthService(db);
  await auth.setup('Owner','owner','RiverStoneSecret91','RiverStoneSecret91');await auth.signOut();
  await auth.signIn('owner','RiverStoneSecret91');expect(auth.getRecoveryPrompt()).toBe('offered');
  await expect(auth.startRecoveryCode('bad')).rejects.toThrow(/incorrect/);
  const code=await auth.startRecoveryCode('RiverStoneSecret91');await auth.confirmRecoveryCode(code);
  await auth.signOut();await auth.signIn('owner','RiverStoneSecret91');expect(auth.getRecoveryPrompt()).toBeNull();await db.close();
});
