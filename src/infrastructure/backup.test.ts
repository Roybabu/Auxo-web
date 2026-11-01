import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { AuthService } from '../application/authService';
import { BackupService } from '../application/backupService';
import { LocalDatabase } from './localDatabase';
import type { Product } from '../domain/catalog';

it('encrypts a complete local snapshot, previews it, and restores it atomically',async()=>{
  const db=new LocalDatabase('test-backup-'+crypto.randomUUID()),auth=new AuthService(db),backups=new BackupService(db,auth);
  await auth.setup('Owner','owner','RiverStoneSecret91','RiverStoneSecret91');const code=await auth.startRecoveryCode();await auth.confirmRecoveryCode(code);
  await db.saveLoyaltyRules({enabled:true,spendPerPointPaise:'500',pointValuePaise:'100'});
  await db.save({storeName:'Original shop',address:'First road'});
  await auth.createEmployee('Cashier','cashier','BlueRiverSecret91','BlueRiverSecret91',['PROCESS_RETURN']);
  const now=Date.now();const customer={id:'customer-backup',name:'Customer',phone:null,creditLimitPaise:null,balancePaise:'0',onHold:false,createdAt:now};await db.createCustomer(customer);
  const product:Product={id:'product-backup',name:'Mug',category:'GENERAL',brand:null,gstRateBasisPoints:0,apparelGst:false,stockUnit:'UNIT',tracksStock:true,createdAt:now,updatedAt:now,variants:[{id:'variant-backup',size:'',colour:'',sku:'MUG-B',barcode:'',price:'10.00',mrp:'',cost:'',opening:'2',lowStock:'0',pricePaise:'1000',mrpPaise:null,costPaise:null,stock:2,lowStockThreshold:0}]};await db.saveProduct(product,[]);
  const line={productId:product.id,variantId:'variant-backup',name:'Mug',variantLabel:'',barcode:'',quantity:1,unitPricePaise:'1000',mrpPaise:null,stockUnit:'UNIT' as const,lineDiscountPaise:'0',billDiscountSharePaise:'0',discountPaise:'0',discountReason:null,taxablePaise:'1000',gstRateBasisPoints:0,cgstPaise:'0',sgstPaise:'0',igstPaise:'0',totalPaise:'1000'};
  await db.saveSale({type:'SALE',roundedToRupee:false,lines:[line],subtotalPaise:'1000',lineDiscountPaise:'0',billDiscountPaise:'0',discountPaise:'0',billDiscountReason:null,taxablePaise:'1000',cgstPaise:'0',sgstPaise:'0',igstPaise:'0',roundOffPaise:'0',grandTotalPaise:'1000',gstRegistered:false,pricesIncludeTax:false,interState:false,seller:{storeName:'Original shop',address:'',gstin:'',stateCode:''},customer:{id:customer.id,name:customer.name,phone:null},payments:[{method:'CREDIT',amountPaise:'1000',reference:null,tenderedPaise:null,changePaise:null}]},'INV',new Date());
  const blob=await backups.export('long backup phrase 91');expect(blob.type).toBe('application/octet-stream');
  const bytes=new Uint8Array(await blob.arrayBuffer());expect(new TextDecoder().decode(bytes.subarray(0,8))).toBe('AUXOWEB1');
  expect(new TextDecoder().decode(bytes)).not.toContain('Original shop');
  await expect(backups.inspect(blob,'wrong phrase')).rejects.toThrow(/Wrong passphrase/);
  const tampered=new Uint8Array(bytes);tampered[tampered.length-1]=tampered[tampered.length-1]!^1;
  await expect(backups.inspect(new Blob([tampered]),'long backup phrase 91')).rejects.toThrow(/damaged/);
  const prepared=await backups.inspect(blob,'long backup phrase 91');expect(prepared.summary).toMatchObject({storeName:'Original shop',products:1,invoices:1,customers:1,employees:1});
  await db.save({storeName:'Changed shop',address:'Second road'});
  await expect(backups.restore({...prepared,backup:{...prepared.backup,data:{...prepared.backup.data,products:[{id:'broken'} as never]}}})).rejects.toThrow(/product/);
  expect((await db.load())?.storeName).toBe('Changed shop');
  await backups.restore(prepared);expect(auth.getSnapshot()).toBeNull();expect((await db.load())?.storeName).toBe('Original shop');
  expect((await db.listAccounts()).length).toBe(2);expect((await db.listProducts())[0]?.variants[0]?.stock).toBe(1);
  expect((await db.listInvoices()).length).toBe(1);expect((await db.listCustomers())[0]?.balancePaise).toBe('1000');expect((await db.listCustomerLedger(customer.id)).length).toBe(1);expect(await db.getLoyaltyPointsBalance(customer.id)).toBe(2);expect((await db.getLoyaltyRules()).enabled).toBe(true);
  await auth.signIn('owner','RiverStoneSecret91');expect(auth.getSnapshot()?.role).toBe('SUPER_ADMIN');
  await db.close();
});

it('blocks employee backup access at the service boundary',async()=>{
  const db=new LocalDatabase('test-backup-permission-'+crypto.randomUUID()),auth=new AuthService(db),backups=new BackupService(db,auth);
  await auth.setup('Owner','owner','RiverStoneSecret91','RiverStoneSecret91');await auth.createEmployee('Cashier','cashier','BlueRiverSecret91','BlueRiverSecret91',[]);await auth.signOut();await auth.signIn('cashier','BlueRiverSecret91');
  await expect(backups.export('long backup phrase 91')).rejects.toThrow(/BACKUP_AND_RESTORE/);
  await expect(backups.inspect(new Blob(['no']),'passphrase')).rejects.toThrow(/BACKUP_AND_RESTORE/);
  await db.close();
});
