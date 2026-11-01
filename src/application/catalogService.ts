import { manualStockChange, parseGstRate, validateHsn, validateProduct, type Product, type ProductInput, type MovementReason, type StockMovement } from '../domain/catalog';
import type {BatchTake,StockBatch} from '../domain/batches';
import type {AuditWrite} from '../domain/audit';
import type {ShopCategory} from '../domain/categories';
export type DeleteProductResult={status:'DELETED';product:Product}|{status:'NOT_FOUND'}|{status:'STOCK_ON_HAND';units:number};
export interface CatalogStorage {listProducts():Promise<Product[]>;listCategories():Promise<ShopCategory[]>;saveProduct(product:Product,movements:StockMovement[],audit?:AuditWrite):Promise<void>;deleteProduct(productId:string):Promise<DeleteProductResult>;listMovements():Promise<StockMovement[]>;listStockBatches():Promise<StockBatch[]>;adjustStock(variantId:string,change:number,reason:MovementReason,note:string|null,batch?:Pick<StockBatch,'batchNumber'|'expiryDate'>,batchId?:string|null,audit?:(targets:BatchTake[]|null)=>AuditWrite[]):Promise<void>;updateTax(productId:string,rate:number|null,apparel:boolean,audit?:AuditWrite):Promise<void>;updateHsn(productId:string,hsn:string|null,audit?:AuditWrite):Promise<void>}
export class CatalogService {
 constructor(private storage:CatalogStorage){}
 listProducts(){return this.storage.listProducts()}
 listCategories(){return this.storage.listCategories()}
 listMovements(){return this.storage.listMovements()}
 listStockBatches(){return this.storage.listStockBatches()}
 async create(input:ProductInput){const [existing,categories]=await Promise.all([this.storage.listProducts(),this.storage.listCategories()]);const category=categories.find(row=>row.id===(input.categoryId??input.category));if(!category?.enabled)throw new Error('Choose an enabled product category.');const product=validateProduct({...input,category:category.profile},existing);product.categoryId=category.id;const movements=product.variants.filter(v=>v.stock>0).map(v=>({id:crypto.randomUUID(),variantId:v.id,quantityChange:v.stock,reason:'INITIAL' as const,note:null,createdAt:Date.now()}));await this.storage.saveProduct(product,movements);return product;}
 deleteProduct(productId:string){return this.storage.deleteProduct(productId)}
 async adjust(variantId:string,text:string,reason:MovementReason,note:string|null,batch?:Pick<StockBatch,'batchNumber'|'expiryDate'>,batchId?:string|null){const products=await this.storage.listProducts();const entry=products.flatMap(p=>p.variants.map(v=>({product:p,variant:v}))).find(x=>x.variant.id===variantId);if(!entry)throw new Error('Variant no longer exists.');const change=manualStockChange(reason,text,entry.variant.stock,entry.product.stockUnit);await this.storage.adjustStock(variantId,change,reason,note?.trim()||null,batch,batchId);}
 async setTax(product:Product,selection:string){const apparel=selection==='APPAREL';if(apparel&&!['GARMENT','FOOTWEAR'].includes(product.category))throw new Error('Apparel GST slabs only apply to garments and footwear.');const rate=selection===''||apparel?null:Number(selection);if(rate!==null&&(!Number.isInteger(rate)||rate<0||rate>10000))throw new Error('GST rate must be between 0% and 100%.');await this.storage.updateTax(product.id,rate,apparel);}
 async setCustomTax(product:Product,text:string){const rate=parseGstRate(text);if(rate===null)throw new Error('GST rate must be 0–100% with up to two decimal places.');await this.storage.updateTax(product.id,rate,false);}
 async setHsn(product:Product,text:string){await this.storage.updateHsn(product.id,validateHsn(text));}
}
