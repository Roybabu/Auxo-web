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
import { LocalDatabase } from './localDatabase';

/** The UI and business services receive this boundary, never the raw browser store. */
export class AuthorizedStorage implements ShopStorage,CatalogStorage,SalesStorage {
  constructor(private readonly raw:LocalDatabase,private readonly auth:AuthService){}
  async load(){await this.auth.require('SELL');return this.raw.load();}
  async save(shop:ShopIdentity){await this.auth.require('MANAGE_SETTINGS');return this.raw.save(shop);}
  async listProducts(){await this.auth.require('SELL');return this.raw.listProducts();}
  async listMovements(){await this.auth.require('VIEW_STOCK_RECORDS');return this.raw.listMovements();}
  async saveProduct(product:Product,movements:StockMovement[]){await this.auth.require('MANAGE_PRODUCTS');return this.raw.saveProduct(product,movements);}
  async adjustStock(variantId:string,change:number,reason:MovementReason,note:string|null){await this.auth.require('ADJUST_STOCK');return this.raw.adjustStock(variantId,change,reason,note);}
  async updateTax(productId:string,rate:number|null,apparel:boolean){await this.auth.require('MANAGE_PRODUCTS');return this.raw.updateTax(productId,rate,apparel);}
  async updateHsn(productId:string,hsn:string|null){await this.auth.require('MANAGE_PRODUCTS');return this.raw.updateHsn(productId,hsn);}
  async listInvoices(){await this.auth.require('VIEW_INVOICES');return this.raw.listInvoices();}
  async listHeldBills(){await this.auth.require('SELL');return this.raw.listHeldBills();}
  async holdBill(draft:HeldBillDraft,replacingId?:string){await this.auth.require('SELL');return this.raw.holdBill(draft,replacingId);}
  async splitHeldBill(moved:HeldBillDraft,remaining:HeldBillDraft,replacingId?:string){await this.auth.require('SELL');return this.raw.splitHeldBill(moved,remaining,replacingId);}
  async deleteHeldBill(id:string){await this.auth.require('SELL');return this.raw.deleteHeldBill(id);}
  async listCustomers(){await this.auth.require('SELL');return this.raw.listCustomers();}
  async listCustomerLedger(customerId:string){await this.auth.require('MANAGE_CUSTOMERS');return this.raw.listCustomerLedger(customerId);}
  async createCustomer(customer:BillingCustomer){await this.auth.require('SELL');return this.raw.createCustomer(customer);}
  async recordAccountPayment(customerId:string,payment:{amountPaise:string;method:'CASH'|'UPI'|'CARD';reference:string|null;note:string|null},date:Date):Promise<CustomerLedgerEntry>{await this.auth.require('RECEIVE_ACCOUNT_PAYMENT');return this.raw.recordAccountPayment(customerId,payment,date);}
  async saveSale(draft:Omit<InvoiceRecord,'id'|'number'|'createdAt'>,prefix:string,date:Date,heldBillId?:string):Promise<InvoiceRecord>{
    await this.auth.require('SELL');if(!this.auth.can('UNLIMITED_DISCOUNT')){
      const shop=await this.raw.load();const limit=shop?.employeeDiscountLimitBp??0;
      const lineDiscounts=draft.lines.map(l=>({gross:l.stockUnit==='UNIT'?BigInt(l.unitPricePaise)*BigInt(l.quantity):(BigInt(l.unitPricePaise)*BigInt(l.quantity)+500n)/1000n,discount:BigInt(l.lineDiscountPaise)}));
      if(discountExceeds(BigInt(draft.subtotalPaise),BigInt(draft.discountPaise),lineDiscounts,limit))throw new Error('Employee discount exceeds the permitted limit.');
    }return this.raw.saveSale(draft,prefix,date,heldBillId);
  }
  async saveReturn(invoiceId:string,quantities:number[],method:RefundMethod,reason:string,prefix:string,date:Date){await this.auth.require('PROCESS_RETURN');return this.raw.saveReturn(invoiceId,quantities,method,reason,prefix,date);}
}
