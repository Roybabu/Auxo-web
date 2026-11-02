import {calculateBill,validateAccountPayment,validatePayments,type AccountPaymentDraft,type BillingCustomer,type CartLine,type CustomerDraft,type CustomerLedgerEntry,type DiscountDraft,type InvoiceRecord,type PaymentDraft,type TaxSettings} from '../domain/billing';
import type { Product } from '../domain/catalog';
import { parseMoney } from '../domain/money';
import type { RefundMethod } from '../domain/returns';
import type { ShopStorage } from './shopService';
import type { HeldBill, HeldBillDraft } from '../domain/heldBills';
import type {LoyaltyEntry,LoyaltyRules} from '../domain/loyalty';
import {DEFAULT_LOYALTY_RULES,maxRedeemable,pointValue} from '../domain/loyalty';
import {gstinStateCode,validateGstin} from '../domain/gstin';
import type {AuditFactory,AuditWrite} from '../domain/audit';
import {withJewelleryPrices} from '../domain/jewellery';

export interface SalesStorage { listProducts():Promise<Product[]>; listInvoices():Promise<InvoiceRecord[]>; listCustomers():Promise<BillingCustomer[]>; listCustomerLedger(customerId:string):Promise<CustomerLedgerEntry[]>; getLoyaltyRules():Promise<LoyaltyRules>;getLoyaltyPointsBalance(customerId:string):Promise<number>;listCustomerLoyaltyLedger(customerId:string):Promise<LoyaltyEntry[]>; listHeldBills():Promise<HeldBill[]>; holdBill(draft:HeldBillDraft,replacingId?:string):Promise<HeldBill>;splitHeldBill(moved:HeldBillDraft,remaining:HeldBillDraft,replacingId?:string):Promise<HeldBill>;deleteHeldBill(id:string):Promise<void>;createCustomer(customer:BillingCustomer,audit?:AuditWrite,openingBalancePaise?:string):Promise<void>;updateCustomer(customer:BillingCustomer,audit?:AuditWrite):Promise<void>;setCustomerPromise(customerId:string,date:string|null,audit?:AuditWrite):Promise<void>;recordAccountPayment(customerId:string,payment:ReturnType<typeof validateAccountPayment>,date:Date,audit?:AuditWrite):Promise<CustomerLedgerEntry>; saveSale(draft:Omit<InvoiceRecord,'id'|'number'|'createdAt'>,prefix:string,date:Date,heldBillId?:string,audit?:AuditFactory<InvoiceRecord>):Promise<InvoiceRecord>;saveReturn(invoiceId:string,quantities:number[],method:RefundMethod,reason:string,prefix:string,date:Date,audit?:AuditFactory<InvoiceRecord>):Promise<InvoiceRecord> }
export class SalesService {
  constructor(private readonly storage:SalesStorage,private readonly shops:ShopStorage){}
  async listProducts(){const [products,shop]=await Promise.all([this.storage.listProducts(),this.shops.load()]);return withJewelleryPrices(products,shop);}
  listInvoices(){return this.storage.listInvoices()}
  listCustomers(){return this.storage.listCustomers()}
  listCustomerLedger(customerId:string){return this.storage.listCustomerLedger(customerId)}
  loyaltyRules(){return this.storage.getLoyaltyRules()}
  loyaltyPointsBalance(customerId:string){return this.storage.getLoyaltyPointsBalance(customerId)}
  listCustomerLoyaltyLedger(customerId:string){return this.storage.listCustomerLoyaltyLedger(customerId)}
  listHeldBills(){return this.storage.listHeldBills()}
  holdBill(draft:HeldBillDraft,replacingId?:string){return this.storage.holdBill({...draft,label:draft.label.replace(/\s+/g,' ').trim().slice(0,40)},replacingId)}
  splitHeldBill(moved:HeldBillDraft,remaining:HeldBillDraft,replacingId?:string){return this.storage.splitHeldBill({...moved,label:moved.label.replace(/\s+/g,' ').trim().slice(0,40)},remaining,replacingId)}
  deleteHeldBill(id:string){return this.storage.deleteHeldBill(id)}
  async preview(lines:CartLine[],discount:DiscountDraft,interState:boolean){const shop=await this.shops.load();if(!shop)throw new Error('Save business settings before creating a bill.');const stateCode=shop.stateCode??'';const settings:TaxSettings={gstRegistered:shop.gstRegistered??true,pricesIncludeTax:shop.pricesIncludeTax??true,roundOff:shop.roundOff??true,stateCode,invoicePrefix:shop.invoicePrefix??'INV',storeName:shop.storeName,address:shop.address,gstin:shop.gstin??''};return calculateBill(lines,settings,discount,interState);}
  async receiveAccountPayment(customerId:string,draft:AccountPaymentDraft){const customer=(await this.storage.listCustomers()).find(c=>c.id===customerId);if(!customer)throw new Error('Customer account no longer exists.');const payment=validateAccountPayment(draft,BigInt(customer.balancePaise));return this.storage.recordAccountPayment(customerId,payment,new Date());}
  async processReturn(invoiceId:string,quantities:number[],method:RefundMethod,reason:string){const shop=await this.shops.load();if(!shop)throw new Error('Business settings are required.');return this.storage.saveReturn(invoiceId,quantities,method,reason,shop.creditNotePrefix??'CN',new Date());}
  async createCustomer(nameText:string,phoneText:string,creditLimitText:string,gstinText=''){
    const name=nameText.trim();if(name.length<1||name.length>80)throw new Error('Customer name is required and must be 80 characters or fewer.');
    const phone=phoneText.trim()?normalizeMobile(phoneText):null;if(phoneText.trim()&&!phone)throw new Error('Enter a valid Indian 10-digit mobile number.');
    const creditLimit=creditLimitText.trim()?parseMoney(creditLimitText):null;if(creditLimitText.trim()&&creditLimit===null)throw new Error('Enter a valid credit limit.');
    const gstin=validateGstin(gstinText);const customer:BillingCustomer={id:crypto.randomUUID(),name,phone,gstin,creditLimitPaise:creditLimit?.toString()??null,balancePaise:'0',onHold:false,createdAt:Date.now()};await this.storage.createCustomer(customer);return customer;
  }
  async saveCustomer(draft:CustomerDraft,id?:string){
    const name=draft.name.trim().replace(/\s+/g,' ');if(!name||name.length>80)throw new Error('Customer name is required and must be 80 characters or fewer.');
    const phone=draft.phone.trim()?normalizeMobile(draft.phone):null;if(draft.phone.trim()&&!phone)throw new Error('Enter a valid Indian 10-digit mobile number.');
    const email=draft.email.trim().toLowerCase();if(email&&(email.length>110||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new Error('Enter a valid email address (110 characters maximum).');
    const gstin=validateGstin(draft.gstin),stateCode=draft.stateCode.trim();if(stateCode&&!/^\d{2}$/.test(stateCode))throw new Error('Customer state code must be two digits.');if(gstin&&stateCode&&gstin.slice(0,2)!==stateCode)throw new Error('Customer GSTIN must match the customer state code.');
    if(draft.address.trim().length>220)throw new Error('Address must be 220 characters or fewer.');if(draft.notes.trim().length>320)throw new Error('Notes must be 320 characters or fewer.');
    const creditLimit=draft.creditLimit.trim()?parseMoney(draft.creditLimit):null;if(draft.creditLimit.trim()&&(creditLimit===null||creditLimit<0n))throw new Error('Enter a valid non-negative credit limit.');
    const existing=id?(await this.storage.listCustomers()).find(c=>c.id===id):undefined;if(id&&!existing)throw new Error('Customer no longer exists. Refresh the list.');
    const opening=draft.openingBalance.trim()?parseMoney(draft.openingBalance):0n;if((!id&&opening===null)||(opening!==null&&opening<0n))throw new Error('Opening balance must be a valid non-negative amount.');
    const customer:BillingCustomer={id:existing?.id??crypto.randomUUID(),name,phone,gstin,email:email||null,stateCode:stateCode||null,address:draft.address.trim()||null,notes:draft.notes.trim()||null,creditLimitPaise:creditLimit?.toString()??null,balancePaise:existing?.balancePaise??(opening??0n).toString(),onHold:draft.onHold,createdAt:existing?.createdAt??Date.now()};
    if(existing)await this.storage.updateCustomer(customer);else await this.storage.createCustomer(customer,undefined,(opening??0n).toString());return customer;
  }
  setCustomerPromise(customerId:string,date:string|null){return this.storage.setCustomerPromise(customerId,date);}
  async checkout(lines:CartLine[],discount:DiscountDraft,payments:PaymentDraft[],interState:boolean,customerId:string|null,heldBillId?:string,loyaltyPoints=0,buyerInput?:{name?:string|null;phone?:string|null;gstin?:string|null}){
    const shop=await this.shops.load();if(!shop)throw new Error('Save business settings before creating an invoice.');
    const currentProducts=withJewelleryPrices(await this.storage.listProducts(),shop),currentVariants=new Map(currentProducts.flatMap(p=>p.variants.map(v=>[v.id,v] as const))),currentLines=lines.map(line=>{const variant=currentVariants.get(line.variantId);return variant?{...line,unitPricePaise:variant.pricePaise,mrpPaise:variant.mrpPaise}:line;});
    const gstRegistered=shop.gstRegistered??true;const stateCode=shop.stateCode??'';const invoicePrefix=shop.invoicePrefix??'INV';
    if(gstRegistered&&!/^\d{2}$/.test(stateCode))throw new Error('Set the store GST state code in Business settings before checkout.');
    if(gstRegistered&&!shop.gstin)throw new Error('Set the store GSTIN in Business settings before checkout.');
    const settings:TaxSettings={gstRegistered,pricesIncludeTax:shop.pricesIncludeTax??true,roundOff:shop.roundOff??true,stateCode,invoicePrefix,storeName:shop.storeName,address:shop.address,gstin:shop.gstin??''};
    if(!Number.isSafeInteger(loyaltyPoints)||loyaltyPoints<0)throw new Error('Enter a valid whole number of loyalty points.');
    const before=calculateBill(currentLines,settings,discount,interState);let redeemed=0n;
    if(loyaltyPoints>0){if(!customerId)throw new Error('Choose a saved customer to redeem loyalty points.');const rules=await this.storage.getLoyaltyRules(),balance=await this.storage.getLoyaltyPointsBalance(customerId),max=maxRedeemable(rules,balance,before.subtotal-before.lineDiscount-before.billDiscount);if(loyaltyPoints>max)throw new Error(`This customer can use up to ${max} points on this bill.`);redeemed=pointValue(rules,loyaltyPoints);}
    const totals=calculateBill(currentLines,settings,discount,interState,redeemed);if(totals.grandTotal<=0n)throw new Error('Invoice total must be greater than zero.');
    const customer=customerId?await this.storage.listCustomers().then(list=>list.find(c=>c.id===customerId)??null):null;
    if(customerId&&!customer)throw new Error('Selected customer account no longer exists.');
    const buyerGstin=validateGstin(buyerInput?buyerInput.gstin??'':customer?.gstin??'');
    const buyer={name:buyerInput?buyerInput.name?.trim()||null:customer?.name??null,phone:buyerInput?buyerInput.phone?.trim()||null:customer?.phone??null,gstin:buyerGstin,stateCode:gstinStateCode(buyerGstin)};
    const paymentRecords=validatePayments(payments,totals.grandTotal,customer);const date=new Date();
    return this.storage.saveSale({type:'SALE',roundedToRupee:settings.roundOff,lines:totals.lines,subtotalPaise:totals.subtotal.toString(),lineDiscountPaise:totals.lineDiscount.toString(),billDiscountPaise:totals.billDiscount.toString(),discountPaise:totals.discount.toString(),billDiscountReason:totals.billDiscount-totals.loyaltyDiscount>0n?discount.reason.trim().replace(/\s+/g,' ').slice(0,60):null,loyaltyPointsRedeemed:loyaltyPoints,loyaltyDiscountPaise:totals.loyaltyDiscount.toString(),taxablePaise:totals.taxable.toString(),cgstPaise:totals.cgst.toString(),sgstPaise:totals.sgst.toString(),igstPaise:totals.igst.toString(),roundOffPaise:totals.roundOff.toString(),grandTotalPaise:totals.grandTotal.toString(),gstRegistered,pricesIncludeTax:settings.pricesIncludeTax,interState,seller:{storeName:settings.storeName,address:settings.address,gstin:settings.gstin,stateCode,phone:shop.phone??'',fssai:shop.fssai??'',upiId:shop.upiId??'',upiPayeeName:shop.upiPayeeName??'',receipt:{paper:shop.receiptPaper??'THERMAL_80',footer:shop.receiptFooter??'Thank you for shopping with us!',showHsn:shop.receiptShowHsn??true,showTaxBreakup:shop.receiptShowTaxBreakup??true,showCustomer:shop.receiptShowCustomer??true,showSavings:shop.receiptShowSavings??true,showBarcode:shop.receiptShowBarcode??true,showUpiQr:shop.receiptShowUpiQr??true,language:shop.receiptLanguage??'en'}},customer:customer?{id:customer.id,name:customer.name,phone:customer.phone,gstin:customer.gstin??null}:null,buyer,payments:paymentRecords},invoicePrefix,date,heldBillId);
  }
}
function normalizeMobile(text:string){let digits=text.replace(/\D/g,'');if(text.trim().startsWith('+')&&digits.startsWith('91'))digits=digits.slice(2);if(digits.length===12&&digits.startsWith('91'))digits=digits.slice(2);if(digits.length===11&&digits.startsWith('0'))digits=digits.slice(1);return /^[6-9]\d{9}$/.test(digits)?digits:null;}
