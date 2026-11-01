import { manualStockChange, validateProduct, type Product, type ProductInput, type MovementReason, type StockMovement } from '../domain/catalog';
export interface CatalogStorage {listProducts():Promise<Product[]>;saveProduct(product:Product,movements:StockMovement[]):Promise<void>;listMovements():Promise<StockMovement[]>;adjustStock(variantId:string,change:number,reason:MovementReason,note:string|null):Promise<void>}
export class CatalogService {
 constructor(private storage:CatalogStorage){}
 listProducts(){return this.storage.listProducts()}
 listMovements(){return this.storage.listMovements()}
 async create(input:ProductInput){const existing=await this.storage.listProducts();const product=validateProduct(input,existing);const movements=product.variants.filter(v=>v.stock>0).map(v=>({id:crypto.randomUUID(),variantId:v.id,quantityChange:v.stock,reason:'INITIAL' as const,note:null,createdAt:Date.now()}));await this.storage.saveProduct(product,movements);return product;}
 async adjust(variantId:string,text:string,reason:MovementReason,note:string|null){const products=await this.storage.listProducts();const entry=products.flatMap(p=>p.variants.map(v=>({product:p,variant:v}))).find(x=>x.variant.id===variantId);if(!entry)throw new Error('Variant no longer exists.');const change=manualStockChange(reason,text,entry.variant.stock,entry.product.stockUnit);await this.storage.adjustStock(variantId,change,reason,note?.trim()||null);}
}
