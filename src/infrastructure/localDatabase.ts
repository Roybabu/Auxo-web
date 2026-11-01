import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ShopIdentity } from '../domain/shop';
import type { ShopStorage } from '../application/shopService';
import type { CatalogStorage } from '../application/catalogService';
import type { MovementReason, Product, StockMovement } from '../domain/catalog';
import type { InvoiceRecord } from '../domain/billing';
import type { SalesStorage } from '../application/salesService';
interface GenesisSchema extends DBSchema {
  shop: { key: string; value: ShopIdentity };
  products: { key: string; value: Product };
  movements: { key: string; value: StockMovement };
  invoices: { key: string; value: InvoiceRecord; indexes: { 'by-number': string } };
}
/** This new database has no dependency on, or migration from, the former web app. */
export class LocalDatabase implements ShopStorage, CatalogStorage, SalesStorage {
  private connection?: Promise<IDBPDatabase<GenesisSchema>>;
  constructor(private readonly name = 'auxo-genesis-v1') {}
  private connect() {
    this.connection ??= openDB<GenesisSchema>(this.name, 3, {
      upgrade(db, oldVersion) { if(oldVersion<1) db.createObjectStore('shop'); if(oldVersion<2) { db.createObjectStore('products',{keyPath:'id'}); db.createObjectStore('movements',{keyPath:'id'}); } if(oldVersion<3){const invoices=db.createObjectStore('invoices',{keyPath:'id'});invoices.createIndex('by-number','number',{unique:true});} },
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
  async updateTax(productId:string,rate:number|null,apparel:boolean) {const db=await this.connect();const tx=db.transaction('products','readwrite');const store=tx.objectStore('products');const product=await store.get(productId);if(!product){await tx.done;throw new Error('Product no longer exists.');}await store.put({...product,gstRateBasisPoints:rate,apparelGst:apparel,updatedAt:Date.now()});await tx.done;}
  async listMovements() { return (await (await this.connect()).getAll('movements')).sort((a,b)=>b.createdAt-a.createdAt); }
  async listInvoices() { return (await (await this.connect()).getAll('invoices')).sort((a,b)=>b.createdAt-a.createdAt); }
  async saveProduct(product:Product,movements:StockMovement[]) {
    const db=await this.connect(); const tx=db.transaction(['products','movements'],'readwrite');
    await tx.objectStore('products').add(product); for(const movement of movements) await tx.objectStore('movements').add(movement); await tx.done;
  }
  async adjustStock(variantId:string,change:number,reason:MovementReason,note:string|null) {
    const db=await this.connect(); const tx=db.transaction(['products','movements'],'readwrite'); const store=tx.objectStore('products');
    const products=await store.getAll(); const product=products.find(p=>p.variants.some(v=>v.id===variantId));
    if(!product) {await tx.done; throw new Error('Variant no longer exists.');}
    const variants=product.variants.map(v=>v.id===variantId?{...v,stock:v.stock+change}:v);
    await store.put({...product,variants,updatedAt:Date.now()});
    await tx.objectStore('movements').add({id:crypto.randomUUID(),variantId,quantityChange:change,reason,note,createdAt:Date.now()}); await tx.done;
  }
  async saveSale(draft:Omit<InvoiceRecord,'id'|'number'|'createdAt'>,prefix:string,date:Date):Promise<InvoiceRecord> {
    const db=await this.connect();const tx=db.transaction(['products','movements','invoices'],'readwrite');const productStore=tx.objectStore('products');
    const products=await productStore.getAll();const sold=new Map<string,number>();for(const line of draft.lines)sold.set(line.variantId,(sold.get(line.variantId)??0)+line.quantity);
    const productUpdates=new Map<string,number>();
    for(const [variantId,quantity] of sold){const product=products.find(p=>p.variants.some(v=>v.id===variantId));const variant=product?.variants.find(v=>v.id===variantId);if(!product||!variant){await tx.done;throw new Error(`A product on the bill is no longer available.`);}if(quantity>variant.stock){await tx.done;throw new Error(`${product.name} does not have enough stock to complete this bill.`);}productUpdates.set(product.id,quantity);}
    for(const [productId,quantity] of productUpdates){const product=products.find(p=>p.id===productId)!;const variants=product.variants.map(v=>sold.has(v.id)?{...v,stock:v.stock-sold.get(v.id)!}:v);await productStore.put({...product,variants,updatedAt:date.getTime()});}
    for(const [variantId,quantity] of sold)await tx.objectStore('movements').add({id:crypto.randomUUID(),variantId,quantityChange:-quantity,reason:'SOLD',note:null,createdAt:date.getTime()});
    const invoices=tx.objectStore('invoices');const prior=await invoices.getAll();const year=date.getFullYear()-(date.getMonth()<3?1:0);const sameYear=prior.filter(i=>i.number.startsWith(`${prefix}/${String(year%100).padStart(2,'0')}-`));const sequence=sameYear.length+1;const number=`${prefix}/${String(year%100).padStart(2,'0')}-${String((year+1)%100).padStart(2,'0')}/${String(sequence).padStart(5,'0')}`;
    const invoice:InvoiceRecord={...draft,id:crypto.randomUUID(),number,createdAt:date.getTime()};await invoices.add(invoice);await tx.done;return invoice;
  }
  async close() {
    if (this.connection) (await this.connection).close();
    this.connection = undefined;
  }
}
