// The business-data shape shared by the local database and the shared backup code.
import type { ShopIdentity } from './shop';
import type { Product, StockMovement } from './catalog';
import type { BillingCustomer, CustomerLedgerEntry, InvoiceRecord } from './billing';
import type { StoredAccount } from '../application/authService';
import type { HeldBill } from './heldBills';
import type { Supplier, PurchaseOrder, PurchaseReceipt } from './purchasing';
import type { DayClosing } from './dayEnd';
import type { LoyaltyEntry, LoyaltyRules } from './loyalty';
import type { StockBatch } from './batches';
import type {AuditRecord} from './audit';
import type {StockCountRecord} from './stockCount';
import type {ShopCategory} from './categories';
import type { StoredProductPhoto } from './productPhotos';
import type { QuotationRecord } from './quotations';

export type BusinessSnapshot={shop:ShopIdentity|null;products:Product[];movements:StockMovement[];invoices:InvoiceRecord[];quotations:QuotationRecord[];customers:BillingCustomer[];customerLedger:CustomerLedgerEntry[];accounts:StoredAccount[];heldBills:HeldBill[];suppliers:Supplier[];purchaseOrders:PurchaseOrder[];purchaseReceipts:PurchaseReceipt[];dayClosings:DayClosing[];loyaltyRules:LoyaltyRules;loyaltyLedger:LoyaltyEntry[];stockBatches:StockBatch[];auditLog:AuditRecord[];stockCounts:StockCountRecord[];categories:ShopCategory[];productPhotos:StoredProductPhoto[]};
