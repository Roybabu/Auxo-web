import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ShopIdentity } from '../domain/shop';
import type { ShopStorage } from '../application/shopService';
import type { CatalogStorage } from '../application/catalogService';
import type { MovementReason, Product, StockMovement } from '../domain/catalog';
interface GenesisSchema extends DBSchema {
  shop: { key: string; value: ShopIdentity };
  products: { key: string; value: Product };
  movements: { key: string; value: StockMovement };
}
/** This new database has no dependency on, or migration from, the former web app. */
export class LocalDatabase implements ShopStorage, CatalogStorage {
  private connection?: Promise<IDBPDatabase<GenesisSchema>>;
  constructor(private readonly name = 'auxo-genesis-v1') {}
  private connect() {
    this.connection ??= openDB<GenesisSchema>(this.name, 2, {
      upgrade(db, oldVersion) { if(oldVersion<1) db.createObjectStore('shop'); if(oldVersion<2) { db.createObjectStore('products',{keyPath:'id'}); db.createObjectStore('movements',{keyPath:'id'}); } },
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
  async listProducts() { return (await (await this.connect()).getAll('products')); }
  async listMovements() { return (await (await this.connect()).getAll('movements')).sort((a,b)=>b.createdAt-a.createdAt); }
  async saveProduct(product:Product,movements:StockMovement[]) {
    const db=await this.connect(); const tx=db.transaction(['products','movements'],'readwrite');
    await tx.objectStore('products').add(product); for(const movement of movements) await tx.objectStore('movements').add(movement); await tx.done;
  }
  async adjustStock(variantId:string,change:number,reason:MovementReason,note:string|null) {
    const db=await this.connect(); const tx=db.transaction(['products','movements'],'readwrite'); const store=tx.objectStore('products');
    const products=await store.getAll(); const product=products.find(p=>p.variants.some(v=>v.id===variantId));
    if(!product) {tx.abort(); throw new Error('Variant no longer exists.');}
    const variants=product.variants.map(v=>v.id===variantId?{...v,stock:v.stock+change}:v);
    await store.put({...product,variants,updatedAt:Date.now()});
    await tx.objectStore('movements').add({id:crypto.randomUUID(),variantId,quantityChange:change,reason,note,createdAt:Date.now()}); await tx.done;
  }
  async close() {
    if (this.connection) (await this.connection).close();
    this.connection = undefined;
  }
}
