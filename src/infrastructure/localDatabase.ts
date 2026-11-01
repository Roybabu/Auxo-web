import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ShopIdentity } from '../domain/shop';
import type { ShopStorage } from '../application/shopService';
interface GenesisSchema extends DBSchema {
  shop: { key: string; value: ShopIdentity };
}
/** This new database has no dependency on, or migration from, the former web app. */
export class LocalDatabase implements ShopStorage {
  private connection?: Promise<IDBPDatabase<GenesisSchema>>;
  constructor(private readonly name = 'auxo-genesis-v1') {}
  private connect() {
    this.connection ??= openDB<GenesisSchema>(this.name, 1, {
      upgrade(db) { db.createObjectStore('shop'); },
      blocking: () => { void this.close(); },
      terminated: () => { this.connection = undefined; },
    }).catch(error => { this.connection = undefined; throw error; });
    return this.connection;
  }
  async load(): Promise<ShopIdentity | null> {
    return (await (await this.connect()).get('shop', 'identity')) ?? null;
  }
  async save(shop: ShopIdentity): Promise<void> {
    const db = await this.connect();
    const transaction = db.transaction('shop', 'readwrite');
    await transaction.store.put(shop, 'identity');
    await transaction.done;
  }
  async close() {
    if (this.connection) (await this.connection).close();
    this.connection = undefined;
  }
}
