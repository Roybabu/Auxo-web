import type { ShopStorage } from '../application/shopService';
import type { CatalogStorage } from '../application/catalogService';
import type { SalesStorage } from '../application/salesService';
import type { AuthService } from '../application/authService';
import type { ShopIdentity } from '../domain/shop';
import type { Product, StockMovement, MovementReason } from '../domain/catalog';
import type { BillingCustomer, CustomerLedgerEntry, InvoiceRecord } from '../domain/billing';
import { discountExceeds } from '../domain/access';
import type { RefundMethod } from '../domain/returns';
import type { HeldBillDraft } from '../domain/heldBills';
import type { Supplier, PurchaseOrder, PurchaseReceipt, PurchaseStatus } from '../domain/purchasing';
import type { PurchasingStorage } from '../application/purchasingService';
import { LocalDatabase } from './localDatabase';
import type {LoyaltyRules} from '../domain/loyalty';
import type {StockBatch} from '../domain/batches';
import type {AuditAction,AuditEntity} from '../domain/audit';
import {formatMoney} from '../domain/money';

/** The UI and business services receive this boundary, never the raw browser store. */
export class AuthorizedStorage implements ShopStorage,CatalogStorage,SalesStorage,PurchasingStorage {
  constructor(private readonly raw:LocalDatabase,private readonly auth:AuthService){}
  private async log(action:AuditAction,entityType:AuditEntity,entityId:string|null,summary:string){const user=this.auth.getSnapshot();await this.raw.recordAudit(user?{id:user.id,name:user.name,role:user.role}:null,action,entityType,entityId,summary);}
  async load(){await this.auth.require('SELL');return this.raw.load();}
  async save(shop:ShopIdentity){await this.auth.require('MANAGE_SETTINGS');const before=await this.raw.load();await this.raw.save(shop);const changed:string[]=[];if(before?.storeName!==shop.storeName)changed.push('business name');if(before?.address!==shop.address)changed.push('address');if(before?.gstin!==shop.gstin)changed.push('store GSTIN');if(before?.stateCode!==shop.stateCode)changed.push('GST state');if(before?.gstRegistered!==shop.gstRegistered)changed.push('GST registration');if(before?.pricesIncludeTax!==shop.pricesIncludeTax)changed.push('tax-inclusive pricing');if(before?.roundOff!==shop.roundOff)changed.push('round-off setting');if(before?.employeeDiscountLimitBp!==shop.employeeDiscountLimitBp)changed.push('employee discount limit');if(before?.tableCount!==shop.tableCount)changed.push('restaurant table count');if(before?.onTimeBonusPoints!==shop.onTimeBonusPoints)changed.push('on-time bonus');await this.log('SETTINGS_SAVED','settings',null,`Saved business settings for ${shop.storeName}${changed.length?`: updated ${changed.join(', ')}`:''}`);}
  async listProducts(){await this.auth.require('SELL');return this.raw.listProducts();}
  async listMovements(){await this.auth.require('VIEW_STOCK_RECORDS');return this.raw.listMovements();}
  async listStockBatches(){await this.auth.require('VIEW_STOCK_RECORDS');return this.raw.listStockBatches();}
  async saveProduct(product:Product,movements:StockMovement[]){await this.auth.require('MANAGE_PRODUCTS');await this.raw.saveProduct(product,movements);await this.log('PRODUCT_SAVED','product',product.id,`Saved product ${product.name}`);}
  async adjustStock(variantId:string,change:number,reason:MovementReason,note:string|null,batch?:Pick<StockBatch,'batchNumber'|'expiryDate'>,batchId?:string|null){await this.auth.require('ADJUST_STOCK');await this.raw.adjustStock(variantId,change,reason,note,batch,batchId);const writtenOff=change<0&&['DAMAGED','EXPIRED','SPOILED'].includes(reason),action=writtenOff?'STOCK_WRITTEN_OFF':'STOCK_CHANGED',summary=writtenOff?`Wrote off ${Math.abs(change)} (${reason.toLowerCase()})`:`Stock ${change>=0?'+':''}${change} (${reason.toLowerCase()})${note?.trim()?`: ${note.trim()}`:''}`;await this.log(action,'variant',variantId,summary);}
  async updateTax(productId:string,rate:number|null,apparel:boolean){await this.auth.require('MANAGE_PRODUCTS');await this.raw.updateTax(productId,rate,apparel);await this.log('PRODUCT_SAVED','product',productId,`Updated GST rate${rate===null?'':' to '+(rate/100)+'%'}`);}
  async updateHsn(productId:string,hsn:string|null){await this.auth.require('MANAGE_PRODUCTS');await this.raw.updateHsn(productId,hsn);await this.log('PRODUCT_SAVED','product',productId,`Updated HSN${hsn?` to ${hsn}`:''}`);}
  async listInvoices(){await this.auth.require('VIEW_INVOICES');return this.raw.listInvoices();}
  async listHeldBills(){await this.auth.require('SELL');return this.raw.listHeldBills();}
  async holdBill(draft:HeldBillDraft,replacingId?:string){await this.auth.require('SELL');return this.raw.holdBill(draft,replacingId);}
  async splitHeldBill(moved:HeldBillDraft,remaining:HeldBillDraft,replacingId?:string){await this.auth.require('SELL');return this.raw.splitHeldBill(moved,remaining,replacingId);}
  async deleteHeldBill(id:string){await this.auth.require('SELL');return this.raw.deleteHeldBill(id);}
  async listCustomers(){await this.auth.require('SELL');return this.raw.listCustomers();}
  async listCustomerLedger(customerId:string){await this.auth.require('MANAGE_CUSTOMERS');return this.raw.listCustomerLedger(customerId);}
  async getLoyaltyRules():Promise<LoyaltyRules>{await this.auth.require('SELL');return this.raw.getLoyaltyRules();}
  async saveLoyaltyRules(rules:LoyaltyRules){await this.auth.require('MANAGE_LOYALTY');await this.raw.saveLoyaltyRules(rules);await this.log('LOYALTY_CHANGED','loyalty',null,rules.enabled?`Loyalty points on: 1 point per ${formatMoney(BigInt(rules.spendPerPointPaise))} spent, each point worth ${formatMoney(BigInt(rules.pointValuePaise))}`:'Loyalty points off');}
  async getLoyaltyPointsBalance(customerId:string){await this.auth.require('SELL');return this.raw.getLoyaltyPointsBalance(customerId);}
  async listCustomerLoyaltyLedger(customerId:string){await this.auth.require('MANAGE_CUSTOMERS');return this.raw.listCustomerLoyaltyLedger(customerId);}
  async createCustomer(customer:BillingCustomer){await this.auth.require('SELL');await this.raw.createCustomer(customer);await this.log('CUSTOMER_SAVED','customer',customer.id,`Created customer ${customer.name}`);}
  async recordAccountPayment(customerId:string,payment:{amountPaise:string;method:'CASH'|'UPI'|'CARD';reference:string|null;note:string|null},date:Date):Promise<CustomerLedgerEntry>{await this.auth.require('RECEIVE_ACCOUNT_PAYMENT');const entry=await this.raw.recordAccountPayment(customerId,payment,date);await this.log('ACCOUNT_PAYMENT_RECEIVED','customer',customerId,`Received account payment ${formatMoney(BigInt(payment.amountPaise))} by ${payment.method}`);return entry;}
  async saveSale(draft:Omit<InvoiceRecord,'id'|'number'|'createdAt'>,prefix:string,date:Date,heldBillId?:string):Promise<InvoiceRecord>{
    await this.auth.require('SELL');if(!this.auth.can('UNLIMITED_DISCOUNT')){
      const shop=await this.raw.load();const limit=shop?.employeeDiscountLimitBp??0;
      const lineDiscounts=draft.lines.map(l=>({gross:l.stockUnit==='UNIT'?BigInt(l.unitPricePaise)*BigInt(l.quantity):(BigInt(l.unitPricePaise)*BigInt(l.quantity)+500n)/1000n,discount:BigInt(l.lineDiscountPaise)}));
      if(discountExceeds(BigInt(draft.subtotalPaise),BigInt(draft.discountPaise)-BigInt(draft.loyaltyDiscountPaise??'0'),lineDiscounts,limit))throw new Error('Employee discount exceeds the permitted limit.');
    }const invoice=await this.raw.saveSale(draft,prefix,date,heldBillId);await this.log('SALE_RECORDED','invoice',invoice.id,`Sale ${invoice.number}, total ${formatMoney(BigInt(invoice.grandTotalPaise))}`);return invoice;
  }
  async listProductsForPurchasing(){await this.auth.require('MANAGE_PURCHASES');return this.raw.listProducts();}
  async listSuppliers(){await this.auth.require('MANAGE_SUPPLIERS');return this.raw.listSuppliers();}
  async saveSupplier(supplier:Supplier){await this.auth.require('MANAGE_SUPPLIERS');await this.raw.saveSupplier(supplier);await this.log('SUPPLIER_SAVED','supplier',supplier.id,`Saved supplier ${supplier.name}`);}
  async listPurchaseOrders(){await this.auth.require('MANAGE_PURCHASES');return this.raw.listPurchaseOrders();}
  async savePurchaseOrder(order:Omit<PurchaseOrder,'id'|'number'|'createdAt'>,id?:string){await this.auth.require('MANAGE_PURCHASES');const saved=await this.raw.savePurchaseOrder(order,id);await this.log('ORDER_SAVED','purchase_order',saved.id,`Saved ${saved.number} for ${saved.supplierName}`);return saved;}
  async updatePurchaseStatus(id:string,status:PurchaseStatus){await this.auth.require('MANAGE_PURCHASES');const changed=await this.raw.updatePurchaseStatus(id,status);if(changed)await this.log('ORDER_STATUS_CHANGED','purchase_order',id,`Purchase order marked ${status.toLowerCase()}`);return changed;}
  async listPurchaseReceipts(){await this.auth.require('MANAGE_PURCHASES');return this.raw.listPurchaseReceipts();}
  async receivePurchase(receipt:Omit<PurchaseReceipt,'id'|'number'|'receivedAt'>,date?:number){await this.auth.require('RECEIVE_GOODS');const saved=await this.raw.receivePurchase(receipt,date);await this.log('GOODS_RECEIVED','purchase_receipt',saved.id,`Received goods ${saved.number}`);return saved;}
  async saveReturn(invoiceId:string,quantities:number[],method:RefundMethod,reason:string,prefix:string,date:Date){await this.auth.require('PROCESS_RETURN');const credit=await this.raw.saveReturn(invoiceId,quantities,method,reason,prefix,date);await this.log('RETURN_RECORDED','invoice',credit.id,`Credit note ${credit.number}, total ${formatMoney(BigInt(credit.grandTotalPaise))}`);return credit;}
}
