// Maps the web app's business snapshot to and from the shared auxo-backup v1 table layout
// (docs/BACKUP_FORMAT.md section 2). Pure functions: no storage, no encryption here.
//
// Rules used:
// - Accounts, password material and sessions are never mapped (spec sections 1 and 3).
// - Nested child arrays (invoice lines and payments, purchase lines, receipt lines, held bill and quotation
//   lines, stock count lines, product variants, category subcategories) become their own tables with a
//   parent ID. The web app does not store IDs for most of these, so each gets a stable ID derived from its
//   parent and position. Array order in each table is the order used on import.
// - A web field that is not a spec column for its table is kept in an org.auxo.web extension record
//   (ownerType = table, ownerId = row ID, key "fields"), so it survives a round trip and is not lost.
// - Where the web app uses a different name for a spec column (for example variant "stock" vs "stockQuantity"),
//   the value is renamed on export and renamed back on import.
// - Spec fields the web app never stores (customer, supplier and purchase order updatedAt; payment createdAt;
//   invoice customerId) are filled from related data on export and removed again on import.

import type { BusinessSnapshot } from './backup';
import type { Product, ProductVariant } from './catalog';
import { placeOfSupplyFor, type InvoiceRecord } from './billing';
import { REQUIRED } from './sharedSpec';
import type { ShopCategory, ShopSubcategory } from './categories';
import type { QuotationRecord } from './quotations';
import type { StockCountRecord } from './stockCount';
import type { HeldBill } from './heldBills';
import type { PurchaseOrder, PurchaseReceipt } from './purchasing';
import type { DayClosing } from './dayEnd';

export { SHARED_TABLE_NAMES, type SharedTableName } from './sharedTableNames';
import { SHARED_TABLE_NAMES, type SharedTableName } from './sharedTableNames';

export type SharedRow = Record<string, unknown>;
export type SharedTables = Record<SharedTableName, SharedRow[]>;
export type SharedPhoto = { id: string; mimeType: string; dataBase64: string };
export type SharedPayload = {
  format: 'auxo-backup';
  version: 1;
  sharedModelVersion: 1;
  createdAt: number;
  source: { platform: 'web'; appVersion: string };
  shopName: string;
  tables: SharedTables;
  photos: SharedPhoto[];
};

/** The part of the web snapshot that is business data. Accounts and photo blobs are handled elsewhere. */
export type SharedSourceSnapshot = Omit<BusinessSnapshot, 'accounts' | 'productPhotos'>;

const WEB_NAMESPACE = 'org.auxo.web';
const FIELDS_KEY = 'fields';

/** Spec columns per table (docs/BACKUP_FORMAT.md section 2). Anything else on a web row is kept as an extension. */
const SPEC_COLUMNS: Record<SharedTableName, readonly string[]> = {
  settings: ['id', 'storeName', 'address', 'gstin', 'stateCode', 'gstRegistered', 'pricesIncludeTax', 'roundOff', 'invoicePrefix', 'creditNotePrefix', 'phone', 'fssai', 'upiId', 'upiPayeeName', 'receiptPaper', 'receiptFooter', 'receiptLanguage', 'receiptShowHsn', 'receiptShowTaxBreakdown', 'receiptShowCustomer', 'receiptShowSavings', 'receiptShowBarcode', 'receiptShowUpiQr', 'employeeDiscountLimitBp', 'expiryWarningDays', 'metalRatesPaise', 'storeLogoPhotoId', 'tableCount', 'creditHoldDays', 'onTimeBonusPoints'],
  categories: ['id', 'name', 'profile', 'enabled', 'sortOrder', 'builtIn'],
  subcategories: ['id', 'categoryId', 'name', 'sortOrder'],
  products: ['id', 'name', 'category', 'brand', 'createdAt', 'updatedAt', 'stockUnit', 'gstRateBasisPoints', 'apparelGst', 'available', 'tracksStock', 'categoryId', 'subcategory', 'description', 'material', 'dietType', 'hsnCode', 'preferredSupplierId', 'photoId', 'warrantyMonths', 'prescriptionRequired', 'metal', 'makingChargeBasisPoints'],
  variants: ['id', 'productId', 'sku', 'barcode', 'size', 'colour', 'pricePaise', 'mrpPaise', 'costPaise', 'stockQuantity', 'lowStockThreshold', 'reorderQuantity', 'netQuantityMilli', 'netQuantityUnit', 'photoId'],
  stockBatches: ['id', 'variantId', 'batchNumber', 'expiryDate', 'quantity', 'receivedAt', 'unitCostPaise'],
  stockMovements: ['id', 'variantId', 'quantityChange', 'reason', 'note', 'createdAt', 'batchId', 'invoiceId', 'sourceInvoiceId'],
  customers: ['id', 'name', 'phone', 'email', 'gstin', 'stateCode', 'address', 'notes', 'creditLimitPaise', 'balancePaise', 'onHold', 'createdAt', 'updatedAt'],
  customerLedger: ['id', 'customerId', 'type', 'amountPaise', 'invoiceId', 'invoiceNumber', 'method', 'reference', 'createdAt', 'note'],
  invoices: ['id', 'number', 'type', 'createdAt', 'seller', 'buyer', 'customerId', 'originalInvoiceId', 'originalInvoiceNumber', 'note', 'returnReason', 'placeOfSupply', 'gstRegistered', 'pricesIncludeTax', 'interState', 'subtotalPaise', 'lineDiscountPaise', 'billDiscountPaise', 'discountPaise', 'billDiscountReason', 'loyaltyPointsRedeemed', 'loyaltyDiscountPaise', 'taxablePaise', 'cgstPaise', 'sgstPaise', 'igstPaise', 'roundOffPaise', 'roundedToRupee', 'grandTotalPaise', 'savingsPaise'],
  invoiceLines: ['id', 'invoiceId', 'productId', 'variantId', 'originalLineId', 'name', 'variantLabel', 'barcode', 'hsnCode', 'customItem', 'quantity', 'stockUnit', 'unitPricePaise', 'mrpPaise', 'lineDiscountPaise', 'billDiscountSharePaise', 'discountPaise', 'discountReason', 'taxablePaise', 'gstRateBasisPoints', 'cgstPaise', 'sgstPaise', 'igstPaise', 'totalPaise', 'returnedQuantity'],
  payments: ['id', 'invoiceId', 'method', 'kind', 'amountPaise', 'reference', 'tenderedPaise', 'changePaise', 'createdAt'],
  suppliers: ['id', 'name', 'active', 'createdAt', 'updatedAt', 'contactPerson', 'phone', 'email', 'gstin', 'stateCode', 'address', 'notes'],
  purchaseOrders: ['id', 'number', 'supplierId', 'status', 'createdAt', 'updatedAt', 'expectedDate', 'note'],
  purchaseOrderLines: ['id', 'orderId', 'variantId', 'productName', 'variantLabel', 'stockUnit', 'quantityOrdered', 'quantityReceived', 'unitCostPaise'],
  receipts: ['id', 'number', 'supplierId', 'supplierName', 'orderId', 'orderNumber', 'supplierInvoiceNumber', 'receivedAt', 'note', 'totalPaise', 'requestId'],
  receiptLines: ['id', 'receiptId', 'variantId', 'orderLineId', 'productName', 'variantLabel', 'stockUnit', 'quantity', 'unitCostPaise', 'batchNumber', 'expiryDate', 'batchId'],
  dayClosings: ['id', 'businessDate', 'bills', 'returns', 'netSalesPaise', 'cashReceivedPaise', 'cashRefundedPaise', 'cashFromAccountsPaise', 'upiNetPaise', 'cardNetPaise', 'onAccountNetPaise', 'countedCashPaise', 'note', 'closedAt', 'closedBy'],
  loyaltySettings: ['id', 'enabled', 'spendPerPointPaise', 'pointValuePaise'],
  loyaltyLedger: ['id', 'customerId', 'type', 'points', 'invoiceId', 'sourceInvoiceId', 'createdAt', 'note'],
  heldBills: ['id', 'label', 'createdAt', 'updatedAt', 'itemCount', 'totalPaise', 'tableNumber', 'tokenNumber', 'discount', 'interState', 'customerId', 'buyerName', 'buyerPhone', 'buyerGstin'],
  heldBillLines: ['id', 'heldBillId', 'sortOrder', 'snapshot'],
  quotations: ['id', 'number', 'createdAt', 'validUntil', 'customerName', 'customerPhone', 'itemCount', 'totalPaise', 'status', 'convertedInvoiceId', 'customerId'],
  quotationLines: ['id', 'quotationId', 'sortOrder', 'snapshot'],
  stockCounts: ['id', 'status', 'startedAt', 'finishedAt', 'reason', 'note', 'adjustedCount', 'matchedCount'],
  stockCountLines: ['id', 'stockCountId', 'variantId', 'expectedQuantity', 'countedQuantity'],
  auditLog: ['id', 'createdAt', 'actorId', 'actorName', 'actorRole', 'action', 'entityType', 'entityId', 'summary'],
  numberSequences: ['name', 'nextValue'],
  extensions: ['namespace', 'ownerType', 'ownerId', 'key', 'value'],
};

/** A stable UUID-shaped ID from parts, using SHA-256 (same result on every run for the same parts). */
export async function deriveSharedId(...parts: string[]): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`auxo-backup-v1|${parts.join('|')}`)));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version 5 style
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC variant
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function emptyTables(): SharedTables {
  return Object.fromEntries(SHARED_TABLE_NAMES.map(name => [name, []])) as unknown as SharedTables;
}

function withoutKeys(row: SharedRow, keys: readonly string[]): SharedRow {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

/** Splits a row into its spec columns and web-only extras; extras go to an org.auxo.web extension record. */
/** Values the spec requires that the web app may leave out, filled with the web app's own defaults. */
const FILL_DEFAULTS: Partial<Record<SharedTableName, Record<string, (row: SharedRow) => unknown>>> = {
  settings: {
    gstin: () => '', stateCode: () => '', gstRegistered: () => false, pricesIncludeTax: () => true, roundOff: () => true,
    invoicePrefix: () => 'INV', creditNotePrefix: () => 'CN', phone: () => '', fssai: () => '', upiId: () => '', upiPayeeName: () => '',
    receiptPaper: () => 'THERMAL_80', receiptFooter: () => 'Thank you for shopping with us!', receiptLanguage: () => 'en',
    receiptShowHsn: () => true, receiptShowTaxBreakdown: () => true, receiptShowCustomer: () => true, receiptShowSavings: () => true,
    receiptShowBarcode: () => true, receiptShowUpiQr: () => true, employeeDiscountLimitBp: () => 0,
    expiryWarningDays: () => 30, metalRatesPaise: () => ({}),
  },
  products: { available: () => true, tracksStock: () => true },
  variants: { sku: () => '', barcode: () => '', size: () => '', colour: () => '' },
  invoices: {
    type: () => 'SALE', gstRegistered: () => false, pricesIncludeTax: () => true, interState: () => false,
    roundedToRupee: () => false, loyaltyPointsRedeemed: () => 0, loyaltyDiscountPaise: () => '0',
    savingsPaise: row => row.discountPaise,
  },
  invoiceLines: { customItem: () => false, returnedQuantity: () => 0 },
};

function emit(tables: SharedTables, table: SharedTableName, input: SharedRow): void {
  const row: SharedRow = { ...input };
  for (const [field, fill] of Object.entries(FILL_DEFAULTS[table] ?? {})) {
    if (row[field] === undefined) row[field] = fill(row);
  }
  for (const [field, kind] of Object.entries(REQUIRED[table])) {
    if (row[field] === undefined && kind.endsWith('?')) row[field] = null;
  }
  const allowed = new Set<string>(SPEC_COLUMNS[table]);
  const spec: SharedRow = {};
  const extra: SharedRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    (allowed.has(key) ? spec : extra)[key] = value;
  }
  if (Object.keys(extra).length > 0) {
    tables.extensions.push({ namespace: WEB_NAMESPACE, ownerType: table, ownerId: String(row.id), key: FIELDS_KEY, value: extra });
  }
  tables[table].push(spec);
}

/** Splits a web snapshot into the shared table layout. */
export async function toSharedPayload(input: {
  snapshot: SharedSourceSnapshot;
  photos: SharedPhoto[];
  createdAt: number;
  appVersion: string;
}): Promise<SharedPayload> {
  const s = input.snapshot;
  const t = emptyTables();

  if (s.shop) {
    const { receiptShowTaxBreakup, ...rest } = s.shop as typeof s.shop & { receiptShowTaxBreakup?: boolean };
    emit(t, 'settings', { ...rest, id: 'shop', receiptShowTaxBreakdown: receiptShowTaxBreakup });
  }
  emit(t, 'loyaltySettings', { ...s.loyaltyRules, id: 'rules' });

  for (const category of s.categories as ShopCategory[]) {
    const { subcategories = [], ...row } = category;
    emit(t, 'categories', row);
    for (const sub of subcategories as ShopSubcategory[]) emit(t, 'subcategories', { ...sub, categoryId: category.id });
  }

  for (const product of s.products as Product[]) {
    const { variants, ...row } = product;
    emit(t, 'products', row);
    for (const variant of variants as ProductVariant[]) {
      const { stock, netQuantity, ...rest } = variant;
      emit(t, 'variants', {
        ...rest,
        productId: product.id,
        stockQuantity: stock,
        reorderQuantity: variant.reorderQuantity ?? 0,
        netQuantityMilli: netQuantity?.amountMilli ?? null,
        netQuantityUnit: netQuantity?.unit ?? null,
      });
    }
  }

  for (const batch of s.stockBatches) emit(t, 'stockBatches', batch);
  for (const movement of s.movements) emit(t, 'stockMovements', movement as unknown as SharedRow);
  for (const customer of s.customers) emit(t, 'customers', { ...customer, updatedAt: customer.createdAt });
  for (const entry of s.customerLedger) emit(t, 'customerLedger', entry);

  for (const invoice of s.invoices as InvoiceRecord[]) {
    const { lines, payments, customer, ...row } = invoice as InvoiceRecord & { customer?: { id: string } | null };
    emit(t, 'invoices', {
      ...row,
      customerId: customer?.id ?? null,
      customer: customer ?? null,
      placeOfSupply: invoice.placeOfSupply ?? placeOfSupplyFor(invoice),
    });
    for (const [index, line] of lines.entries()) {
      const originalLineId = invoice.originalInvoiceId && line.originalLineIndex !== undefined
        ? await deriveSharedId('invoiceLine', invoice.originalInvoiceId, String(line.originalLineIndex))
        : null;
      emit(t, 'invoiceLines', { ...line, id: await deriveSharedId('invoiceLine', invoice.id, String(index)), invoiceId: invoice.id, originalLineId });
    }
    for (const [index, payment] of payments.entries()) {
      emit(t, 'payments', { ...payment, id: await deriveSharedId('payment', invoice.id, String(index)), invoiceId: invoice.id, createdAt: invoice.createdAt });
    }
  }

  for (const supplier of s.suppliers) emit(t, 'suppliers', { ...supplier, updatedAt: supplier.createdAt });

  for (const order of s.purchaseOrders as PurchaseOrder[]) {
    const { lines, ...row } = order;
    emit(t, 'purchaseOrders', { ...row, updatedAt: order.createdAt });
    for (const line of lines) emit(t, 'purchaseOrderLines', { ...line, orderId: order.id });
  }

  for (const receipt of s.purchaseReceipts as PurchaseReceipt[]) {
    const { lines, ...row } = receipt;
    emit(t, 'receipts', row);
    for (const [index, line] of lines.entries()) {
      emit(t, 'receiptLines', { ...line, id: await deriveSharedId('receiptLine', receipt.id, String(index)), receiptId: receipt.id });
    }
  }

  for (const closing of s.dayClosings as DayClosing[]) {
    const { figures, ...row } = closing;
    const { date, ...rest } = figures;
    emit(t, 'dayClosings', { ...row, businessDate: date, ...rest });
  }

  for (const entry of s.loyaltyLedger) emit(t, 'loyaltyLedger', entry);

  for (const bill of s.heldBills as HeldBill[]) {
    const { lines, ...row } = bill;
    emit(t, 'heldBills', row);
    for (const [index, line] of lines.entries()) {
      emit(t, 'heldBillLines', { id: await deriveSharedId('heldBillLine', bill.id, String(index)), heldBillId: bill.id, sortOrder: index, snapshot: line });
    }
  }

  for (const quotation of s.quotations as QuotationRecord[]) {
    const { cart, ...row } = quotation as QuotationRecord & { cart: { lines: unknown[] } & Record<string, unknown> };
    const { lines, ...cartHeader } = cart;
    emit(t, 'quotations', { ...row, customerId: (row as { customerId?: string | null }).customerId ?? (cart.customerId || null) });
    for (const [index, line] of lines.entries()) {
      emit(t, 'quotationLines', { id: await deriveSharedId('quotationLine', quotation.id, String(index)), quotationId: quotation.id, sortOrder: index, snapshot: line });
    }
    t.extensions.push({ namespace: WEB_NAMESPACE, ownerType: 'quotation', ownerId: quotation.id, key: 'cart', value: cartHeader });
  }

  for (const count of s.stockCounts as StockCountRecord[]) {
    const { lines, ...row } = count;
    emit(t, 'stockCounts', row);
    for (const [index, line] of lines.entries()) {
      emit(t, 'stockCountLines', {
        id: await deriveSharedId('stockCountLine', count.id, String(index)),
        stockCountId: count.id,
        variantId: line.variantId,
        expectedQuantity: line.expected,
        countedQuantity: line.counted,
      });
    }
  }

  for (const entry of s.auditLog) emit(t, 'auditLog', entry);

  return {
    format: 'auxo-backup',
    version: 1,
    sharedModelVersion: 1,
    createdAt: input.createdAt,
    source: { platform: 'web', appVersion: input.appVersion },
    shopName: s.shop?.storeName ?? '',
    tables: t,
    photos: input.photos,
  };
}

function groupBy(rows: SharedRow[], key: string): Map<string, SharedRow[]> {
  const groups = new Map<string, SharedRow[]>();
  for (const row of rows) {
    const id = String(row[key]);
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  return groups;
}

/** Rebuilds the web snapshot from a shared payload. Throws if the payload is not version 1 or a table is missing. */
export function fromSharedPayload(payload: SharedPayload): SharedSourceSnapshot {
  if (payload.format !== 'auxo-backup' || payload.version !== 1 || payload.sharedModelVersion !== 1) {
    throw new Error('This backup uses a format this version of AUXO cannot read.');
  }
  const t = payload.tables;
  for (const name of SHARED_TABLE_NAMES) if (!Array.isArray(t[name])) throw new Error(`Backup table ${name} is missing.`);

  // Web-only fields and quotation carts, keyed by table and row ID.
  const extras = new Map<string, SharedRow>();
  const carts = new Map<string, Record<string, unknown>>();
  for (const e of t.extensions) {
    if (e.namespace !== WEB_NAMESPACE) continue;
    const owner = `${String(e.ownerType)}|${String(e.ownerId)}`;
    if (e.key === FIELDS_KEY) extras.set(owner, e.value as SharedRow);
    if (e.ownerType === 'quotation' && e.key === 'cart') carts.set(String(e.ownerId), e.value as Record<string, unknown>);
  }
  // Put web-only fields back, and return the row without spec-only helper keys.
  const restore = (table: SharedTableName, row: SharedRow, drop: readonly string[] = []): SharedRow => {
    const merged = { ...row, ...(extras.get(`${table}|${String(row.id)}`) ?? {}) };
    return withoutKeys(merged, drop);
  };

  const variantsByProduct = groupBy(t.variants, 'productId');
  const subsByCategory = groupBy(t.subcategories, 'categoryId');
  const linesByInvoice = groupBy(t.invoiceLines, 'invoiceId');
  const paymentsByInvoice = groupBy(t.payments, 'invoiceId');
  const orderLinesByOrder = groupBy(t.purchaseOrderLines, 'orderId');
  const receiptLinesByReceipt = groupBy(t.receiptLines, 'receiptId');
  const heldLinesByBill = groupBy(t.heldBillLines, 'heldBillId');
  const quoteLinesByQuote = groupBy(t.quotationLines, 'quotationId');
  const countLinesByCount = groupBy(t.stockCountLines, 'stockCountId');

  const settingsRow = t.settings.find(row => row.id === 'shop');
  const shopRow = settingsRow ? restore('settings', settingsRow, ['id']) : null;
  let shop: SharedSourceSnapshot['shop'] = null;
  if (shopRow) {
    if ('receiptShowTaxBreakdown' in shopRow) {
      shopRow.receiptShowTaxBreakup = shopRow.receiptShowTaxBreakdown;
      delete shopRow.receiptShowTaxBreakdown;
    }
    shop = shopRow as unknown as SharedSourceSnapshot['shop'];
  }
  const rulesRow = t.loyaltySettings.find(row => row.id === 'rules');
  const loyaltyRules = (rulesRow ? restore('loyaltySettings', rulesRow, ['id']) : {}) as unknown as SharedSourceSnapshot['loyaltyRules'];

  const products = t.products.map(row => {
    const variants = (variantsByProduct.get(String(row.id)) ?? []).map(v => {
      const variant = restore('variants', v, ['productId', 'netQuantityMilli', 'netQuantityUnit', 'stockQuantity']);
      variant.stock = v.stockQuantity;
      if (v.netQuantityMilli !== null && v.netQuantityMilli !== undefined) {
        variant.netQuantity = { amountMilli: v.netQuantityMilli, unit: v.netQuantityUnit };
      }
      return variant;
    });
    return { ...restore('products', row), variants } as unknown as Product;
  });

  const invoices = t.invoices.map(row => {
    const invoice = restore('invoices', row, ['customerId', 'savingsPaise']);
    return {
      ...invoice,
      lines: (linesByInvoice.get(String(row.id)) ?? []).map(l => restore('invoiceLines', l, ['id', 'invoiceId', 'originalLineId'])),
      payments: (paymentsByInvoice.get(String(row.id)) ?? []).map(p => restore('payments', p, ['id', 'invoiceId', 'createdAt'])),
    };
  });

  return {
    shop,
    loyaltyRules,
    categories: t.categories.map(row => ({
      ...restore('categories', row),
      subcategories: (subsByCategory.get(String(row.id)) ?? []).map(sub => restore('subcategories', sub, ['categoryId'])),
    })) as unknown as SharedSourceSnapshot['categories'],
    products: products as unknown as SharedSourceSnapshot['products'],
    stockBatches: t.stockBatches.map(row => restore('stockBatches', row)) as unknown as SharedSourceSnapshot['stockBatches'],
    movements: t.stockMovements.map(row => restore('stockMovements', row)) as unknown as SharedSourceSnapshot['movements'],
    customers: t.customers.map(row => restore('customers', row, ['updatedAt'])) as unknown as SharedSourceSnapshot['customers'],
    customerLedger: t.customerLedger.map(row => restore('customerLedger', row)) as unknown as SharedSourceSnapshot['customerLedger'],
    invoices: invoices as unknown as SharedSourceSnapshot['invoices'],
    suppliers: t.suppliers.map(row => restore('suppliers', row, ['updatedAt'])) as unknown as SharedSourceSnapshot['suppliers'],
    purchaseOrders: t.purchaseOrders.map(row => ({
      ...restore('purchaseOrders', row, ['updatedAt']),
      lines: (orderLinesByOrder.get(String(row.id)) ?? []).map(l => restore('purchaseOrderLines', l, ['orderId'])),
    })) as unknown as SharedSourceSnapshot['purchaseOrders'],
    purchaseReceipts: t.receipts.map(row => ({
      ...restore('receipts', row),
      lines: (receiptLinesByReceipt.get(String(row.id)) ?? []).map(l => restore('receiptLines', l, ['id', 'receiptId'])),
    })) as unknown as SharedSourceSnapshot['purchaseReceipts'],
    dayClosings: t.dayClosings.map(row => {
      const merged = restore('dayClosings', row);
      const figureKeys = ['bills', 'returns', 'netSalesPaise', 'cashReceivedPaise', 'cashRefundedPaise', 'cashFromAccountsPaise', 'upiNetPaise', 'cardNetPaise', 'onAccountNetPaise'];
      const figures = { date: merged.businessDate, ...Object.fromEntries(figureKeys.map(k => [k, merged[k]])) };
      return { ...withoutKeys(merged, ['businessDate', ...figureKeys]), figures } as unknown as DayClosing;
    }) as unknown as SharedSourceSnapshot['dayClosings'],
    loyaltyLedger: t.loyaltyLedger.map(row => restore('loyaltyLedger', row)) as unknown as SharedSourceSnapshot['loyaltyLedger'],
    heldBills: t.heldBills.map(row => ({
      ...restore('heldBills', row),
      lines: (heldLinesByBill.get(String(row.id)) ?? [])
        .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
        .map(l => l.snapshot),
    })) as unknown as SharedSourceSnapshot['heldBills'],
    quotations: t.quotations.map(row => {
      const cartHeader = carts.get(String(row.id)) ?? {};
      const lines = (quoteLinesByQuote.get(String(row.id)) ?? [])
        .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
        .map(l => l.snapshot);
      const quotation = restore('quotations', row);
      if (quotation.customerId === (cartHeader as { customerId?: unknown }).customerId) delete quotation.customerId;
      return { ...quotation, cart: { ...cartHeader, lines } };
    }) as unknown as SharedSourceSnapshot['quotations'],
    stockCounts: t.stockCounts.map(row => ({
      ...restore('stockCounts', row),
      lines: (countLinesByCount.get(String(row.id)) ?? []).map(l => ({
        variantId: l.variantId,
        expected: l.expectedQuantity,
        counted: l.countedQuantity,
      })),
    })) as unknown as SharedSourceSnapshot['stockCounts'],
    auditLog: t.auditLog.map(row => restore('auditLog', row)) as unknown as SharedSourceSnapshot['auditLog'],
  };
}
