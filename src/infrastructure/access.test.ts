import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { LocalDatabase } from './localDatabase';
import { AuthService } from '../application/authService';
import { AuthorizedStorage } from './authorizedStorage';
import { discountExceeds, normalizeGrants, permissionsFor, switchOff } from '../domain/access';

it('normalizes dependent permissions and excludes admin-only grants',()=>{
  expect(normalizeGrants(['ADJUST_STOCK','MANAGE_USERS'])).toEqual(['MANAGE_PRODUCTS','VIEW_STOCK_RECORDS','ADJUST_STOCK']);
  expect(switchOff(['MANAGE_PRODUCTS','VIEW_STOCK_RECORDS','ADJUST_STOCK'],'VIEW_STOCK_RECORDS')).toEqual([]);
  expect(permissionsFor('EMPLOYEE',[])).toEqual(['SELL','VIEW_INVOICES']);
});
it('enforces the bill and per-line employee discount caps with rounding slack',()=>{
  expect(discountExceeds(499n,50n,[{gross:499n,discount:50n}],1000)).toBe(false);
  expect(discountExceeds(10000n,1001n,[{gross:10000n,discount:1001n}],1000)).toBe(false);
  expect(discountExceeds(10000n,1010n,[{gross:10000n,discount:1010n}],1000)).toBe(true);
  expect(discountExceeds(10000n,1n,[{gross:10000n,discount:1n}],0)).toBe(true);
  expect(discountExceeds(20000n,1000n,[{gross:5000n,discount:1000n},{gross:15000n,discount:0n}],1000)).toBe(true);
});

it('requires login and checks employee access at the storage boundary',async()=>{
  const db=new LocalDatabase('test-access-'+crypto.randomUUID());const auth=new AuthService(db),secured=new AuthorizedStorage(db,auth);
  expect(await auth.needsSetup()).toBe(true);
  await auth.setup('Owner','Owner.User','StrongSecret91','StrongSecret91');
  await expect(auth.setup('Other','other.user','StrongSecret92','StrongSecret92')).rejects.toThrow(/already/);
  await secured.save({storeName:'Shop',address:'',employeeDiscountLimitBp:0});
  await auth.createEmployee('Cashier','cashier','BlueRiverSecret91','BlueRiverSecret91',[]);
  const employee=(await auth.users()).find(u=>u.role==='EMPLOYEE')!;
  auth.signOut();await expect(secured.save({storeName:'Changed',address:''})).rejects.toThrow(/Sign in/);
  await expect(auth.signIn('cashier','wrong')).rejects.toThrow(/incorrect/);
  await auth.signIn('CASHIER','BlueRiverSecret91');
  expect(auth.can('SELL')).toBe(true);expect(auth.can('PROCESS_RETURN')).toBe(false);
  await expect(secured.listMovements()).rejects.toThrow(/VIEW_STOCK_RECORDS/);
  await expect(secured.save({storeName:'Changed',address:''})).rejects.toThrow(/MANAGE_SETTINGS/);
  await expect(secured.saveReturn('missing',[1],'CASH','','CN',new Date())).rejects.toThrow(/PROCESS_RETURN/);
  const line={productId:'p',variantId:'v',name:'Item',variantLabel:'',barcode:'',quantity:1,unitPricePaise:'1000',mrpPaise:null,stockUnit:'UNIT' as const,lineDiscountPaise:'100',billDiscountSharePaise:'0',discountPaise:'100',discountReason:'Offer',taxablePaise:'900',gstRateBasisPoints:0,cgstPaise:'0',sgstPaise:'0',igstPaise:'0',totalPaise:'900'};
  const draft={type:'SALE' as const,roundedToRupee:false,lines:[line],subtotalPaise:'1000',lineDiscountPaise:'100',billDiscountPaise:'0',discountPaise:'100',billDiscountReason:null,taxablePaise:'900',cgstPaise:'0',sgstPaise:'0',igstPaise:'0',roundOffPaise:'0',grandTotalPaise:'900',gstRegistered:false,pricesIncludeTax:false,interState:false,seller:{storeName:'Shop',address:'',gstin:'',stateCode:''},customer:null,payments:[{method:'CASH' as const,amountPaise:'900',reference:null,tenderedPaise:null,changePaise:null}]};
  await expect(secured.saveSale(draft,'INV',new Date())).rejects.toThrow(/discount exceeds/);
  expect((await db.listInvoices()).length).toBe(0);
  auth.signOut();await auth.signIn('owner.user','StrongSecret91');await auth.setGrants(employee.id,['PROCESS_RETURN']);await auth.setActive(employee.id,false);
  auth.signOut();await expect(auth.signIn('cashier','BlueRiverSecret91')).rejects.toThrow(/deactivated/);
  await db.close();
});
