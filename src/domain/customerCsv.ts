import type {BillingCustomer,CustomerDraft} from './billing';
import {formatMoney} from './money';
import {parseProductCsv} from './productImport';

export const CUSTOMER_COLUMNS=['name','phone','email','gstin','state_code','address','notes','credit_limit','opening_balance','outstanding','last_purchase'] as const;
const risky=/^[=+@]|^-(?![\d.])/;
const cell=(value:string)=>{const safe=risky.test(value)?`'${value}`:value;return /[",\n\r']/.test(safe)?`"${safe.replace(/"/g,'""')}"`:safe;};

/** Customers as CSV. The outstanding and last_purchase columns are for reading; import ignores them. */
export function customersCsv(customers:readonly BillingCustomer[],lastPurchase:ReadonlyMap<string,number>):string{
  const rows=customers.map(c=>{const last=lastPurchase.get(c.id);const d=last?new Date(last):null;return [c.name,c.phone??'',c.email??'',c.gstin??'',c.stateCode??'',c.address??'',c.notes??'',c.creditLimitPaise===null?'':formatMoney(BigInt(c.creditLimitPaise)),'',formatMoney(BigInt(c.balancePaise)),d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:''];});
  return [[...CUSTOMER_COLUMNS],...rows].map(row=>row.map(value=>cell(value)).join(',')).join('\r\n')+'\r\n';
}

const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const ALIASES:Record<string,string[]>={name:['name','customer','customername','party','partyname'],phone:['phone','mobile','mobilenumber','phonenumber','contact'],email:['email','emailaddress'],gstin:['gstin','gst','gstno','gstnumber'],state_code:['statecode','state'],address:['address'],notes:['notes','note','remarks'],credit_limit:['creditlimit','limit'],opening_balance:['openingbalance','opening','balance','due','outstandingopening']};
export type CustomerImportRow={row:number;draft?:CustomerDraft;issue?:string;duplicate?:boolean};

/**
 * Reads a customer list. Rows whose phone (or, without a phone, whose name) matches
 * an existing customer are marked as duplicates and skipped on import.
 */
export function previewCustomerCsv(text:string,existing:readonly BillingCustomer[]):CustomerImportRow[]{
  const table=parseProductCsv(text);
  const index=(key:string)=>table.header.findIndex(h=>ALIASES[key]!.includes(norm(h)));
  const col=Object.fromEntries(Object.keys(ALIASES).map(key=>[key,index(key)])) as Record<string,number>;
  if(col.name!<0)throw new Error('Could not find a customer name column.');
  const phones=new Set(existing.map(c=>(c.phone??'').replace(/\D/g,'').slice(-10)).filter(Boolean)),names=new Set(existing.filter(c=>!c.phone).map(c=>c.name.trim().toLowerCase())),seen=new Set<string>();
  return table.rows.map(r=>{
    const get=(key:string)=>(col[key]!>=0?r.cells[col[key]!]??'':'').trim().replace(/^'(?=[=+@-])/,'');
    const name=get('name');if(!name)return {row:r.number,issue:`Row ${r.number}: customer name is required.`};
    const phone=get('phone'),digits=phone.replace(/\D/g,'').slice(-10),key=digits||`name:${name.toLowerCase()}`;
    const duplicate=(digits?phones.has(digits):names.has(name.toLowerCase()))||seen.has(key);seen.add(key);
    const draft:CustomerDraft={name,phone,email:get('email'),gstin:get('gstin').toUpperCase(),stateCode:get('state_code').replace(/\D/g,'').slice(0,2),address:get('address'),notes:get('notes'),creditLimit:get('credit_limit').replace(/[₹,\s]/g,''),openingBalance:get('opening_balance').replace(/[₹,\s]/g,''),onHold:false};
    return duplicate?{row:r.number,draft,duplicate:true}:{row:r.number,draft};
  });
}
