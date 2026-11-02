import type { ShopStorage } from '../application/shopService';
import type { CatalogStorage, DeleteProductResult } from '../application/catalogService';
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
import {formatMoney} from '../domain/money';

/** The UI and business services receive this boundary, never the raw browser store. */
export class AuthorizedStorage implements ShopStorage,CatalogStorage,SalesStorage,PurchasingStorage {
  constructor(private readonly raw:LocalDatabase,private readonly auth:AuthService){}
  async load(){await this.auth.require('SELL');return this.raw.load();}
  async save(shop:ShopIdentity){await this.auth.require('MANAGE_SETTINGS');const before=await this.raw.load();const changed:string[]=[];if(before?.storeName!==shop.storeName)changed.push('business name');if(before?.address!==shop.address)changed.push('address');if(before?.gstin!==shop.gstin)changed.push('store GSTIN');if(before?.stateCode!==shop.stateCode)changed.push('GST state');if(before?.gstRegistered!==shop.gstRegistered)changed.push('GST registration');if(before?.pricesIncludeTax!==shop.pricesIncludeTax)changed.push('tax-inclusive pricing');if(before?.roundOff!==shop.roundOff)changed.push('round-off setting');if(before?.employeeDiscountLimitBp!==shop.employeeDiscountLimitBp)changed.push('employee discount limit');if(before?.tableCount!==shop.tableCount)changed.push('restaurant table count');if(before?.onTimeBonusPoints!==shop.onTimeBonusPoints)changed.push('on-time bonus');if(before?.creditHoldDays!==shop.creditHoldDays)changed.push('credit hold period');if(JSON.stringify(before?.metalRatesPaise??{})!==JSON.stringify(shop.metalRatesPaise??{}))changed.push('jewellery metal rates');const user=this.auth.getSnapshot();await this.raw.save(shop,{actor:user,action:'SETTINGS_SAVED',entityType:'settings',entityId:null,summary:`Saved business settings for ${shop.storeName}${changed.length?`: updated ${changed.join(', ')}`:''}`});}
  async listProducts(){await this.auth.require('SELL');return this.raw.listProducts();}
  async listCategories(){await this.auth.require('SELL');return this.raw.listCategories();}
  async listMovements(){await this.auth.require('VIEW_STOCK_RECORDS');return this.raw.listMovements();}
  async listStockBatches(){await this.auth.require('VIEW_STOCK_RECORDS');return this.raw.listStockBatches();}
  async saveProduct(product:Product,movements:StockMovement[]){await this.auth.require('MANAGE_PRODUCTS');const user=this.auth.getSnapshot();await this.raw.saveProduct(product,movements,{actor:user,action:'PRODUCT_SAVED',entityType:'product',entityId:product.id,summary:`Saved product ${product.name}`});}
  async updateProduct(product:Product,movements:StockMovement[]){await this.auth.require('MANAGE_PRODUCTS');const user=this.auth.getSnapshot();await this.raw.updateProduct(product,movements,{actor:user,action:'PRODUCT_SAVED',entityType:'product',entityId:product.id,summary:`Updated product ${product.name}`});}
  async deleteProduct(productId:string):Promise<DeleteProductResult>{await this.auth.require('MANAGE_PRODUCTS');const user=this.auth.getSnapshot();return this.raw.deleteProduct(productId,user?{id:user.id,name:user.name,role:user.role}:null);}
  async adjustStock(variantId:string,change:number,reason:MovementReason,note:string|null,batch?:Pick<StockBatch,'batchNumber'|'expiryDate'>,batchId?:string|null){await this.auth.require('ADJUST_STOCK');const writtenOff=change<0&&['DAMAGED','EXPIRED','SPOILED'].includes(reason),user=this.auth.getSnapshot();await this.raw.adjustStock(variantId,change,reason,note,batch,batchId,targets=>writtenOff&&targets?.length?targets.map(target=>({actor:user,action:'STOCK_WRITTEN_OFF',entityType:'batch',entityId:target.batchId,summary:`Wrote off ${target.quantity} (${reason.toLowerCase()})`})):[{actor:user,action:writtenOff?'STOCK_WRITTEN_OFF':'STOCK_CHANGED',entityType:'variant',entityId:variantId,summary:writtenOff?`Wrote off ${Math.abs(change)} (${reason.toLowerCase()})`:`Stock ${change>=0?'+':''}${change} (${reason.toLowerCase()})${note?.trim()?`: ${note.trim()}`:''}`}]);}
  async updateTax(productId:string,rate:number|null,apparel:boolean){await this.auth.require('MANAGE_PRODUCTS');const user=this.auth.getSnapshot();await this.raw.updateTax(productId,rate,apparel,{actor:user,action:'PRODUCT_SAVED',entityType:'product',entityId:productId,summary:`Updated GST rate${rate===null?'':' to '+(rate/100)+'%'}`});}
  async updateHsn(productId:string,hsn:string|null){await this.auth.require('MANAGE_PRODUCTS');const user=this.auth.getSnapshot();await this.raw.updateHsn(productId,hsn,{actor:user,action:'PRODUCT_SAVED',entityType:'product',entityId:productId,summary:`Updated HSN${hsn?` to ${hsn}`:''}`});}
  async listInvoices(){await this.auth.require('VIEW_INVOICES');return this.raw.listInvoices();}
  async listHeldBills(){await this.auth.require('SELL');return this.raw.listHeldBills();}
  async holdBill(draft:HeldBillDraft,replacingId?:string){await this.auth.require('SELL');return this.raw.holdBill(draft,replacingId);}
  async splitHeldBill(moved:HeldBillDraft,remaining:HeldBillDraft,replacingId?:string){await this.auth.require('SELL');return this.raw.splitHeldBill(moved,remaining,replacingId);}
  async deleteHeldBill(id:string){await this.auth.require('SELL');return this.raw.deleteHeldBill(id);}
  async listCustomers(){await this.auth.require('SELL');return this.raw.listCustomers();}
  async listCustomerLedger(customerId:string){await this.auth.require('MANAGE_CUSTOMERS');return this.raw.listCustomerLedger(customerId);}
  async getLoyaltyRules():Promise<LoyaltyRules>{await this.auth.require('SELL');return this.raw.getLoyaltyRules();}
  async saveLoyaltyRules(rules:LoyaltyRules){await this.auth.require('MANAGE_LOYALTY');const user=this.auth.getSnapshot();await this.raw.saveLoyaltyRules(rules,{actor:user,action:'LOYALTY_CHANGED',entityType:'loyalty',entityId:null,summary:rules.enabled?`Loyalty points on: 1 point per ${formatMoney(BigInt(rules.spendPerPointPaise))} spent, each point worth ${formatMoney(BigInt(rules.pointValuePaise))}`:'Loyalty points off'});}
  async getLoyaltyPointsBalance(customerId:string){await this.auth.require('SELL');return this.raw.getLoyaltyPointsBalance(customerId);}
  async listCustomerLoyaltyLedger(customerId:string){await this.auth.require('MANAGE_CUSTOMERS');return this.raw.listCustomerLoyaltyLedger(customerId);}
  async createCustomer(customer:BillingCustomer,_audit?:import('../domain/audit').AuditWrite,openingBalancePaise='0'){await this.auth.require('SELL');const user=this.auth.getSnapshot();await this.raw.createCustomer(customer,{actor:user,action:'CUSTOMER_SAVED',entityType:'customer',entityId:customer.id,summary:`Created customer ${customer.name}`},openingBalancePaise);}
  async updateCustomer(customer:BillingCustomer){await this.auth.require('MANAGE_CUSTOMERS');const user=this.auth.getSnapshot();await this.raw.updateCustomer(customer,{actor:user,action:'CUSTOMER_SAVED',entityType:'customer',entityId:customer.id,summary:`Updated customer ${customer.name}${customer.onHold?' and placed the account on hold':''}`});}
  async setCustomerPromise(customerId:string,date:string|null){await this.auth.require('MANAGE_CUSTOMERS');const user=this.auth.getSnapshot();await this.raw.setCustomerPromise(customerId,date,{actor:user,action:'CUSTOMER_SAVED',entityType:'customer',entityId:customerId,summary:date?`Recorded promised payment date ${date}`:'Cleared promised payment date'});}
  async recordAccountPayment(customerId:string,payment:{amountPaise:string;method:'CASH'|'UPI'|'CARD';reference:string|null;note:string|null},date:Date):Promise<CustomerLedgerEntry>{await this.auth.require('RECEIVE_ACCOUNT_PAYMENT');const user=this.auth.getSnapshot();return this.raw.recordAccountPayment(customerId,payment,date,{actor:user,action:'ACCOUNT_PAYMENT_RECEIVED',entityType:'customer',entityId:customerId,summary:`Received account payment ${formatMoney(BigInt(payment.amountPaise))} by ${payment.method}`});}
  async saveSale(draft:Omit<InvoiceRecord,'id'|'number'|'createdAt'>,prefix:string,date:Date,heldBillId?:string):Promise<InvoiceRecord>{
    await this.auth.require('SELL');if(!this.auth.can('UNLIMITED_DISCOUNT')){
      const shop=await this.raw.load();const limit=shop?.employeeDiscountLimitBp??0;
      const lineDiscounts=draft.lines.map(l=>({gross:l.stockUnit==='UNIT'?BigInt(l.unitPricePaise)*BigInt(l.quantity):(BigInt(l.unitPricePaise)*BigInt(l.quantity)+500n)/1000n,discount:BigInt(l.lineDiscountPaise)}));
      if(discountExceeds(BigInt(draft.subtotalPaise),BigInt(draft.discountPaise)-BigInt(draft.loyaltyDiscountPaise??'0'),lineDiscounts,limit))throw new Error('Employee discount exceeds the permitted limit.');
    }const user=this.auth.getSnapshot();return this.raw.saveSale(draft,prefix,date,heldBillId,invoice=>({actor:user,action:'SALE_RECORDED',entityType:'invoice',entityId:invoice.id,summary:`Sale ${invoice.number}, total ${formatMoney(BigInt(invoice.grandTotalPaise))}`}));
  }
  async listProductsForPurchasing(){await this.auth.require('MANAGE_PURCHASES');return this.raw.listProducts();}
  async listSuppliers(){await this.auth.require('MANAGE_SUPPLIERS');return this.raw.listSuppliers();}
  async saveSupplier(supplier:Supplier){await this.auth.require('MANAGE_SUPPLIERS');const user=this.auth.getSnapshot();await this.raw.saveSupplier(supplier,{actor:user,action:'SUPPLIER_SAVED',entityType:'supplier',entityId:supplier.id,summary:`Saved supplier ${supplier.name}`});}
  async listPurchaseOrders(){await this.auth.require('MANAGE_PURCHASES');return this.raw.listPurchaseOrders();}
  async savePurchaseOrder(order:Omit<PurchaseOrder,'id'|'number'|'createdAt'>,id?:string){await this.auth.require('MANAGE_PURCHASES');const user=this.auth.getSnapshot();return this.raw.savePurchaseOrder(order,id,saved=>({actor:user,action:'ORDER_SAVED',entityType:'purchase_order',entityId:saved.id,summary:`Saved ${saved.number} for ${saved.supplierName}`}));}
  async updatePurchaseStatus(id:string,status:PurchaseStatus){await this.auth.require('MANAGE_PURCHASES');const user=this.auth.getSnapshot();return this.raw.updatePurchaseStatus(id,status,{actor:user,action:'ORDER_STATUS_CHANGED',entityType:'purchase_order',entityId:id,summary:`Purchase order marked ${status.toLowerCase()}`});}
  async listPurchaseReceipts(){await this.auth.require('MANAGE_PURCHASES');return this.raw.listPurchaseReceipts();}
  async receivePurchase(receipt:Omit<PurchaseReceipt,'id'|'number'|'receivedAt'>,date?:number){await this.auth.require('RECEIVE_GOODS');const user=this.auth.getSnapshot();return this.raw.receivePurchase(receipt,date,saved=>({actor:user,action:'GOODS_RECEIVED',entityType:'purchase_receipt',entityId:saved.id,summary:`Received goods ${saved.number}`}));}
  async saveReturn(invoiceId:string,quantities:number[],method:RefundMethod,reason:string,prefix:string,date:Date){await this.auth.require('PROCESS_RETURN');const user=this.auth.getSnapshot();return this.raw.saveReturn(invoiceId,quantities,method,reason,prefix,date,credit=>({actor:user,action:'RETURN_RECORDED',entityType:'invoice',entityId:credit.id,summary:`Credit note ${credit.number}, total ${formatMoney(BigInt(credit.grandTotalPaise))}`}));}
}
