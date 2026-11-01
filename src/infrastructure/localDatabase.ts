import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ShopIdentity } from '../domain/shop';
import type { ShopStorage } from '../application/shopService';
import type { CatalogStorage } from '../application/catalogService';
import type { MovementReason, Product, StockMovement } from '../domain/catalog';
import type { BillingCustomer, CustomerLedgerEntry, InvoiceRecord } from '../domain/billing';
import type { SalesStorage } from '../application/salesService';
import { buildReturn, type RefundMethod } from '../domain/returns';
import type { StoredAccount } from '../application/authService';
import type { BusinessSnapshot } from '../domain/backup';
import type { HeldBill, HeldBillDraft } from '../domain/heldBills';
import { nextToken } from '../domain/heldBills';
import type { Supplier, PurchaseOrder, PurchaseReceipt, PurchaseStatus } from '../domain/purchasing';
import { purchaseNumber } from '../domain/purchasing';
import { formatMoney } from '../domain/money';
interface GenesisSchema extends DBSchema {
  shop: { key: string; value: ShopIdentity };
  products: { key: string; value: Product };
  movements: { key: string; value: StockMovement };
  invoices: { key: string; value: InvoiceRecord; indexes: { 'by-number': string } };
  customers: { key: string; value: BillingCustomer };
  customerLedger: { key: string; value: CustomerLedgerEntry; indexes: { 'by-customer': string } };
  accounts: {key:string;value:StoredAccount;indexes:{'by-identifier':string}};
  heldBills:{key:string;value:HeldBill;indexes:{'by-token':number;'by-table':number}};
  suppliers:{key:string;value:Supplier};
  purchaseOrders:{key:string;value:PurchaseOrder;indexes:{'by-number':string}};
  purchaseReceipts:{key:string;value:PurchaseReceipt;indexes:{'by-number':string}};
}
/** This new database has no dependency on, or migration from, the former web app. */
export class LocalDatabase implements ShopStorage, CatalogStorage, SalesStorage {
  private connection?: Promise<IDBPDatabase<GenesisSchema>>;
  constructor(private readonly name = 'auxo-genesis-v1') {}
  private connect() {
    this.connection ??= openDB<GenesisSchema>(this.name, 8, {
      upgrade(db, oldVersion) { if(oldVersion<1) db.createObjectStore('shop'); if(oldVersion<2) { db.createObjectStore('products',{keyPath:'id'}); db.createObjectStore('movements',{keyPath:'id'}); } if(oldVersion<3){const invoices=db.createObjectStore('invoices',{keyPath:'id'});invoices.createIndex('by-number','number',{unique:true});} if(oldVersion<4)db.createObjectStore('customers',{keyPath:'id'});if(oldVersion<5){const ledger=db.createObjectStore('customerLedger',{keyPath:'id'});ledger.createIndex('by-customer','customerId');}if(oldVersion<6){const accounts=db.createObjectStore('accounts',{keyPath:'id'});accounts.createIndex('by-identifier','identifier',{unique:true});}if(oldVersion<7){const held=db.createObjectStore('heldBills',{keyPath:'id'});held.createIndex('by-token','tokenNumber');held.createIndex('by-table','tableNumber');}if(oldVersion<8){db.createObjectStore('suppliers',{keyPath:'id'});const orders=db.createObjectStore('purchaseOrders',{keyPath:'id'});orders.createIndex('by-number','number',{unique:true});const receipts=db.createObjectStore('purchaseReceipts',{keyPath:'id'});receipts.createIndex('by-number','number',{unique:true});} },
      blocking: () => { void this.close(); },
      terminated: () => { this.connection = undefined; },
    }).catch(error => { this.connection = undefined; throw error; });
    return this.connection;
  }
  async load(): Promise<ShopIdentity | null> {
    return (await (await this.connect()).get('shop', 'identity')) ?? null;
  }
  async save(shop: ShopIdentity): Promise<void> {
    const db = await this.connect();
    const transaction = db.transaction('shop', 'readwrite');
    await transaction.store.put(shop, 'identity');
    await transaction.done;
  }
  async listProducts() { return (await (await this.connect()).getAll('products')); }
  async listAccounts(){return (await (await this.connect()).getAll('accounts'));}
  async listHeldBills(){return (await (await this.connect()).getAll('heldBills')).sort((a,b)=>b.updatedAt-a.updatedAt);}
  async getHeldBill(id:string){return (await (await this.connect()).get('heldBills',id))??null;}
  async holdBill(draft:HeldBillDraft,replacingId?:string):Promise<HeldBill>{
    const db=await this.connect(),tx=db.transaction(['heldBills','shop'],'readwrite'),store=tx.objectStore('heldBills'),rows=await store.getAll();
    const existing=replacingId?await store.get(replacingId):undefined;const shop=await tx.objectStore('shop').get('identity');const tableCount=shop?.tableCount??10;
    if(draft.tableNumber!==null){if(!Number.isInteger(draft.tableNumber)||draft.tableNumber<1||draft.tableNumber>tableCount){await tx.done;throw new Error('Choose a valid restaurant table.');}if(rows.some(b=>b.tableNumber===draft.tableNumber&&b.id!==existing?.id)){await tx.done;throw new Error(`Table ${draft.tableNumber} already has a held bill.`);}}
    const token=draft.tableNumber===null?(existing?.tokenNumber??nextToken(rows,existing?.id)):null;const now=Date.now();const bill:HeldBill={...draft,id:existing?.id??crypto.randomUUID(),createdAt:existing?.createdAt??now,updatedAt:now,tokenNumber:token};await store.put(bill);await tx.done;return bill;
  }
  async splitHeldBill(moved:HeldBillDraft,remaining:HeldBillDraft,replacingId?:string):Promise<HeldBill>{
    const db=await this.connect(),tx=db.transaction(['heldBills','shop'],'readwrite'),store=tx.objectStore('heldBills'),rows=await store.getAll();const existing=replacingId?await store.get(replacingId):undefined;const now=Date.now();if(replacingId&&!existing){await tx.done;throw new Error('This held bill no longer exists.');}
    const shop=await tx.objectStore('shop').get('identity');if(remaining.tableNumber!==null&&remaining.tableNumber>(shop?.tableCount??10)){await tx.done;throw new Error('Choose a valid restaurant table.');}if(remaining.tableNumber!==null&&rows.some(b=>b.tableNumber===remaining.tableNumber&&b.id!==existing?.id)){await tx.done;throw new Error(`Table ${remaining.tableNumber} already has a held bill.`);}
    const movedBill:HeldBill={...moved,tableNumber:null,id:crypto.randomUUID(),createdAt:now,updatedAt:now,tokenNumber:nextToken(rows,existing?.id)};await store.add(movedBill);
    if(existing){await store.put({...remaining,id:existing.id,createdAt:existing.createdAt,updatedAt:now,tokenNumber:existing.tokenNumber});}
    await tx.done;return movedBill;
  }
  async deleteHeldBill(id:string){return (await this.connect()).delete('heldBills',id);}
  async getAccount(id:string){return (await (await this.connect()).get('accounts',id))??null;}
  async findAccount(identifier:string){return (await (await this.connect()).getFromIndex('accounts','by-identifier',identifier))??null;}
  async createAdmin(account:StoredAccount){const db=await this.connect();const tx=db.transaction('accounts','readwrite');if((await tx.store.count())!==0){await tx.done;throw new Error('Administrator is already set up.');}await tx.store.add(account);await tx.done;}
  async createEmployeeAccount(account:StoredAccount){const db=await this.connect();const tx=db.transaction('accounts','readwrite');await tx.store.add(account);await tx.done;}
  async updateAccount(account:StoredAccount){const db=await this.connect();const tx=db.transaction('accounts','readwrite');await tx.store.put(account);await tx.done;}
  async replaceRecoveryAccount(account:StoredAccount,expectedHash:string|null){const db=await this.connect();const tx=db.transaction('accounts','readwrite');const current=await tx.store.get(account.id);if(!current||current.role!=='SUPER_ADMIN'||(current.recovery?.hash??null)!==expectedHash){await tx.done;throw new Error('Recovery details changed. Try again.');}await tx.store.put(account);await tx.done;}
  async snapshot():Promise<BusinessSnapshot>{const names=['shop','products','movements','invoices','customers','customerLedger','accounts','heldBills','suppliers','purchaseOrders','purchaseReceipts'] as const;const db=await this.connect();const tx=db.transaction([...names],'readonly');const [shop,products,movements,invoices,customers,customerLedger,accounts,heldBills,suppliers,purchaseOrders,purchaseReceipts]=await Promise.all([tx.objectStore('shop').get('identity'),tx.objectStore('products').getAll(),tx.objectStore('movements').getAll(),tx.objectStore('invoices').getAll(),tx.objectStore('customers').getAll(),tx.objectStore('customerLedger').getAll(),tx.objectStore('accounts').getAll(),tx.objectStore('heldBills').getAll(),tx.objectStore('suppliers').getAll(),tx.objectStore('purchaseOrders').getAll(),tx.objectStore('purchaseReceipts').getAll()]);await tx.done;return {shop:shop??null,products,movements,invoices,customers,customerLedger,accounts,heldBills,suppliers,purchaseOrders,purchaseReceipts};}
  async replaceSnapshot(data:BusinessSnapshot){const names=['shop','products','movements','invoices','customers','customerLedger','accounts','heldBills','suppliers','purchaseOrders','purchaseReceipts'] as const;const db=await this.connect();const tx=db.transaction([...names],'readwrite');
    for(const name of names)await tx.objectStore(name).clear();
    if(data.shop)await tx.objectStore('shop').put(data.shop,'identity');
    for(const item of data.products)await tx.objectStore('products').add(item);
    for(const item of data.movements)await tx.objectStore('movements').add(item);
    for(const item of data.invoices)await tx.objectStore('invoices').add(item);
    for(const item of data.customers)await tx.objectStore('customers').add(item);
    for(const item of data.customerLedger)await tx.objectStore('customerLedger').add(item);
    for(const item of data.accounts)await tx.objectStore('accounts').add(item);
    for(const item of data.heldBills)await tx.objectStore('heldBills').add(item);for(const item of data.suppliers)await tx.objectStore('suppliers').add(item);for(const item of data.purchaseOrders)await tx.objectStore('purchaseOrders').add(item);for(const item of data.purchaseReceipts)await tx.objectStore('purchaseReceipts').add(item);
    await tx.done;
  }
  async listSuppliers(){return (await (await this.connect()).getAll('suppliers')).sort((a,b)=>a.name.localeCompare(b.name));}
  async saveSupplier(supplier:Supplier){const db=await this.connect(),tx=db.transaction('suppliers','readwrite');await tx.store.put(supplier);await tx.done;}
  async listPurchaseOrders(){return (await (await this.connect()).getAll('purchaseOrders')).sort((a,b)=>b.createdAt-a.createdAt);}
  async savePurchaseOrder(draft:Omit<PurchaseOrder,'id'|'number'|'createdAt'>,id?:string){const db=await this.connect(),tx=db.transaction(['purchaseOrders','suppliers'],'readwrite');const supplier=await tx.objectStore('suppliers').get(draft.supplierId);if(!supplier?.active){await tx.done;throw new Error('Choose an active supplier.');}let current=id?await tx.objectStore('purchaseOrders').get(id):undefined;if(id&&(!current||current.status!=='DRAFT')){await tx.done;throw new Error('This purchase order is no longer editable.');}const now=Date.now(),prior=await tx.objectStore('purchaseOrders').getAll(),year=now-(new Date(now).getMonth()<3?1:0),prefix=`PO/${String(year%100).padStart(2,'0')}-${String((year+1)%100).padStart(2,'0')}/`,seq=prior.filter(x=>x.number.startsWith(prefix)).length+1;const row:PurchaseOrder={...draft,id:current?.id??crypto.randomUUID(),number:current?.number??purchaseNumber('PO',new Date(now),seq),createdAt:current?.createdAt??now,supplierName:supplier.name,status:'DRAFT',lines:draft.lines.map(l=>({...l,quantityReceived:0}))};await tx.objectStore('purchaseOrders').put(row);await tx.done;return row;}
  async updatePurchaseStatus(id:string,status:PurchaseStatus){const db=await this.connect(),tx=db.transaction('purchaseOrders','readwrite'),store=tx.store,row=await store.get(id);if(!row){await tx.done;return false;}const allowed=status==='ORDERED'?row.status==='DRAFT':status==='CANCELLED'?['DRAFT','ORDERED','PARTLY_RECEIVED'].includes(row.status):false;if(!allowed){await tx.done;return false;}await store.put({...row,status});await tx.done;return true;}
  async listPurchaseReceipts(){return (await (await this.connect()).getAll('purchaseReceipts')).sort((a,b)=>b.receivedAt-a.receivedAt);}
  async receivePurchase(draft:Omit<PurchaseReceipt,'id'|'number'|'receivedAt'>,receivedAt=Date.now()){const db=await this.connect(),tx=db.transaction(['products','movements','suppliers','purchaseOrders','purchaseReceipts'],'readwrite');const receipts=tx.objectStore('purchaseReceipts'),prior=await receipts.getAll();const replay=prior.find(r=>r.requestId===draft.requestId);if(replay){await tx.done;return replay;}const order=draft.orderId?await tx.objectStore('purchaseOrders').get(draft.orderId):undefined;if(draft.orderId&&(!order||!['DRAFT','ORDERED','PARTLY_RECEIVED'].includes(order.status))){await tx.done;throw new Error('This purchase order is closed.');}const supplier=order?await tx.objectStore('suppliers').get(order.supplierId):draft.supplierId?await tx.objectStore('suppliers').get(draft.supplierId):undefined;if(!supplier||(!order&&!supplier.active)){await tx.done;throw new Error('Supplier is inactive or no longer exists.');}const supplierInvoice=draft.supplierInvoiceNumber?.trim().toUpperCase()||null;if(supplierInvoice&&prior.some(r=>r.supplierId===supplier.id&&r.supplierInvoiceNumber===supplierInvoice)){await tx.done;throw new Error('This supplier invoice has already been received.');}const products=await tx.objectStore('products').getAll();const orderQuantities=new Map<string,number>();for(const line of draft.lines)if(line.orderLineId)orderQuantities.set(line.orderLineId,(orderQuantities.get(line.orderLineId)??0)+line.quantity);for(const line of draft.lines){const product=products.find(p=>p.variants.some(v=>v.id===line.variantId)),variant=product?.variants.find(v=>v.id===line.variantId);if(!product||!variant){await tx.done;throw new Error(`${line.productName} is no longer in inventory.`);}if(line.orderLineId){const ordered=order?.lines.find(x=>x.id===line.orderLineId);if(!ordered||ordered.variantId!==line.variantId||(orderQuantities.get(ordered.id)??0)>ordered.quantityOrdered-ordered.quantityReceived){await tx.done;throw new Error('Received quantity exceeds the remaining order quantity.');}}}
    const year=receivedAt-(new Date(receivedAt).getMonth()<3?1:0),label=`GRN/${String(year%100).padStart(2,'0')}-${String((year+1)%100).padStart(2,'0')}/`,number=purchaseNumber('GRN',new Date(receivedAt),prior.filter(x=>x.number.startsWith(label)).length+1),receipt:PurchaseReceipt={...draft,id:crypto.randomUUID(),number,receivedAt,supplierId:supplier.id,supplierName:supplier.name,supplierInvoiceNumber:supplierInvoice,orderNumber:order?.number??null};
    for(const line of receipt.lines){const product=products.find(p=>p.variants.some(v=>v.id===line.variantId))!,updateCost=BigInt(line.unitCostPaise)>0n,variants=product.variants.map(v=>v.id===line.variantId?{...v,stock:v.stock+line.quantity,...(updateCost?{costPaise:line.unitCostPaise,cost:formatMoney(BigInt(line.unitCostPaise))}:{})}:v);await tx.objectStore('products').put({...product,variants,updatedAt:receivedAt});await tx.objectStore('movements').add({id:crypto.randomUUID(),variantId:line.variantId,quantityChange:line.quantity,reason:'RECEIVED',note:number,createdAt:receivedAt});}
    if(order){const lines=order.lines.map(l=>({...l,quantityReceived:l.quantityReceived+(receipt.lines.find(x=>x.orderLineId===l.id)?.quantity??0)})),status=lines.every(l=>l.quantityReceived>=l.quantityOrdered)?'RECEIVED':lines.some(l=>l.quantityReceived>0)?'PARTLY_RECEIVED':order.status;await tx.objectStore('purchaseOrders').put({...order,lines,status});}await receipts.add(receipt);await tx.done;return receipt;}
  async updateTax(productId:string,rate:number|null,apparel:boolean) {const db=await this.connect();const tx=db.transaction('products','readwrite');const store=tx.objectStore('products');const product=await store.get(productId);if(!product){await tx.done;throw new Error('Product no longer exists.');}await store.put({...product,gstRateBasisPoints:rate,apparelGst:apparel,updatedAt:Date.now()});await tx.done;}
  async updateHsn(productId:string,hsn:string|null) {const db=await this.connect();const tx=db.transaction('products','readwrite');const store=tx.objectStore('products');const product=await store.get(productId);if(!product){await tx.done;throw new Error('Product no longer exists.');}await store.put({...product,hsnCode:hsn,updatedAt:Date.now()});await tx.done;}
  async listMovements() { return (await (await this.connect()).getAll('movements')).sort((a,b)=>b.createdAt-a.createdAt); }
  async listInvoices() { return (await (await this.connect()).getAll('invoices')).sort((a,b)=>b.createdAt-a.createdAt); }
  async listCustomers() { return (await (await this.connect()).getAll('customers')).sort((a,b)=>a.name.localeCompare(b.name)); }
  async listCustomerLedger(customerId:string) { return (await (await this.connect()).getAllFromIndex('customerLedger','by-customer',customerId)).sort((a,b)=>a.createdAt-b.createdAt); }
  async createCustomer(customer:BillingCustomer) {const db=await this.connect();const tx=db.transaction('customers','readwrite');const store=tx.objectStore('customers');const current=await store.getAll();if(customer.phone&&current.some(c=>c.phone===customer.phone)){await tx.done;throw new Error('That mobile number is already used by another customer.');}await store.add(customer);await tx.done;}
  async recordAccountPayment(customerId:string,payment:{amountPaise:string;method:'CASH'|'UPI'|'CARD';reference:string|null;note:string|null},date:Date):Promise<CustomerLedgerEntry> {const db=await this.connect();const tx=db.transaction(['customers','customerLedger'],'readwrite');const customers=tx.objectStore('customers');const customer=await customers.get(customerId);if(!customer){await tx.done;throw new Error('Customer account no longer exists.');}const amount=BigInt(payment.amountPaise);const balance=BigInt(customer.balancePaise);if(balance<=0n){await tx.done;throw new Error('This customer has no outstanding balance.');}if(amount<=0n||amount>balance){await tx.done;throw new Error('Payment is more than the amount currently due.');}const entry:CustomerLedgerEntry={id:crypto.randomUUID(),customerId,type:'PAYMENT',amountPaise:(-amount).toString(),invoiceId:null,invoiceNumber:null,method:payment.method,reference:payment.reference,createdAt:date.getTime(),note:payment.note};await customers.put({...customer,balancePaise:(balance-amount).toString()});await tx.objectStore('customerLedger').add(entry);await tx.done;return entry;}
  async saveProduct(product:Product,movements:StockMovement[]) {
    const db=await this.connect(); const tx=db.transaction(['products','movements'],'readwrite');
    await tx.objectStore('products').add(product); for(const movement of movements) await tx.objectStore('movements').add(movement); await tx.done;
  }
  async adjustStock(variantId:string,change:number,reason:MovementReason,note:string|null) {
    const db=await this.connect(); const tx=db.transaction(['products','movements'],'readwrite'); const store=tx.objectStore('products');
    const products=await store.getAll(); const product=products.find(p=>p.variants.some(v=>v.id===variantId));
    if(!product) {await tx.done; throw new Error('Variant no longer exists.');}
    const variants=product.variants.map(v=>v.id===variantId?{...v,stock:v.stock+change}:v);
    await store.put({...product,variants,updatedAt:Date.now()});
    await tx.objectStore('movements').add({id:crypto.randomUUID(),variantId,quantityChange:change,reason,note,createdAt:Date.now()}); await tx.done;
  }
  async saveSale(draft:Omit<InvoiceRecord,'id'|'number'|'createdAt'>,prefix:string,date:Date,heldBillId?:string):Promise<InvoiceRecord> {
    const db=await this.connect();const tx=db.transaction(['products','movements','invoices','customers','customerLedger','heldBills'],'readwrite');const productStore=tx.objectStore('products');
    if(heldBillId&&!await tx.objectStore('heldBills').get(heldBillId)){await tx.done;throw new Error('This held bill no longer exists.');}
    const products=await productStore.getAll();const sold=new Map<string,number>();for(const line of draft.lines)sold.set(line.variantId,(sold.get(line.variantId)??0)+line.quantity);
    const productUpdates=new Map<string,number>();
    for(const [variantId,quantity] of sold){const product=products.find(p=>p.variants.some(v=>v.id===variantId));const variant=product?.variants.find(v=>v.id===variantId);if(!product||!variant){await tx.done;throw new Error(`A product on the bill is no longer available.`);}if(quantity>variant.stock){await tx.done;throw new Error(`${product.name} does not have enough stock to complete this bill.`);}productUpdates.set(product.id,quantity);}
    const creditPaid=draft.payments.filter(p=>p.method==='CREDIT').reduce((sum,p)=>sum+BigInt(p.amountPaise),0n);const customerStore=tx.objectStore('customers');let customer:BillingCustomer|undefined;
    if(creditPaid>0n){customer=draft.customer?await customerStore.get(draft.customer.id):undefined;if(!customer){await tx.done;throw new Error('The selected customer account no longer exists.');}if(customer.onHold){await tx.done;throw new Error('This customer account is on hold.');}if(customer.creditLimitPaise!==null&&BigInt(customer.balancePaise)+creditPaid>BigInt(customer.creditLimitPaise)){await tx.done;throw new Error('Credit payment would exceed this customer’s credit limit.');}}
    for(const [productId,quantity] of productUpdates){const product=products.find(p=>p.id===productId)!;const variants=product.variants.map(v=>sold.has(v.id)?{...v,stock:v.stock-sold.get(v.id)!}:v);await productStore.put({...product,variants,updatedAt:date.getTime()});}
    for(const [variantId,quantity] of sold)await tx.objectStore('movements').add({id:crypto.randomUUID(),variantId,quantityChange:-quantity,reason:'SOLD',note:null,createdAt:date.getTime()});
    const invoices=tx.objectStore('invoices');const prior=await invoices.getAll();const year=date.getFullYear()-(date.getMonth()<3?1:0);const sameYear=prior.filter(i=>i.number.startsWith(`${prefix}/${String(year%100).padStart(2,'0')}-`));const sequence=sameYear.length+1;const number=`${prefix}/${String(year%100).padStart(2,'0')}-${String((year+1)%100).padStart(2,'0')}/${String(sequence).padStart(5,'0')}`;
    const invoice:InvoiceRecord={...draft,id:crypto.randomUUID(),number,createdAt:date.getTime()};await invoices.add(invoice);
    if(customer&&creditPaid>0n){await customerStore.put({...customer,balancePaise:(BigInt(customer.balancePaise)+creditPaid).toString()});for(const payment of draft.payments.filter(p=>p.method==='CREDIT'))await tx.objectStore('customerLedger').add({id:crypto.randomUUID(),customerId:customer.id,type:'SALE',amountPaise:payment.amountPaise,invoiceId:invoice.id,invoiceNumber:invoice.number,method:'CREDIT',reference:null,createdAt:date.getTime(),note:'Sale on account'});}
    if(heldBillId)await tx.objectStore('heldBills').delete(heldBillId);
    await tx.done;return invoice;
  }
  async saveReturn(invoiceId:string,quantities:number[],method:RefundMethod,reason:string,prefix:string,date:Date):Promise<InvoiceRecord>{
    const db=await this.connect();const tx=db.transaction(['invoices','products','movements','customers','customerLedger'],'readwrite');const invoices=tx.objectStore('invoices');const original=await invoices.get(invoiceId);
    if(!original){await tx.done;throw new Error('Invoice no longer exists.');}
    let result:ReturnType<typeof buildReturn>;try{result=buildReturn(original,quantities,method,reason);}catch(error){await tx.done;throw error;}
    const products=await tx.objectStore('products').getAll();const updates=new Map<string,Product>();
    for(const line of result.creditNote.lines){const product=products.find(p=>p.variants.some(v=>v.id===line.variantId));if(!product){await tx.done;throw new Error(`${line.name} is no longer in inventory.`);}const current=updates.get(product.id)??product;updates.set(product.id,{...current,variants:current.variants.map(v=>v.id===line.variantId?{...v,stock:v.stock+line.quantity}:v),updatedAt:date.getTime()});}
    let customer:BillingCustomer|undefined;if(result.accountCredit>0n){customer=original.customer?await tx.objectStore('customers').get(original.customer.id):undefined;if(!customer){await tx.done;throw new Error('Customer account no longer exists.');}}
    const prior=await invoices.getAll();const year=date.getFullYear()-(date.getMonth()<3?1:0);const label=`${String(year%100).padStart(2,'0')}-${String((year+1)%100).padStart(2,'0')}`;const number=`${prefix}/${label}/${String(prior.filter(i=>i.number.startsWith(`${prefix}/${label}/`)).length+1).padStart(5,'0')}`;
    const note:InvoiceRecord={...result.creditNote,id:crypto.randomUUID(),number,createdAt:date.getTime()};
    await invoices.put({...original,lines:original.lines.map((line,i)=>({...line,returnedQuantity:result.returned[i]}))});for(const product of updates.values())await tx.objectStore('products').put(product);
    for(const line of note.lines)await tx.objectStore('movements').add({id:crypto.randomUUID(),variantId:line.variantId,quantityChange:line.quantity,reason:'RETURNED',note:note.number,createdAt:date.getTime()});
    await invoices.add(note);
    if(customer&&result.accountCredit>0n){await tx.objectStore('customers').put({...customer,balancePaise:(BigInt(customer.balancePaise)-result.accountCredit).toString()});await tx.objectStore('customerLedger').add({id:crypto.randomUUID(),customerId:customer.id,type:'RETURN',amountPaise:(-result.accountCredit).toString(),invoiceId:note.id,invoiceNumber:note.number,method:'CREDIT',reference:null,createdAt:date.getTime(),note:'Return credited to account'});}
    await tx.done;return note;
  }
  async close() {
    if (this.connection) (await this.connection).close();
    this.connection = undefined;
  }
}
