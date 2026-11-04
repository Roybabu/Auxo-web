import { checkedMoney } from './money';
import { placeOfSupplyFor, type InvoiceLineSnapshot, type InvoiceRecord, type PaymentDraft } from './billing';

export type RefundMethod=PaymentDraft['method'];
const halfUp=(n:bigint,d:bigint)=>(n+d/2n)/d;
const sum=(values:bigint[])=>values.reduce((a,b)=>checkedMoney(a+b),0n);
const portion=(amount:string,count:number,of:number)=>halfUp(BigInt(amount)*BigInt(count),BigInt(of));
const lineDue=(line:InvoiceLineSnapshot,count:number)=>sum(['taxablePaise','cgstPaise','sgstPaise','igstPaise'].map(key=>portion(line[key as keyof InvoiceLineSnapshot] as string,count,line.quantity)));
function refundDue(original:InvoiceRecord,counts:number[]){
  if(original.lines.every((line,i)=>(counts[i]??0)>=line.quantity))return BigInt(original.grandTotalPaise);
  const raw=sum(original.lines.map((line,i)=>lineDue(line,counts[i]??0)));
  return original.roundedToRupee?halfUp(raw,100n)*100n:raw;
}
function accountShare(original:InvoiceRecord,counts:number[]){const account=sum(original.payments.filter(p=>p.method==='CREDIT'&&(p.kind??'PAYMENT')==='PAYMENT').map(p=>BigInt(p.amountPaise)));if(account===0n)return 0n;const due=refundDue(original,counts),grand=BigInt(original.grandTotalPaise);return due>=grand?account:halfUp(account*due,grand);}
export function buildReturn(original:InvoiceRecord,requested:readonly number[],method:RefundMethod,reason:string):{creditNote:Omit<InvoiceRecord,'id'|'number'|'createdAt'>;returned:number[];accountCredit:bigint}{
  if((original.type??'SALE')!=='SALE')throw new Error('Only sale invoices can be returned.');
  if(typeof original.roundedToRupee!=='boolean')throw new Error('This older invoice does not record its rounding rule; its refund cannot be calculated reliably.');
  if(method==='CREDIT'&&!original.customer)throw new Error('Refund to account needs a saved customer.');
  if(requested.length!==original.lines.length)throw new Error('Return quantities do not match the invoice.');
  const before=original.lines.map(line=>line.returnedQuantity??0),after=original.lines.map((line,i)=>{const qty=requested[i]!;if(!Number.isInteger(qty)||qty<0||qty>line.quantity-before[i]!)throw new Error('Return quantity exceeds the units available.');return before[i]!+qty;});
  if(requested.every(q=>q===0))throw new Error('Select at least one item to return.');
  const share=(value:string,i:number)=>portion(value,after[i]!,original.lines[i]!.quantity)-portion(value,before[i]!,original.lines[i]!.quantity);
  const lines=original.lines.flatMap((line,i)=>{if(requested[i]===0)return [];const taxable=share(line.taxablePaise,i),cgst=share(line.cgstPaise,i),sgst=share(line.sgstPaise,i),igst=share(line.igstPaise,i);return [{...line,quantity:requested[i]!,originalLineIndex:i,returnedQuantity:0,lineDiscountPaise:share(line.lineDiscountPaise??'0',i).toString(),billDiscountSharePaise:share(line.billDiscountSharePaise??'0',i).toString(),discountPaise:share(line.discountPaise,i).toString(),taxablePaise:taxable.toString(),cgstPaise:cgst.toString(),sgstPaise:sgst.toString(),igstPaise:igst.toString(),totalPaise:(taxable+cgst+sgst+igst).toString()}];});
  const refund=refundDue(original,after)-refundDue(original,before);const accountPart=accountShare(original,after)-accountShare(original,before);const accountCredit=method==='CREDIT'?refund:accountPart<0n?0n:accountPart>refund?refund:accountPart;
  const cashPart=refund-accountCredit;const payment=(m:RefundMethod,amount:bigint)=>({method:m,amountPaise:amount.toString(),reference:null,tenderedPaise:null,changePaise:null,kind:'REFUND' as const});
  const payments=[...(cashPart>0n?[payment(method,cashPart)]:[]),...(accountCredit>0n?[payment('CREDIT',accountCredit)]:[])];
  const taxable=sum(lines.map(l=>BigInt(l.taxablePaise))),cgst=sum(lines.map(l=>BigInt(l.cgstPaise))),sgst=sum(lines.map(l=>BigInt(l.sgstPaise))),igst=sum(lines.map(l=>BigInt(l.igstPaise))),lineTotal=sum(lines.map(l=>BigInt(l.totalPaise)));
  const lineDiscount=sum(lines.map(l=>BigInt(l.lineDiscountPaise??'0'))),billDiscount=sum(lines.map(l=>BigInt(l.billDiscountSharePaise??'0')));
  const subtotal=sum(original.lines.map((line,i)=>requested[i]?share((line.stockUnit==='UNIT'?BigInt(line.unitPricePaise)*BigInt(line.quantity):halfUp(BigInt(line.unitPricePaise)*BigInt(line.quantity),1000n)).toString(),i):0n));
  return {returned:after,accountCredit,creditNote:{type:'RETURN',originalInvoiceId:original.id,originalInvoiceNumber:original.number,returnReason:reason.trim()||null,roundedToRupee:original.roundedToRupee,lines,subtotalPaise:subtotal.toString(),lineDiscountPaise:lineDiscount.toString(),billDiscountPaise:billDiscount.toString(),discountPaise:(lineDiscount+billDiscount).toString(),billDiscountReason:original.billDiscountReason??null,taxablePaise:taxable.toString(),cgstPaise:cgst.toString(),sgstPaise:sgst.toString(),igstPaise:igst.toString(),roundOffPaise:(refund-lineTotal).toString(),grandTotalPaise:refund.toString(),gstRegistered:original.gstRegistered,pricesIncludeTax:original.pricesIncludeTax,placeOfSupply:original.placeOfSupply??placeOfSupplyFor(original),interState:original.interState,seller:original.seller,customer:original.customer??null,buyer:original.buyer,payments}};
}
