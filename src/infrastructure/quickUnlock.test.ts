import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { LocalDatabase } from './localDatabase';
import { AuthService, type PinRecord, type PinStore } from '../application/authService';

class MemoryPins implements PinStore{
  rows=new Map<string,PinRecord>();
  get(id:string){return this.rows.get(id)??null;}
  set(id:string,record:PinRecord){this.rows.set(id,record);}
  remove(id:string){this.rows.delete(id);}
  ids(){return [...this.rows.keys()];}
}
async function signedIn(){
  const pins=new MemoryPins(),auth=new AuthService(new LocalDatabase('test-pin-'+crypto.randomUUID()),pins);
  await auth.setup('Owner','owner.user','StrongSecret91','StrongSecret91');
  return {auth,pins};
}

it('sets a PIN, locks, and unlocks with the PIN while staying signed in',async()=>{
  const {auth,pins}=await signedIn();
  expect(auth.hasPin()).toBe(false);
  await expect(auth.setPin('StrongSecret91','1234','1234')).rejects.toThrow(/too easy/);
  await expect(auth.setPin('StrongSecret91','4829','4820')).rejects.toThrow(/do not match/);
  await expect(auth.setPin('WrongPassword1','4829','4829')).rejects.toThrow(/Password is incorrect/);
  await auth.setPin('StrongSecret91','4829','4829');
  expect(auth.hasPin()).toBe(true);
  expect(JSON.stringify([...pins.rows.values()])).not.toContain('4829');
  auth.lock();
  expect(auth.getLocked()).toBe(true);
  expect(auth.getSnapshot()?.name).toBe('Owner');
  await expect(auth.unlockWithPin('1111')).rejects.toThrow(/Wrong PIN. 4 tries left/);
  expect(auth.getLocked()).toBe(true);
  await auth.unlockWithPin('4829');
  expect(auth.getLocked()).toBe(false);
});

it('switches the PIN off after five wrong tries until the password is used',async()=>{
  const {auth}=await signedIn();
  await auth.setPin('StrongSecret91','4829','4829');
  auth.lock();
  for(let i=0;i<4;i++)await expect(auth.unlockWithPin('0000')).rejects.toThrow(/Wrong PIN/);
  await expect(auth.unlockWithPin('0000')).rejects.toThrow(/Too many wrong PINs/);
  expect(auth.quickUnlockOff()).toBe(true);
  await expect(auth.unlockWithPin('4829')).rejects.toThrow(/Too many wrong PINs/);
  await auth.unlockWithPassword('StrongSecret91');
  expect(auth.getLocked()).toBe(false);
  expect(auth.quickUnlockOff()).toBe(false);
});

it('removes the PIN, and signing out clears the lock',async()=>{
  const {auth}=await signedIn();
  await auth.setPin('StrongSecret91','4829','4829');
  await auth.removePin('StrongSecret91');
  expect(auth.hasPin()).toBe(false);
  auth.lock();
  await expect(auth.unlockWithPin('4829')).rejects.toThrow(/No PIN is set/);
  await auth.signOut();
  expect(auth.getLocked()).toBe(false);
  expect(auth.getSnapshot()).toBeNull();
});

it('opens the app with the PIN after a page reload, with no password',async()=>{
  const name='test-pin-reload-'+crypto.randomUUID(),pins=new MemoryPins(),first=new AuthService(new LocalDatabase(name),pins);
  await first.setup('Owner','owner.user','StrongSecret91','StrongSecret91');
  await first.setPin('StrongSecret91','4829','4829');
  expect(JSON.stringify([...pins.rows.values()])).not.toContain('4829');
  // a reload: brand-new objects over the same stored data, nobody signed in
  const db=new LocalDatabase(name),second=new AuthService(db,pins);
  expect(second.getSnapshot()).toBeNull();
  expect(await second.pinAccounts()).toEqual([{id:expect.any(String),name:'Owner'}]);
  const id=(await second.pinAccounts())[0]!.id;
  await expect(second.signInWithPin(id,'1111')).rejects.toThrow(/Wrong PIN. 4 tries left/);
  await second.signInWithPin(id,'4829');
  expect(second.getSnapshot()?.name).toBe('Owner');
  expect((await db.listAccounts()).length).toBe(1);
});

it('switches PIN sign-in off after five wrong tries on the sign-in screen',async()=>{
  const name='test-pin-reload-off-'+crypto.randomUUID(),pins=new MemoryPins(),first=new AuthService(new LocalDatabase(name),pins);
  await first.setup('Owner','owner.user','StrongSecret91','StrongSecret91');
  await first.setPin('StrongSecret91','4829','4829');
  const second=new AuthService(new LocalDatabase(name),pins),id=(await second.pinAccounts())[0]!.id;
  for(let i=0;i<4;i++)await expect(second.signInWithPin(id,'0000')).rejects.toThrow(/Wrong PIN/);
  await expect(second.signInWithPin(id,'0000')).rejects.toThrow(/switched off/);
  expect(await second.pinAccounts()).toEqual([]);
  await expect(second.signInWithPin(id,'4829')).rejects.toThrow(/not set up/);
});
