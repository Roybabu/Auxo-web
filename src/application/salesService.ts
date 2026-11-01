import { calculateBill, validateAccountPayment, validatePayments, type AccountPaymentDraft, type BillingCustomer, type CartLine, type CustomerLedgerEntry, type DiscountDraft, type InvoiceRecord, type PaymentDraft, type TaxSettings } from '../domain/billing';
import type { Product } from '../domain/catalog';
import { parseMoney } from '../domain/money';
import type { RefundMethod } from '../domain/returns';
import type { ShopStorage } from './shopService';

export interface SalesStorage { listProducts():Promise<Product[]>; listInvoices():Promise<InvoiceRecord[]>; listCustomers():Promise<BillingCustomer[]>; listCustomerLedger(customerId:string):Promise<CustomerLedgerEntry[]>; createCustomer(customer:BillingCustomer):Promise<void>; recordAccountPayment(customerId:string,payment:ReturnType<typeof validateAccountPayment>,date:Date):Promise<CustomerLedgerEntry>; saveSale(draft:Omit<InvoiceRecord,'id'|'number'|'createdAt'>,prefix:string,date:Date):Promise<InvoiceRecord>;saveReturn(invoiceId:string,quantities:number[],method:RefundMethod,reason:string,prefix:string,date:Date):Promise<InvoiceRecord> }
export class SalesService {
  constructor(private readonly storage:SalesStorage,private readonly shops:ShopStorage){}
  listProducts(){return this.storage.listProducts()}
  listInvoices(){return this.storage.listInvoices()}
  listCustomers(){return this.storage.listCustomers()}
  listCustomerLedger(customerId:string){return this.storage.listCustomerLedger(customerId)}
  async receiveAccountPayment(customerId:string,draft:AccountPaymentDraft){const customer=(await this.storage.listCustomers()).find(c=>c.id===customerId);if(!customer)throw new Error('Customer account no longer exists.');const payment=validateAccountPayment(draft,BigInt(customer.balancePaise));return this.storage.recordAccountPayment(customerId,payment,new Date());}
  async processReturn(invoiceId:string,quantities:number[],method:RefundMethod,reason:string){const shop=await this.shops.load();if(!shop)throw new Error('Business settings are required.');return this.storage.saveReturn(invoiceId,quantities,method,reason,'CN',new Date());}
  async createCustomer(nameText:string,phoneText:string,creditLimitText:string){
    const name=nameText.trim();if(name.length<1||name.length>80)throw new Error('Customer name is required and must be 80 characters or fewer.');
    const phone=phoneText.trim()?normalizeMobile(phoneText):null;if(phoneText.trim()&&!phone)throw new Error('Enter a valid Indian 10-digit mobile number.');
    const creditLimit=creditLimitText.trim()?parseMoney(creditLimitText):null;if(creditLimitText.trim()&&creditLimit===null)throw new Error('Enter a valid credit limit.');
    const customer:BillingCustomer={id:crypto.randomUUID(),name,phone,creditLimitPaise:creditLimit?.toString()??null,balancePaise:'0',onHold:false,createdAt:Date.now()};await this.storage.createCustomer(customer);return customer;
  }
  async checkout(lines:CartLine[],discount:DiscountDraft,payments:PaymentDraft[],interState:boolean,customerId:string|null){
    const shop=await this.shops.load();if(!shop)throw new Error('Save business settings before creating an invoice.');
    const gstRegistered=shop.gstRegistered??true;const stateCode=shop.stateCode??'';const invoicePrefix=shop.invoicePrefix??'INV';
    if(gstRegistered&&!/^\d{2}$/.test(stateCode))throw new Error('Set the store GST state code in Business settings before checkout.');
    if(gstRegistered&&!shop.gstin)throw new Error('Set the store GSTIN in Business settings before checkout.');
    const settings:TaxSettings={gstRegistered,pricesIncludeTax:shop.pricesIncludeTax??true,roundOff:shop.roundOff??true,stateCode,invoicePrefix,storeName:shop.storeName,address:shop.address,gstin:shop.gstin??''};
    const totals=calculateBill(lines,settings,discount,interState);if(totals.grandTotal<=0n)throw new Error('Invoice total must be greater than zero.');
    const customer=customerId?await this.storage.listCustomers().then(list=>list.find(c=>c.id===customerId)??null):null;
    if(customerId&&!customer)throw new Error('Selected customer account no longer exists.');
    const paymentRecords=validatePayments(payments,totals.grandTotal,customer);const date=new Date();
    return this.storage.saveSale({type:'SALE',roundedToRupee:settings.roundOff,lines:totals.lines,subtotalPaise:totals.subtotal.toString(),lineDiscountPaise:totals.lineDiscount.toString(),billDiscountPaise:totals.billDiscount.toString(),discountPaise:totals.discount.toString(),billDiscountReason:totals.billDiscount>0n?discount.reason.trim().replace(/\s+/g,' ').slice(0,60):null,taxablePaise:totals.taxable.toString(),cgstPaise:totals.cgst.toString(),sgstPaise:totals.sgst.toString(),igstPaise:totals.igst.toString(),roundOffPaise:totals.roundOff.toString(),grandTotalPaise:totals.grandTotal.toString(),gstRegistered,pricesIncludeTax:settings.pricesIncludeTax,interState,seller:{storeName:settings.storeName,address:settings.address,gstin:settings.gstin,stateCode},customer:customer?{id:customer.id,name:customer.name,phone:customer.phone}:null,payments:paymentRecords},invoicePrefix,date);
  }
}
function normalizeMobile(text:string){let digits=text.replace(/\D/g,'');if(text.trim().startsWith('+')&&digits.startsWith('91'))digits=digits.slice(2);if(digits.length===12&&digits.startsWith('91'))digits=digits.slice(2);if(digits.length===11&&digits.startsWith('0'))digits=digits.slice(1);return /^[6-9]\d{9}$/.test(digits)?digits:null;}
