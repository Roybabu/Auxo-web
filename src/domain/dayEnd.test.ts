import {expect,it} from 'vitest';
import {buildDayFigures,cashDifference,closingSummary,expectedCash,validateCountedCash} from './dayEnd';
import type {InvoiceRecord,CustomerLedgerEntry} from './billing';

const invoice=(id:string,type:'SALE'|'RETURN',amount:string,method:'CASH'|'UPI',createdAt:number):InvoiceRecord=>({id,number:id,createdAt,type,roundedToRupee:true,lines:[],subtotalPaise:amount,lineDiscountPaise:'0',billDiscountPaise:'0',discountPaise:'0',billDiscountReason:null,taxablePaise:amount,cgstPaise:'0',sgstPaise:'0',igstPaise:'0',roundOffPaise:'0',grandTotalPaise:amount,gstRegistered:false,pricesIncludeTax:false,interState:false,seller:{storeName:'Shop',address:'',gstin:'',stateCode:'19'},customer:null,payments:[{method,amountPaise:amount,reference:null,tenderedPaise:null,changePaise:null,...(type==='RETURN'?{kind:'REFUND' as const}:{})}]});
it('reconciles day sales, cash refunds, account receipts and cash count',()=>{
  const date='2026-11-01',stamp=new Date(`${date}T12:00:00`).getTime(),invoices=[invoice('sale','SALE','10000','CASH',stamp),invoice('return','RETURN','2000','CASH',stamp),invoice('upi','SALE','3000','UPI',stamp)];
  const ledger:CustomerLedgerEntry[]=[{id:'payment',customerId:'c',type:'PAYMENT',amountPaise:'-5000',invoiceId:null,invoiceNumber:null,method:'CASH',reference:null,createdAt:stamp,note:null}];
  const figures=buildDayFigures(date,invoices,ledger);
  expect(figures).toMatchObject({bills:2,returns:1,netSalesPaise:'11000',cashReceivedPaise:'10000',cashRefundedPaise:'2000',cashFromAccountsPaise:'5000',upiNetPaise:'3000'});
  expect(expectedCash(figures)).toBe(13000n);expect(cashDifference(figures,'120.00')).toBe(-1000n);
  expect(closingSummary({id:'x',figures,countedCashPaise:'13000',note:null,closedAt:stamp,closedBy:'admin'}).status).toBe('MATCHES');
  expect(validateCountedCash('130.00')).toBe(13000n);expect(()=>validateCountedCash('bad')).toThrow();
});
