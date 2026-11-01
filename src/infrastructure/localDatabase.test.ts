import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { LocalDatabase } from './localDatabase';
import { ShopService } from '../application/shopService';
it('commits store details and reloads them through a new connection',async()=>{
  const name = 'test-persistence';
  const db = new LocalDatabase(name);
  const service = new ShopService(db);
  expect(await service.load()).toBeNull();
  await service.save({storeName:' Example ',address:' Road '});
  await db.close();
  const reopened = new LocalDatabase(name);
  expect(await reopened.load()).toEqual({storeName:'Example',address:'Road'});
  await reopened.close();
});
it('keeps prior data when validation fails',async()=>{
  const db = new LocalDatabase('test-validation');
  const service = new ShopService(db);
  await service.save({storeName:'Keep',address:''});
  await expect(service.save({storeName:'',address:''})).rejects.toThrow();
  expect((await service.load())?.storeName).toBe('Keep');
  await db.close();
});
