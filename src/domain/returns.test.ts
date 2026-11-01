import { expect, it } from 'vitest';
import type { InvoiceRecord } from './billing';
import { buildReturn } from './returns';

const original:InvoiceRecord={id:'sale',number:'INV/26-27/00001',createdAt:1,type:'SALE',roundedToRupee:true,lines:[{productId:'p',variantId:'v',name:'Item',variantLabel:'',barcode:'',quantity:3,unitPricePaise:'101',mrpPaise:null,stockUnit:'UNIT',lineDiscountPaise:'0',billDiscountSharePaise:'0',discountPaise:'0',discountReason:null,taxablePaise:'303',gstRateBasisPoints:0,cgstPaise:'0',sgstPaise:'0',igstPaise:'0',totalPaise:'303'}],subtotalPaise:'303',lineDiscountPaise:'0',billDiscountPaise:'0',discountPaise:'0',billDiscountReason:null,taxablePaise:'303',cgstPaise:'0',sgstPaise:'0',igstPaise:'0',roundOffPaise:'-3',grandTotalPaise:'300',gstRegistered:false,pricesIncludeTax:false,interState:false,seller:{storeName:'Shop',address:'',gstin:'',stateCode:'19'},customer:{id:'c',name:'Customer',phone:null},payments:[{method:'CREDIT',amountPaise:'150',reference:null,tenderedPaise:null,changePaise:null},{method:'CASH',amountPaise:'150',reference:null,tenderedPaise:null,changePaise:null}]};

it('keeps repeated partial refunds, account credit and the final full refund exact',()=>{
  const first=buildReturn(original,[1],'CASH','First');
  expect(first.creditNote.grandTotalPaise).toBe('100');
  expect(first.creditNote.payments.map(p=>[p.method,p.amountPaise])).toEqual([['CASH','50'],['CREDIT','50']]);
  const second=buildReturn({...original,lines:original.lines.map((line,i)=>({...line,returnedQuantity:first.returned[i]}))},[1],'UPI','');
  const third=buildReturn({...original,lines:original.lines.map((line,i)=>({...line,returnedQuantity:second.returned[i]}))},[1],'CARD','');
  expect([first,second,third].reduce((n,r)=>n+BigInt(r.creditNote.grandTotalPaise),0n)).toBe(300n);
  expect([first,second,third].reduce((n,r)=>n+r.accountCredit,0n)).toBe(150n);
  expect(third.creditNote.originalInvoiceNumber).toBe(original.number);
  expect(()=>buildReturn({...original,lines:[{...original.lines[0]!,returnedQuantity:3}]},[1],'CASH','')).toThrow(/exceeds/);
});

it('follows the recorded rounding choice and requires it on older invoices',()=>{
  const unrounded={...original,roundedToRupee:false,roundOffPaise:'0',grandTotalPaise:'303',payments:[{...original.payments[0]!,amountPaise:'303',method:'CASH' as const}]};
  expect(buildReturn(unrounded,[1],'CASH','').creditNote.grandTotalPaise).toBe('101');
  expect(()=>buildReturn({...original,roundedToRupee:undefined},[1],'CASH','')).toThrow(/older invoice/);
  expect(()=>buildReturn({...original,customer:null},[1],'CREDIT','')).toThrow(/saved customer/);
});
