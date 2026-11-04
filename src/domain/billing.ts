import { checkedMoney, formatMoney, parseMoney } from './money';
import {variantAttributesLabel,type Product,type ProductVariant} from './catalog';
import type {ReceiptLanguage,ReceiptPaper} from './shop';

export type DiscountDraft={kind:'AMOUNT'|'PERCENT';value:string;reason:string};
export type TaxSettings={gstRegistered:boolean;pricesIncludeTax:boolean;roundOff:boolean;stateCode:string;invoicePrefix:string;storeName:string;address:string;gstin:string};
export type CartLine={productId:string;variantId:string;name:string;variantLabel:string;barcode:string;hsnCode?:string|null;restaurantItem?:boolean;unavailable?:boolean;customItem?:boolean;quantity:number;unitPricePaise:string;mrpPaise:string|null;stockUnit:'UNIT'|'GRAM'|'MILLILITRE';availableStock:number;gstRateBasisPoints:number|null;apparelGst:boolean;lineDiscount:DiscountDraft|null};
export type PaymentDraft={method:'CASH'|'UPI'|'CARD'|'CREDIT';amount:string;reference:string;tendered:string};
export type InvoiceLineSnapshot={productId:string;variantId:string|null;name:string;variantLabel:string;barcode:string;hsnCode?:string|null;customItem?:boolean;quantity:number;unitPricePaise:string;mrpPaise:string|null;stockUnit:CartLine['stockUnit'];lineDiscountPaise:string;billDiscountSharePaise:string;discountPaise:string;discountReason:string|null;taxablePaise:string;gstRateBasisPoints:number;cgstPaise:string;sgstPaise:string;igstPaise:string;totalPaise:string;returnedQuantity?:number;originalLineIndex?:number};
export type InvoiceBuyer={name:string|null;phone:string|null;gstin:string|null;stateCode?:string|null};
export type InvoiceRecord={id:string;number:string;createdAt:number;placeOfSupply?:string;lines:InvoiceLineSnapshot[];subtotalPaise:string;lineDiscountPaise:string;billDiscountPaise:string;discountPaise:string;billDiscountReason:string|null;loyaltyPointsRedeemed?:number;loyaltyDiscountPaise?:string;taxablePaise:string;cgstPaise:string;sgstPaise:string;igstPaise:string;roundOffPaise:string;grandTotalPaise:string;gstRegistered:boolean;pricesIncludeTax:boolean;interState:boolean;seller:{storeName:string;address:string;gstin:string;stateCode:string;phone?:string;fssai?:string;upiId?:string;upiPayeeName?:string;storeLogoPhotoId?:string|null;receipt?:{paper:ReceiptPaper;footer:string;showHsn:boolean;showTaxBreakup:boolean;showCustomer:boolean;showSavings:boolean;showBarcode:boolean;showUpiQr:boolean;language:ReceiptLanguage}};customer:{id:string;name:string;phone:string|null;gstin?:string|null}|null;buyer?:InvoiceBuyer;payments:{method:PaymentDraft['method'];amountPaise:string;reference:string|null;tenderedPaise:string|null;changePaise:string|null;kind?:'PAYMENT'|'REFUND'}[];type?:'SALE'|'RETURN';originalInvoiceId?:string|null;originalInvoiceNumber?:string|null;returnReason?:string|null;roundedToRupee?:boolean};
export type BillingCustomer={id:string;name:string;phone:string|null;gstin?:string|null;email?:string|null;stateCode?:string|null;address?:string|null;notes?:string|null;creditLimitPaise:string|null;balancePaise:string;onHold:boolean;createdAt:number};
export type CustomerLedgerEntry={id:string;customerId:string;type:'OPENING_BALANCE'|'SALE'|'PAYMENT'|'RETURN'|'PROMISE';amountPaise:string;invoiceId:string|null;invoiceNumber:string|null;method:PaymentDraft['method']|null;reference:string|null;createdAt:number;note:string|null};
export type AccountPaymentDraft={amount:string;method:'CASH'|'UPI'|'CARD';reference:string;note:string};
export type CustomerDraft={name:string;phone:string;email:string;gstin:string;stateCode:string;address:string;notes:string;creditLimit:string;openingBalance:string;onHold:boolean};
export type BillTotals={subtotal:bigint;lineDiscount:bigint;billDiscount:bigint;loyaltyDiscount:bigint;discount:bigint;taxable:bigint;cgst:bigint;sgst:bigint;igst:bigint;beforeRound:bigint;roundOff:bigint;grandTotal:bigint;lines:InvoiceLineSnapshot[]};

const halfUp=(n:bigint,d:bigint)=>{if(n<0n||d<=0n)throw new RangeError('Invalid rounding input.');return (n+d/2n)/d;};
const sum=(values:bigint[])=>values.reduce((a,b)=>checkedMoney(a+b),0n);
function percentValue(base:bigint,text:string){if(!/^\d{1,3}(\.\d{1,2})?$/.test(text.trim()))throw new Error('Enter a discount percentage from 0 to 100.');const [whole,fraction='']=text.trim().split('.');const bp=BigInt(whole!)*100n+BigInt(fraction.padEnd(2,'0'));if(bp>10000n)throw new Error('Discount cannot exceed 100%.');return {amount:halfUp(base*bp,10000n),basisPoints:Number(bp)};}
export function parseDiscount(base:bigint,draft:DiscountDraft){const value=draft.value.trim();if(!value)return 0n;let amount:bigint;if(draft.kind==='PERCENT')amount=percentValue(base,value).amount;else {const parsed=parseMoney(value);if(parsed===null)throw new Error('Enter a valid discount amount.');amount=parsed;}if(amount===0n)return 0n;if(amount>base)throw new Error('Discount cannot exceed the bill subtotal.');if(!draft.reason.trim())throw new Error('Enter a reason for the discount.');if(draft.reason.trim().length>60)throw new Error('Discount reason must be 60 characters or fewer.');return amount;}
function lineGross(line:CartLine){const price=BigInt(line.unitPricePaise);return checkedMoney(line.stockUnit==='UNIT'?price*BigInt(line.quantity):halfUp(price*BigInt(line.quantity),1000n));}
function allocate(amount:bigint,weights:bigint[]){const total=sum(weights);if(!amount||!total)return weights.map(()=>0n);const floors=weights.map(w=>amount*w/total);let left=amount-sum(floors);const indices=weights.map((_,i)=>i).sort((a,b)=>{const ra=amount*weights[a]!%total,rb=amount*weights[b]!%total;return ra===rb?a-b:ra>rb?-1:1;});for(const i of indices){if(left<=0n)break;floors[i]!+=1n;left--;}return floors;}
export function calculateBill(lines:CartLine[],settings:TaxSettings,discountDraft:DiscountDraft,interState:boolean,loyaltyRequested=0n):BillTotals{
  if(!lines.length)throw new Error('Add at least one item to the bill.');
  for(const line of lines){if(!Number.isInteger(line.quantity)||line.quantity<=0)throw new Error('Item quantities must be greater than zero.');if(line.unavailable)throw new Error(`${line.name} is currently unavailable.`);if(line.quantity>line.availableStock)throw new Error(`${line.name} does not have enough stock.`);if(settings.gstRegistered&&line.gstRateBasisPoints===null&&!line.apparelGst)throw new Error(`${line.name} needs a GST rate before checkout.`);}
  const gross=lines.map(lineGross),subtotal=sum(gross),lineDiscounts=lines.map((line,index)=>line.lineDiscount?parseDiscount(gross[index]!,line.lineDiscount):0n),afterLineDiscount=gross.map((amount,index)=>amount-lineDiscounts[index]!),lineDiscount=sum(lineDiscounts),manualBillDiscount=parseDiscount(sum(afterLineDiscount),discountDraft),loyaltyRoom=sum(afterLineDiscount)-manualBillDiscount,loyaltyDiscount=loyaltyRequested<=0n?0n:loyaltyRequested>loyaltyRoom?loyaltyRoom:loyaltyRequested,billDiscount=manualBillDiscount+loyaltyDiscount,shares=allocate(billDiscount,afterLineDiscount),discount=lineDiscount+billDiscount;
  const snap=lines.map((line,i)=>{
    const net=afterLineDiscount[i]!-shares[i]!;let rate=settings.gstRegistered?(line.gstRateBasisPoints??0):0;
    if(settings.gstRegistered&&line.apparelGst){const tentative=settings.pricesIncludeTax?halfUp(net*10000n,10500n):net;rate=tentative<=250000n?500:1800;}
    const taxable=settings.pricesIncludeTax?halfUp(net*10000n,10000n+BigInt(rate)):net;
    const tax=settings.pricesIncludeTax?net-taxable:halfUp(net*BigInt(rate),10000n);
    const cgst=interState?0n:(tax+1n)/2n,sgst=interState?0n:tax-cgst,igst=interState?tax:0n;
    return {productId:line.productId,variantId:line.customItem?null:line.variantId,name:line.name,variantLabel:line.variantLabel,barcode:line.barcode,hsnCode:line.hsnCode??null,customItem:line.customItem??false,quantity:line.quantity,unitPricePaise:line.unitPricePaise,mrpPaise:line.mrpPaise,stockUnit:line.stockUnit,lineDiscountPaise:lineDiscounts[i]!.toString(),billDiscountSharePaise:shares[i]!.toString(),discountPaise:(lineDiscounts[i]!+shares[i]!).toString(),discountReason:lineDiscounts[i]!>0n?line.lineDiscount?.reason.trim().replace(/\s+/g,' ').slice(0,60)??null:null,taxablePaise:taxable.toString(),gstRateBasisPoints:rate,cgstPaise:cgst.toString(),sgstPaise:sgst.toString(),igstPaise:igst.toString(),totalPaise:checkedMoney(taxable+tax).toString()};
  });
  const taxable=sum(snap.map(x=>BigInt(x.taxablePaise))),cgst=sum(snap.map(x=>BigInt(x.cgstPaise))),sgst=sum(snap.map(x=>BigInt(x.sgstPaise))),igst=sum(snap.map(x=>BigInt(x.igstPaise))),beforeRound=sum(snap.map(x=>BigInt(x.totalPaise)));
  const rounded=settings.roundOff?halfUp(beforeRound,100n)*100n:beforeRound;
  return {subtotal,lineDiscount,billDiscount,loyaltyDiscount,discount,taxable,cgst,sgst,igst,beforeRound,roundOff:checkedMoney(rounded-beforeRound),grandTotal:checkedMoney(rounded),lines:snap};
}
export function validatePayments(drafts:PaymentDraft[],total:bigint,customer:BillingCustomer|null=null){
  if(!drafts.length)throw new Error('Enter at least one payment.');let paid=0n;
  let accountCharge=0n;const records=drafts.map(d=>{const amount=parseMoney(d.amount);if(amount===null||amount<=0n)throw new Error('Each payment must have a valid positive amount.');paid+=amount;const reference=d.reference.trim();if(d.method==='UPI'&&reference&&!/^[A-Za-z0-9]{4,35}$/.test(reference))throw new Error('UPI reference must be 4–35 letters or digits.');if(d.method==='CARD'&&reference&&!/^\d{4}$/.test(reference))throw new Error('For card payments, enter the last four digits.');const tendered=d.method==='CASH'&&d.tendered.trim()?parseMoney(d.tendered):null;if(d.method==='CASH'&&d.tendered.trim()&&(tendered===null||tendered<amount))throw new Error('Cash tendered must be at least the cash payment amount.');if(d.method==='CREDIT'){if(!customer)throw new Error('Choose a saved customer to put a payment on account.');if(customer.onHold)throw new Error('This customer account is on hold.');accountCharge+=amount;if(customer.creditLimitPaise!==null&&BigInt(customer.balancePaise)+accountCharge>BigInt(customer.creditLimitPaise))throw new Error('Credit payment would exceed this customer’s credit limit.');}return {method:d.method,amountPaise:amount.toString(),reference:reference||null,tenderedPaise:tendered?.toString()??null,changePaise:tendered&&tendered>amount?(tendered-amount).toString():null};});
  if(paid!==total)throw new Error(`Payments must equal the bill total of ${formatMoney(total)}.`);return records;
}
export function validateAccountPayment(draft:AccountPaymentDraft,balance:bigint){
  const amount=parseMoney(draft.amount);if(balance<=0n)throw new Error('This customer has no outstanding balance.');if(!draft.amount.trim())throw new Error('Enter a payment amount.');if(amount===null||amount<=0n)throw new Error('Enter a valid positive amount.');if(amount>balance)throw new Error('Payment cannot be more than the amount due.');
  const reference=draft.reference.trim();if(reference&&draft.method==='UPI'&&!/^[A-Za-z0-9]{4,35}$/.test(reference))throw new Error('UPI reference must be 4–35 letters or digits.');if(reference&&draft.method==='CARD'&&!/^\d{4}$/.test(reference))throw new Error('For card payments, enter the last four digits.');
  const note=draft.note.trim();if(note.length>120)throw new Error('Payment note must be 120 characters or fewer.');return {amountPaise:amount.toString(),method:draft.method,reference:reference&&draft.method!=='CASH'?reference:null,note:note||null};
}
export function creditAgeDays(entries:readonly CustomerLedgerEntry[],now=Date.now()):number|null{
  const charges:{createdAt:number;amount:bigint}[]=[];let credit=0n;
  for(const entry of [...entries].filter(e=>e.type!=='PROMISE').sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id))){const amount=BigInt(entry.amountPaise);if(amount>0n){const used=credit<amount?credit:amount;credit-=used;if(amount>used)charges.push({createdAt:entry.createdAt,amount:amount-used});}else if(amount<0n){let payment=-amount;while(payment>0n&&charges.length){const first=charges[0]!;if(first.amount<=payment){payment-=first.amount;charges.shift();}else{first.amount-=payment;payment=0n;}}credit+=payment;}}
  const oldest=charges[0]?.createdAt;if(oldest===undefined)return null;const today=new Date(now);today.setHours(0,0,0,0);const start=new Date(oldest);start.setHours(0,0,0,0);return Math.max(0,Math.floor((today.getTime()-start.getTime())/86_400_000));
}
export function cartLineFromProduct(product:Product,variant:ProductVariant):CartLine{return {productId:product.id,variantId:variant.id,name:product.name,variantLabel:variantAttributesLabel(variant,' / '),barcode:variant.barcode,hsnCode:product.hsnCode??null,restaurantItem:product.category==='RESTAURANT',unavailable:product.category==='RESTAURANT'&&product.available===false,quantity:product.stockUnit==='UNIT'?1:1000,unitPricePaise:variant.pricePaise,mrpPaise:variant.mrpPaise,stockUnit:product.stockUnit,availableStock:product.category==='RESTAURANT'&&product.available===false?0:product.tracksStock===false?Number.MAX_SAFE_INTEGER:variant.stock,gstRateBasisPoints:product.gstRateBasisPoints??null,apparelGst:product.apparelGst??false,lineDiscount:null};}

/** GST place of supply: the buyer's state for an inter-state sale with a known buyer state, otherwise the seller's state. */
export function placeOfSupplyFor(invoice:{interState:boolean;buyer?:{stateCode?:string|null}|null;seller:{stateCode:string}}):string{
  const buyerState=invoice.buyer?.stateCode??'';
  return invoice.interState&&buyerState?buyerState:invoice.seller.stateCode;
}

/** Account wording as in Android: "Owes ₹500.00", "Advance ₹200.00" or "Settled". Positive balance means the customer owes. */
export function accountBalanceLabel(balancePaise:string):{state:'OWES'|'ADVANCE'|'SETTLED';text:string}{
  const balance=BigInt(balancePaise);
  if(balance>0n)return {state:'OWES',text:`Owes ${formatMoney(balance)}`};
  if(balance<0n)return {state:'ADVANCE',text:`Advance ${formatMoney(-balance)}`};
  return {state:'SETTLED',text:'Settled'};
}

/** The earliest sale time among a customer's sales, or undefined when there are none. */
export function firstSaleAt(sales:readonly {createdAt:number}[]):number|undefined{
  return sales.reduce<number|undefined>((earliest,sale)=>earliest===undefined||sale.createdAt<earliest?sale.createdAt:earliest,undefined);
}
