import { calculateBill, validatePayments, type CartLine, type DiscountDraft, type InvoiceRecord, type PaymentDraft, type TaxSettings } from '../domain/billing';
import type { Product } from '../domain/catalog';
import { formatMoney } from '../domain/money';
import type { ShopStorage } from './shopService';

export interface SalesStorage { listProducts():Promise<Product[]>; listInvoices():Promise<InvoiceRecord[]>; saveSale(draft:Omit<InvoiceRecord,'id'|'number'|'createdAt'>,prefix:string,date:Date):Promise<InvoiceRecord> }
export class SalesService {
  constructor(private readonly storage:SalesStorage,private readonly shops:ShopStorage){}
  listProducts(){return this.storage.listProducts()}
  listInvoices(){return this.storage.listInvoices()}
  async checkout(lines:CartLine[],discount:DiscountDraft,payments:PaymentDraft[],interState:boolean){
    const shop=await this.shops.load();if(!shop)throw new Error('Save business settings before creating an invoice.');
    const gstRegistered=shop.gstRegistered??true;const stateCode=shop.stateCode??'';const invoicePrefix=shop.invoicePrefix??'INV';
    if(gstRegistered&&!/^\d{2}$/.test(stateCode))throw new Error('Set the store GST state code in Business settings before checkout.');
    if(gstRegistered&&!shop.gstin)throw new Error('Set the store GSTIN in Business settings before checkout.');
    const settings:TaxSettings={gstRegistered,pricesIncludeTax:shop.pricesIncludeTax??true,roundOff:shop.roundOff??true,stateCode,invoicePrefix,storeName:shop.storeName,address:shop.address,gstin:shop.gstin??''};
    const totals=calculateBill(lines,settings,discount,interState);if(totals.grandTotal<=0n)throw new Error('Invoice total must be greater than zero.');
    const paymentRecords=validatePayments(payments,totals.grandTotal);const date=new Date();
    return this.storage.saveSale({lines:totals.lines,subtotalPaise:totals.subtotal.toString(),discountPaise:totals.discount.toString(),taxablePaise:totals.taxable.toString(),cgstPaise:totals.cgst.toString(),sgstPaise:totals.sgst.toString(),igstPaise:totals.igst.toString(),roundOffPaise:totals.roundOff.toString(),grandTotalPaise:totals.grandTotal.toString(),gstRegistered,pricesIncludeTax:settings.pricesIncludeTax,interState,seller:{storeName:settings.storeName,address:settings.address,gstin:settings.gstin,stateCode},payments:paymentRecords},invoicePrefix,date);
  }
}
export { formatMoney };
