import type { ShopIdentity } from './shop';
import type { Product, StockMovement } from './catalog';
import type { BillingCustomer, CustomerLedgerEntry, InvoiceRecord } from './billing';
import type { StoredAccount } from '../application/authService';
import type { HeldBill } from './heldBills';

export type BusinessSnapshot={shop:ShopIdentity|null;products:Product[];movements:StockMovement[];invoices:InvoiceRecord[];customers:BillingCustomer[];customerLedger:CustomerLedgerEntry[];accounts:StoredAccount[];heldBills:HeldBill[]};
export type PortableBackup={app:'auxo-web-genesis';format:1;createdAt:number;databaseVersion:7;data:BusinessSnapshot};
export type BackupSummary={createdAt:number;storeName:string;products:number;invoices:number;customers:number;employees:number};
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const id=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=200;
const money=(value:unknown)=>typeof value==='string'&&/^-?\d{1,19}$/.test(value);
function unique(values:string[]){return new Set(values).size===values.length;}

/** Validate structure and relationships before any store is cleared. Older web formats are not guessed. */
export function validateBackup(value:unknown):PortableBackup{
  if(!object(value)||value.app!=='auxo-web-genesis'||value.format!==1)throw new Error('This is not a supported AUXO Web backup.');
  if(value.databaseVersion!==6&&value.databaseVersion!==7)throw new Error('This backup uses a different database version.');
  if(!Number.isSafeInteger(value.createdAt)||Number(value.createdAt)<=0||!object(value.data))throw new Error('Backup metadata is invalid.');
  const d=value.data;if(value.databaseVersion===6&&!Array.isArray(d.heldBills))d.heldBills=[];
  const names=['products','movements','invoices','customers','customerLedger','accounts','heldBills'] as const;
  if(names.some(name=>!Array.isArray(d[name])))throw new Error('Backup tables are missing.');
  if(d.shop!==null&&(!object(d.shop)||typeof d.shop.storeName!=='string'||!d.shop.storeName.trim()||typeof d.shop.address!=='string'))throw new Error('Business settings in backup are invalid.');
  const rows=d as Record<string,unknown[]>;for(const name of names){if(rows[name]!.some(row=>!object(row)||!id(row.id))||!unique(rows[name]!.map(row=>(row as {id:string}).id)))throw new Error(`Backup ${name} contains invalid or duplicate IDs.`);}
  const products=rows.products as unknown as Product[],customers=rows.customers as unknown as BillingCustomer[],invoices=rows.invoices as unknown as InvoiceRecord[],accounts=rows.accounts as unknown as StoredAccount[];
  const variantIds=new Set<string>();for(const p of products){if(typeof p.name!=='string'||!Array.isArray(p.variants)||!p.variants.length)throw new Error('Backup product is invalid.');for(const v of p.variants){if(!object(v)||!id(v.id)||variantIds.has(v.id)||!Number.isSafeInteger(v.stock)||v.stock<0||!money(v.pricePaise))throw new Error('Backup variant or stock is invalid.');variantIds.add(v.id);}}
  const customerIds=new Set(customers.map(c=>c.id)),invoiceIds=new Set(invoices.map(i=>i.id));
  for(const c of customers)if(typeof c.name!=='string'||!money(c.balancePaise)||c.creditLimitPaise!==null&&c.creditLimitPaise!==undefined&&!money(c.creditLimitPaise))throw new Error('Backup customer is invalid.');
  if(!unique(invoices.map(i=>i.number)))throw new Error('Backup invoice numbers are duplicated.');
  for(const invoice of invoices){if(!id(invoice.number)||!Array.isArray(invoice.lines)||!Array.isArray(invoice.payments)||!money(invoice.grandTotalPaise)||invoice.customer&&!customerIds.has(invoice.customer.id)||invoice.originalInvoiceId&&!invoiceIds.has(invoice.originalInvoiceId))throw new Error('Backup invoice is invalid.');for(const line of invoice.lines)if(!object(line)||!id(line.variantId)||!variantIds.has(line.variantId)||!Number.isSafeInteger(line.quantity)||line.quantity<=0||!money(line.totalPaise))throw new Error('Backup invoice line is invalid.');}
  for(const m of rows.movements as unknown as StockMovement[])if(!variantIds.has(m.variantId)||!Number.isSafeInteger(m.quantityChange))throw new Error('Backup stock movement is invalid.');
  for(const entry of rows.customerLedger as unknown as CustomerLedgerEntry[])if(!customerIds.has(entry.customerId)||entry.invoiceId&&!invoiceIds.has(entry.invoiceId)||!money(entry.amountPaise))throw new Error('Backup customer statement is invalid.');
  for(const bill of rows.heldBills as unknown as HeldBill[])if(typeof bill.label!=='string'||!Array.isArray(bill.lines)||!money(bill.totalPaise)||bill.tableNumber!==null&&(!Number.isInteger(bill.tableNumber)||bill.tableNumber<1||bill.tableNumber>99)||bill.lines.some(line=>!variantIds.has(line.variantId)))throw new Error('Backup held bill is invalid.');
  if(accounts.filter(a=>a.role==='SUPER_ADMIN').length!==1||accounts.find(a=>a.role==='SUPER_ADMIN')?.active!==true||!unique(accounts.map(a=>a.identifier)))throw new Error('Backup must contain one active Super Admin and unique logins.');
  for(const a of accounts)if(!id(a.identifier)||!id(a.name)||!['SUPER_ADMIN','EMPLOYEE'].includes(a.role)||typeof a.active!=='boolean'||!Array.isArray(a.granted)||!/^[a-f0-9]{32}$/.test(a.salt)||!/^[a-f0-9]{64}$/.test(a.hash)||!Number.isInteger(a.iterations)||a.iterations<100_000||a.iterations>5_000_000||a.recovery&&(!/^[a-f0-9]{32}$/.test(a.recovery.salt)||!/^[a-f0-9]{64}$/.test(a.recovery.hash)||!Number.isInteger(a.recovery.iterations)||a.recovery.iterations<100_000||a.recovery.iterations>5_000_000))throw new Error('Backup account is invalid.');
  return {...value,databaseVersion:7,data:d as unknown as BusinessSnapshot} as PortableBackup;
}
export function summarizeBackup(backup:PortableBackup):BackupSummary{return {createdAt:backup.createdAt,storeName:backup.data.shop?.storeName??'Unnamed business',products:backup.data.products.length,invoices:backup.data.invoices.length,customers:backup.data.customers.length,employees:backup.data.accounts.filter(a=>a.role==='EMPLOYEE').length};}
