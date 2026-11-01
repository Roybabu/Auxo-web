import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { LocalDatabase } from './localDatabase';
import { ShopService } from '../application/shopService';
import type { Product } from '../domain/catalog';
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
it('saves invoice, sale movement and stock deduction atomically',async()=>{
  const db=new LocalDatabase('test-sale-atomic');const now=Date.now();
  const product:Product={id:'p1',name:'Tea',category:'GENERAL',brand:null,gstRateBasisPoints:500,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:now,updatedAt:now,variants:[{id:'v1',size:'',colour:'',sku:'TEA',barcode:'',price:'10.00',mrp:'',cost:'',opening:'5',lowStock:'0',pricePaise:'1000',mrpPaise:null,costPaise:null,stock:5,lowStockThreshold:0}]};
  await db.saveProduct(product,[]);
  const line={productId:'p1',variantId:'v1',name:'Tea',variantLabel:'',barcode:'',quantity:2,unitPricePaise:'1000',mrpPaise:null,stockUnit:'UNIT' as const,discountPaise:'0',taxablePaise:'2000',gstRateBasisPoints:500,cgstPaise:'50',sgstPaise:'50',igstPaise:'0',totalPaise:'2100'};
  const draft={lines:[line],subtotalPaise:'2000',discountPaise:'0',taxablePaise:'2000',cgstPaise:'50',sgstPaise:'50',igstPaise:'0',roundOffPaise:'0',grandTotalPaise:'2100',gstRegistered:true,pricesIncludeTax:false,interState:false,seller:{storeName:'Shop',address:'',gstin:'19ABCDE1234F1Z5',stateCode:'19'},payments:[{method:'CASH' as const,amountPaise:'2100',reference:null,tenderedPaise:null,changePaise:null}]};
  const invoice=await db.saveSale(draft,'INV',new Date('2026-11-01T12:00:00Z'));
  expect(invoice.number).toBe('INV/26-27/00001');expect((await db.listProducts())[0]?.variants[0]?.stock).toBe(3);expect((await db.listMovements())[0]?.quantityChange).toBe(-2);expect((await db.listInvoices())[0]?.id).toBe(invoice.id);
  await expect(db.saveSale({...draft,lines:[{...line,quantity:4}]},'INV',new Date('2026-11-01T12:00:00Z'))).rejects.toThrow(/enough stock/);
  expect((await db.listProducts())[0]?.variants[0]?.stock).toBe(3);expect((await db.listInvoices()).length).toBe(1);await db.close();
});
