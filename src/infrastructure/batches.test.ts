import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {LocalDatabase} from './localDatabase';
import type {Product} from '../domain/catalog';
import type {Supplier} from '../domain/purchasing';
import {openDB} from 'idb';

it('migrates pre-batch expiry stock into an unlabelled batch without changing on-hand',async()=>{
  const name='batch-migration-'+crypto.randomUUID(),now=Date.now();
  const old=await openDB(name,10,{upgrade(db){db.createObjectStore('products',{keyPath:'id'});}});
  const legacy:Product={id:'old-food',name:'Cereal',category:'PACKAGED_FOOD',brand:null,gstRateBasisPoints:0,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:now,updatedAt:now,variants:[{id:'old-variant',size:'',colour:'',sku:'OLD',barcode:'',price:'10.00',mrp:'',cost:'4.00',opening:'7',lowStock:'0',pricePaise:'1000',mrpPaise:null,costPaise:'400',stock:7,lowStockThreshold:0}]};await old.put('products',legacy);old.close();
  const db=new LocalDatabase(name);expect(await db.listStockBatches()).toMatchObject([{variantId:'old-variant',batchNumber:null,expiryDate:null,quantity:7}]);await db.close();
});

it('receives expiry batches, sells earliest expiry first, restores returns to the batch sold',async()=>{
  const db=new LocalDatabase('batch-flow-'+crypto.randomUUID()),now=Date.now();
  const product:Product={id:'food',name:'Yogurt',category:'PACKAGED_FOOD',brand:null,gstRateBasisPoints:0,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:now,updatedAt:now,variants:[{id:'yogurt',size:'',colour:'',sku:'YOG',barcode:'',price:'10.00',mrp:'',cost:'4.00',opening:'2',lowStock:'0',pricePaise:'1000',mrpPaise:null,costPaise:'400',stock:2,lowStockThreshold:0,batchNumber:'LATE',expiryDate:'2027-05-01'}]};
  await db.saveProduct(product,[{id:'initial',variantId:'yogurt',quantityChange:2,reason:'INITIAL',note:null,createdAt:now}]);
  const supplier:Supplier={id:'supplier',name:'Dairy',contactPerson:null,phone:null,email:null,gstin:null,stateCode:null,address:null,notes:null,active:true,createdAt:now};await db.saveSupplier(supplier);
  await db.receivePurchase({supplierId:supplier.id,supplierName:supplier.name,orderId:null,orderNumber:null,supplierInvoiceNumber:null,note:null,totalPaise:'1200',requestId:'batch-grn',lines:[{variantId:'yogurt',orderLineId:null,productName:'Yogurt',variantLabel:'',stockUnit:'UNIT',quantity:3,unitCostPaise:'400',batchNumber:'EARLY',expiryDate:'2026-12-01'}]},now+1);
  expect((await db.listStockBatches()).map(b=>[b.batchNumber,b.quantity])).toEqual([['EARLY',3],['LATE',2]]);
  const line={productId:'food',variantId:'yogurt',name:'Yogurt',variantLabel:'',barcode:'',quantity:4,unitPricePaise:'1000',mrpPaise:null,stockUnit:'UNIT' as const,lineDiscountPaise:'0',billDiscountSharePaise:'0',discountPaise:'0',discountReason:null,taxablePaise:'4000',gstRateBasisPoints:0,cgstPaise:'0',sgstPaise:'0',igstPaise:'0',totalPaise:'4000'};
  const invoice=await db.saveSale({type:'SALE',roundedToRupee:false,lines:[line],subtotalPaise:'4000',lineDiscountPaise:'0',billDiscountPaise:'0',discountPaise:'0',billDiscountReason:null,taxablePaise:'4000',cgstPaise:'0',sgstPaise:'0',igstPaise:'0',roundOffPaise:'0',grandTotalPaise:'4000',gstRegistered:false,pricesIncludeTax:false,interState:false,seller:{storeName:'Shop',address:'',gstin:'',stateCode:''},customer:null,payments:[{method:'CASH',amountPaise:'4000',reference:null,tenderedPaise:null,changePaise:null}]},'INV',new Date('2026-11-01T12:00:00Z'));
  expect((await db.listStockBatches()).map(b=>[b.batchNumber,b.quantity])).toEqual([['EARLY',0],['LATE',1]]);
  await db.saveReturn(invoice.id,[1],'CASH','','CN',new Date('2026-11-01T12:05:00Z'));
  expect((await db.listStockBatches()).map(b=>[b.batchNumber,b.quantity])).toEqual([['EARLY',0],['LATE',2]]);
  expect((await db.listMovements()).filter(m=>m.reason==='SOLD').map(m=>[m.batchId,m.quantityChange])).toHaveLength(2);
  const snapshot=await db.snapshot();await db.replaceSnapshot(snapshot);expect((await db.listStockBatches()).map(b=>[b.batchNumber,b.quantity])).toEqual([['EARLY',0],['LATE',2]]);
  await db.close();
});
