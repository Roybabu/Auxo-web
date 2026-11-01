import 'fake-indexeddb/auto';
import {expect,it,vi} from 'vitest';
import {LocalDatabase} from './localDatabase';
import {AuthService} from '../application/authService';
import {ActivityLogService} from '../application/activityLogService';
import {ShopService} from '../application/shopService';
import {AuthorizedStorage} from './authorizedStorage';
import type {Product} from '../domain/catalog';
import type {InvoiceRecord} from '../domain/billing';
import type {Supplier} from '../domain/purchasing';
import {CatalogService} from '../application/catalogService';

it('persists recent activity, includes it in snapshots, and restores it with backups',async()=>{
 const db=new LocalDatabase(`audit-${crypto.randomUUID()}`);
 await db.recordAudit({id:'admin-1',name:'Owner',role:'SUPER_ADMIN'},'SALE_RECORDED','invoice','invoice-1','Sale INV/1, total 1200 paise',100);
 await db.recordAudit({id:'staff-1',name:'Staff',role:'EMPLOYEE'},'STOCK_CHANGED','variant','variant-1','Stock changed by -2',200);
 const rows=await db.listRecentAudit();expect(rows.map(row=>row.action)).toEqual(['STOCK_CHANGED','SALE_RECORDED']);
 const snapshot=await db.snapshot();expect(snapshot.auditLog).toHaveLength(2);
 await db.replaceSnapshot({...snapshot,auditLog:[snapshot.auditLog[0]!]});expect(await db.listRecentAudit()).toHaveLength(1);
 await db.close();
});

it('requires the activity-log permission to view entries',async()=>{
 const db=new LocalDatabase(`audit-access-${crypto.randomUUID()}`),auth=new AuthService(db),service=new ActivityLogService(db,auth);
 await expect(service.recent()).rejects.toThrow(/Sign in/);
 await auth.setup('Owner','owner.audit','Strong-Password-483','Strong-Password-483');
 const shops=new ShopService(new AuthorizedStorage(db,auth));await shops.save({storeName:'Audit Shop',address:''});
 const summaries=(await service.recent()).map(row=>row.summary);expect(summaries.some(summary=>summary.startsWith('Saved business settings for Audit Shop'))).toBe(true);expect(summaries).toContain('Owner set up the administrator account');
 await db.close();
});

it('records a stock write-off with the matching Android audit action',async()=>{
 const db=new LocalDatabase(`audit-writeoff-${crypto.randomUUID()}`),auth=new AuthService(db);
 await auth.setup('Owner','owner.writeoff','Strong-Password-584','Strong-Password-584');
 const now=Date.now(),product:Product={id:'p',name:'Tea',category:'GENERAL',brand:null,gstRateBasisPoints:0,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:now,updatedAt:now,variants:[{id:'v',size:'',colour:'',sku:'',barcode:'',price:'10.00',mrp:'',cost:'',opening:'5',lowStock:'0',pricePaise:'1000',mrpPaise:null,costPaise:null,stock:5,lowStockThreshold:0}]};
 await db.saveProduct(product,[]);const secured=new AuthorizedStorage(db,auth);await secured.adjustStock('v',-2,'DAMAGED','Broken items');
 const event=(await db.listRecentAudit()).find(row=>row.entityId==='v');expect(event).toMatchObject({action:'STOCK_WRITTEN_OFF',summary:'Wrote off 2 (damaged)'});
 await db.close();
});

it('rolls back a product write when its audit row cannot be added',async()=>{
 const db=new LocalDatabase(`audit-rollback-${crypto.randomUUID()}`),now=Date.now();
 const random=vi.spyOn(crypto,'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
 try{
  await db.recordAudit(null,'PRODUCT_SAVED','product','existing','Existing audit row');
  const product:Product={id:'rollback-product',name:'Rollback tea',category:'GENERAL',brand:null,gstRateBasisPoints:0,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:now,updatedAt:now,variants:[{id:'rollback-variant',size:'',colour:'',sku:'',barcode:'',price:'1.00',mrp:'',cost:'',opening:'0',lowStock:'0',pricePaise:'100',mrpPaise:null,costPaise:null,stock:0,lowStockThreshold:0}]};
  await expect(db.saveProduct(product,[],{actor:null,action:'PRODUCT_SAVED',entityType:'product',entityId:product.id,summary:`Saved product ${product.name}`})).rejects.toBeDefined();
  expect(await db.listProducts()).toEqual([]);
  expect(await db.listRecentAudit()).toHaveLength(1);
 }finally{random.mockRestore();await db.close();}
});

it('rolls back sale stock and invoice rows when sale auditing fails',async()=>{
 const db=new LocalDatabase(`audit-sale-rollback-${crypto.randomUUID()}`),collision='00000000-0000-4000-8000-000000000011';
 const random=vi.spyOn(crypto,'randomUUID').mockReturnValue(collision);
 try{
  await db.recordAudit(null,'SALE_RECORDED','invoice','existing','Existing audit row');
  random.mockImplementationOnce(()=> '00000000-0000-4000-8000-000000000012').mockImplementationOnce(()=>collision);
  const draft:Omit<InvoiceRecord,'id'|'number'|'createdAt'>={type:'SALE',roundedToRupee:true,lines:[],subtotalPaise:'100',lineDiscountPaise:'0',billDiscountPaise:'0',discountPaise:'0',billDiscountReason:null,taxablePaise:'100',cgstPaise:'0',sgstPaise:'0',igstPaise:'0',roundOffPaise:'0',grandTotalPaise:'100',gstRegistered:false,pricesIncludeTax:false,interState:false,seller:{storeName:'Shop',address:'',gstin:'',stateCode:'19'},customer:null,payments:[]};
  await expect(db.saveSale(draft,'INV',new Date('2026-11-01T12:00:00Z'),undefined,invoice=>({actor:null,action:'SALE_RECORDED',entityType:'invoice',entityId:invoice.id,summary:`Sale ${invoice.number}`}))).rejects.toBeDefined();
  expect(await db.listInvoices()).toEqual([]);expect(await db.listRecentAudit()).toHaveLength(1);
 }finally{random.mockRestore();await db.close();}
});

it('rolls back stock changes and movements when stock auditing fails',async()=>{
 const db=new LocalDatabase(`audit-stock-rollback-${crypto.randomUUID()}`),now=Date.now(),collision='00000000-0000-4000-8000-000000000021';
 const product:Product={id:'stock-product',name:'Rollback tea',category:'GENERAL',brand:null,gstRateBasisPoints:0,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:now,updatedAt:now,variants:[{id:'stock-variant',size:'',colour:'',sku:'',barcode:'',price:'1.00',mrp:'',cost:'',opening:'5',lowStock:'0',pricePaise:'100',mrpPaise:null,costPaise:null,stock:5,lowStockThreshold:0}]};
 await db.saveProduct(product,[]);const random=vi.spyOn(crypto,'randomUUID').mockReturnValue(collision);
 try{
  await db.recordAudit(null,'STOCK_CHANGED','variant','existing','Existing audit row');
  random.mockImplementationOnce(()=> '00000000-0000-4000-8000-000000000022').mockImplementationOnce(()=>collision);
  await expect(db.adjustStock('stock-variant',-1,'DAMAGED','Broken items',undefined,undefined,()=>[{actor:null,action:'STOCK_WRITTEN_OFF',entityType:'variant',entityId:'stock-variant',summary:'Wrote off 1 (damaged)'}])).rejects.toBeDefined();
  expect((await db.listProducts())[0]?.variants[0]?.stock).toBe(5);expect(await db.listMovements()).toEqual([]);expect(await db.listRecentAudit()).toHaveLength(1);
 }finally{random.mockRestore();await db.close();}
});

it('records a separate batch audit entry for every batch consumed by a write-off',async()=>{
 const db=new LocalDatabase(`audit-batch-writeoff-${crypto.randomUUID()}`),auth=new AuthService(db),now=Date.now();
 const product:Product={id:'batch-product',name:'Medicine',category:'PHARMACY',brand:null,gstRateBasisPoints:0,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:now,updatedAt:now,variants:[{id:'batch-variant',size:'',colour:'',sku:'MED',barcode:'',price:'1.00',mrp:'',cost:'',opening:'2',lowStock:'0',pricePaise:'100',mrpPaise:null,costPaise:null,stock:2,lowStockThreshold:0,batchNumber:'LOT-A',expiryDate:'2027-01-01'}]};
 await db.saveProduct(product,[]);await db.adjustStock('batch-variant',3,'RECEIVED',null,{batchNumber:'LOT-B',expiryDate:'2028-01-01'});
 const batches=await db.listStockBatches(),first=batches.find(row=>row.batchNumber==='LOT-A')!,second=batches.find(row=>row.batchNumber==='LOT-B')!;
 await auth.setup('Owner','owner.batch','Strong-Password-684','Strong-Password-684');const secured=new AuthorizedStorage(db,auth);
 await secured.adjustStock('batch-variant',-4,'DAMAGED','Broken stock');
 const events=(await db.listRecentAudit()).filter(row=>row.action==='STOCK_WRITTEN_OFF');
 expect(events).toHaveLength(2);expect(events).toEqual(expect.arrayContaining([expect.objectContaining({entityType:'batch',entityId:first.id,summary:'Wrote off 2 (damaged)'}),expect.objectContaining({entityType:'batch',entityId:second.id,summary:'Wrote off 2 (damaged)'})]));
 expect((await db.listProducts())[0]?.variants[0]?.stock).toBe(1);await db.close();
});

it('audits category add, rename, enable and delete operations',async()=>{
 const db=new LocalDatabase(`audit-categories-${crypto.randomUUID()}`),auth=new AuthService(db);await auth.setup('Owner','owner.category','Strong-Password-785','Strong-Password-785');
 const actor=auth.getSnapshot(),builtIns=await db.listCategories();expect(builtIns.find(row=>row.profile==='RESTAURANT')?.enabled).toBe(false);
 const added=await db.addCategory('Sweets','PACKAGED_FOOD',actor);await db.renameCategory(added.id,'Indian Sweets',actor);await db.setCategoryEnabled(added.id,false,actor);await db.deleteCategory(added.id,actor);
 const events=(await db.listRecentAudit()).filter(row=>row.action==='CATEGORIES_CHANGED');expect(events.map(row=>row.summary).sort()).toEqual(['Category "Sweets" added',`Category ${added.id} renamed to "Indian Sweets"`,`Category ${added.id} switched off`,'Category Indian Sweets deleted'].sort());expect(events.every(row=>row.entityType==='category'&&row.entityId===added.id)).toBe(true);await db.close();
});

it('uses the selected category profile and preserves the category relation on products',async()=>{
 const db=new LocalDatabase(`product-category-link-${crypto.randomUUID()}`),auth=new AuthService(db);await auth.setup('Owner','owner.product-category','Strong-Password-886','Strong-Password-886');
 const category=await db.addCategory('Sweets','PACKAGED_FOOD',auth.getSnapshot()),catalog=new CatalogService(new AuthorizedStorage(db,auth));
 const product=await catalog.create({name:'Jaggery',category:'PACKAGED_FOOD',categoryId:category.id,brand:'',gstRateBasisPoints:null,apparelGst:false,variants:[{size:'',colour:'',sku:'',barcode:'',price:'10.00',mrp:'',cost:'',opening:'0',lowStock:'0'}]});
 expect(product.category).toBe('PACKAGED_FOOD');expect(product.categoryId).toBe(category.id);await expect(db.deleteCategory(category.id,auth.getSnapshot())).rejects.toThrow(/products still use/i);await db.close();
});

it('requires a category at first setup and records the chosen set atomically',async()=>{
 const db=new LocalDatabase(`category-setup-${crypto.randomUUID()}`),auth=new AuthService(db);await auth.setup('Owner','owner.category-setup','Strong-Password-987','Strong-Password-987');
 expect(await db.needsCategorySetup()).toBe(true);const categories=await db.listCategories(),chosen=categories.filter(row=>row.profile==='GARMENT'||row.profile==='PHARMACY').map(row=>row.id);
 await expect(db.applyCategorySetup(new Set(),auth.getSnapshot())).rejects.toThrow(/at least one/i);expect(await db.needsCategorySetup()).toBe(true);
 await db.applyCategorySetup(new Set(chosen),auth.getSnapshot());expect(await db.needsCategorySetup()).toBe(false);expect((await db.listCategories()).filter(row=>row.enabled).map(row=>row.profile).sort()).toEqual(['GARMENT','PHARMACY']);
 expect((await db.listRecentAudit()).find(row=>row.action==='CATEGORIES_CHANGED')).toMatchObject({summary:'Categories chosen during setup',entityType:'category',entityId:null});await db.close();
});

it('rolls back a new administrator account when its sign-in audit fails',async()=>{
 const db=new LocalDatabase(`audit-account-rollback-${crypto.randomUUID()}`),auth=new AuthService(db),collision='00000000-0000-4000-8000-000000000031';
 const random=vi.spyOn(crypto,'randomUUID').mockReturnValue(collision);
 try{
  await db.recordAudit(null,'SIGNED_IN','user','existing','Existing audit row');
  random.mockImplementationOnce(()=> '00000000-0000-4000-8000-000000000032').mockImplementationOnce(()=>collision);
  await expect(auth.setup('Owner','owner.rollback','Strong-Password-483','Strong-Password-483')).rejects.toBeDefined();
  expect(await auth.needsSetup()).toBe(true);expect(auth.getSnapshot()).toBeNull();expect(await db.listRecentAudit()).toHaveLength(1);
 }finally{random.mockRestore();await db.close();}
});

it('rolls back a purchase order when its audit row cannot be added',async()=>{
 const db=new LocalDatabase(`audit-order-rollback-${crypto.randomUUID()}`),collision='00000000-0000-4000-8000-000000000041';
 const supplier:Supplier={id:'supplier-rollback',name:'Supplier',contactPerson:null,phone:null,email:null,gstin:null,stateCode:null,address:null,notes:null,active:true,createdAt:Date.now()};
 await db.saveSupplier(supplier);const random=vi.spyOn(crypto,'randomUUID').mockReturnValue(collision);
 try{
  await db.recordAudit(null,'ORDER_SAVED','purchase_order','existing','Existing audit row');
  random.mockImplementationOnce(()=> '00000000-0000-4000-8000-000000000042').mockImplementationOnce(()=>collision);
  await expect(db.savePurchaseOrder({supplierId:supplier.id,supplierName:supplier.name,status:'DRAFT',expectedDate:null,note:null,lines:[]} ,undefined,order=>({actor:null,action:'ORDER_SAVED',entityType:'purchase_order',entityId:order.id,summary:`Saved ${order.number}`}))).rejects.toBeDefined();
  expect(await db.listPurchaseOrders()).toEqual([]);expect(await db.listRecentAudit()).toHaveLength(1);
 }finally{random.mockRestore();await db.close();}
});
