// Maps the web app's business snapshot to and from the shared auxo-backup v1 table layout
// (docs/BACKUP_FORMAT.md section 2). Pure functions: no storage, no encryption here.
//
// Rules used:
// - Accounts, password material and sessions are never mapped (spec section 1 and 3).
// - Nested child arrays (invoice lines and payments, purchase lines, receipt lines, held bill and quotation
//   lines, stock count lines, product variants, category subcategories) become their own tables with a
//   parent ID. The web app does not store IDs for most of these, so each gets a stable ID derived from its
//   parent and position. Array order in each table is the order used on import.
// - Web-only quotation cart fields are kept as an org.auxo.web extension record.

import type { BusinessSnapshot } from './backup';
import type { Product, ProductVariant } from './catalog';
import type { InvoiceRecord } from './billing';
import type { ShopCategory, ShopSubcategory } from './categories';
import type { QuotationRecord } from './quotations';
import type { StockCountRecord } from './stockCount';
import type { HeldBill } from './heldBills';
import type { PurchaseOrder, PurchaseReceipt } from './purchasing';
import type { DayClosing } from './dayEnd';

export const SHARED_TABLE_NAMES = [
  'settings', 'categories', 'subcategories', 'products', 'variants', 'stockBatches', 'stockMovements',
  'customers', 'customerLedger', 'invoices', 'invoiceLines', 'payments', 'suppliers', 'purchaseOrders',
  'purchaseOrderLines', 'receipts', 'receiptLines', 'dayClosings', 'loyaltySettings', 'loyaltyLedger',
  'heldBills', 'heldBillLines', 'quotations', 'quotationLines', 'stockCounts', 'stockCountLines',
  'auditLog', 'numberSequences', 'extensions',
] as const;
export type SharedTableName = (typeof SHARED_TABLE_NAMES)[number];

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

/** Splits a web snapshot into the shared table layout. */
export async function toSharedPayload(input: {
  snapshot: SharedSourceSnapshot;
  photos: SharedPhoto[];
  createdAt: number;
  appVersion: string;
}): Promise<SharedPayload> {
  const s = input.snapshot;
  const t = emptyTables();
  const extensions = t.extensions;

  if (s.shop) t.settings.push({ id: 'shop', ...s.shop });
  t.loyaltySettings.push({ id: 'rules', ...s.loyaltyRules });

  for (const category of s.categories as ShopCategory[]) {
    const { subcategories = [], ...row } = category;
    t.categories.push(row);
    for (const sub of subcategories as ShopSubcategory[]) t.subcategories.push({ ...sub, categoryId: category.id });
  }

  for (const product of s.products as Product[]) {
    const { variants, ...row } = product;
    t.products.push(row);
    for (const variant of variants as ProductVariant[]) t.variants.push({ ...variant, productId: product.id });
  }

  t.stockBatches.push(...(s.stockBatches as unknown as SharedRow[]));
  t.stockMovements.push(...(s.movements as unknown as SharedRow[]));
  t.customers.push(...(s.customers as unknown as SharedRow[]));
  t.customerLedger.push(...(s.customerLedger as unknown as SharedRow[]));

  for (const invoice of s.invoices as InvoiceRecord[]) {
    const { lines, payments, ...row } = invoice;
    t.invoices.push(row);
    for (const [index, line] of lines.entries()) {
      t.invoiceLines.push({ ...line, id: await deriveSharedId('invoiceLine', invoice.id, String(index)), invoiceId: invoice.id });
    }
    for (const [index, payment] of payments.entries()) {
      t.payments.push({ ...payment, id: await deriveSharedId('payment', invoice.id, String(index)), invoiceId: invoice.id });
    }
  }

  t.suppliers.push(...(s.suppliers as unknown as SharedRow[]));

  for (const order of s.purchaseOrders as PurchaseOrder[]) {
    const { lines, ...row } = order;
    t.purchaseOrders.push(row);
    t.purchaseOrderLines.push(...lines.map(line => ({ ...line, orderId: order.id })));
  }

  for (const receipt of s.purchaseReceipts as PurchaseReceipt[]) {
    const { lines, ...row } = receipt;
    t.receipts.push(row);
    for (const [index, line] of lines.entries()) {
      t.receiptLines.push({ ...line, id: await deriveSharedId('receiptLine', receipt.id, String(index)), receiptId: receipt.id });
    }
  }

  for (const closing of s.dayClosings as DayClosing[]) {
    const { figures, ...row } = closing;
    const { date, ...rest } = figures;
    t.dayClosings.push({ ...row, businessDate: date, ...rest });
  }

  t.loyaltyLedger.push(...(s.loyaltyLedger as unknown as SharedRow[]));

  for (const bill of s.heldBills as HeldBill[]) {
    const { lines, ...row } = bill;
    t.heldBills.push(row);
    for (const [index, line] of lines.entries()) {
      t.heldBillLines.push({ id: await deriveSharedId('heldBillLine', bill.id, String(index)), heldBillId: bill.id, sortOrder: index, snapshot: line });
    }
  }

  for (const quotation of s.quotations as QuotationRecord[]) {
    const { cart, ...row } = quotation as QuotationRecord & { cart: { lines: unknown[] } & Record<string, unknown> };
    const { lines, ...cartHeader } = cart;
    t.quotations.push(row);
    for (const [index, line] of lines.entries()) {
      t.quotationLines.push({ id: await deriveSharedId('quotationLine', quotation.id, String(index)), quotationId: quotation.id, sortOrder: index, snapshot: line });
    }
    extensions.push({ namespace: WEB_NAMESPACE, ownerType: 'quotation', ownerId: quotation.id, key: 'cart', value: cartHeader });
  }

  for (const count of s.stockCounts as StockCountRecord[]) {
    const { lines, ...row } = count;
    t.stockCounts.push(row);
    for (const [index, line] of lines.entries()) {
      t.stockCountLines.push({
        id: await deriveSharedId('stockCountLine', count.id, String(index)),
        stockCountId: count.id,
        variantId: line.variantId,
        expectedQuantity: line.expected,
        countedQuantity: line.counted,
      });
    }
  }

  t.auditLog.push(...(s.auditLog as unknown as SharedRow[]));

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

function without(row: SharedRow, ...keys: string[]): SharedRow {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

/** Rebuilds the web snapshot from a shared payload. Throws if the payload is not version 1. */
export function fromSharedPayload(payload: SharedPayload): SharedSourceSnapshot {
  if (payload.format !== 'auxo-backup' || payload.version !== 1 || payload.sharedModelVersion !== 1) {
    throw new Error('This backup uses a format this version of AUXO cannot read.');
  }
  const t = payload.tables;
  for (const name of SHARED_TABLE_NAMES) if (!Array.isArray(t[name])) throw new Error(`Backup table ${name} is missing.`);

  const variantsByProduct = groupBy(t.variants, 'productId');
  const subsByCategory = groupBy(t.subcategories, 'categoryId');
  const linesByInvoice = groupBy(t.invoiceLines, 'invoiceId');
  const paymentsByInvoice = groupBy(t.payments, 'invoiceId');
  const orderLinesByOrder = groupBy(t.purchaseOrderLines, 'orderId');
  const receiptLinesByReceipt = groupBy(t.receiptLines, 'receiptId');
  const heldLinesByBill = groupBy(t.heldBillLines, 'heldBillId');
  const quoteLinesByQuote = groupBy(t.quotationLines, 'quotationId');
  const countLinesByCount = groupBy(t.stockCountLines, 'stockCountId');
  const cartHeaders = new Map(t.extensions
    .filter(e => e.namespace === WEB_NAMESPACE && e.ownerType === 'quotation' && e.key === 'cart')
    .map(e => [String(e.ownerId), e.value as Record<string, unknown>]));

  const settings = t.settings.find(row => row.id === 'shop');
  const { id: _shopId, ...shop } = settings ?? { id: 'shop' };
  const rules = t.loyaltySettings.find(row => row.id === 'rules');
  const { id: _rulesId, ...loyaltyRules } = rules ?? { id: 'rules' };

  return {
    shop: settings ? (shop as unknown as SharedSourceSnapshot['shop']) : null,
    loyaltyRules: loyaltyRules as unknown as SharedSourceSnapshot['loyaltyRules'],
    categories: t.categories.map(row => ({
      ...(row as object),
      subcategories: (subsByCategory.get(String(row.id)) ?? []).map(sub => without(sub, 'categoryId')),
    })) as unknown as SharedSourceSnapshot['categories'],
    products: t.products.map(row => ({
      ...(row as object),
      variants: (variantsByProduct.get(String(row.id)) ?? []).map(v => without(v, 'productId')),
    })) as unknown as SharedSourceSnapshot['products'],
    stockBatches: t.stockBatches as unknown as SharedSourceSnapshot['stockBatches'],
    movements: t.stockMovements as unknown as SharedSourceSnapshot['movements'],
    customers: t.customers as unknown as SharedSourceSnapshot['customers'],
    customerLedger: t.customerLedger as unknown as SharedSourceSnapshot['customerLedger'],
    invoices: t.invoices.map(row => ({
      ...(row as object),
      lines: (linesByInvoice.get(String(row.id)) ?? []).map(l => without(l, 'id', 'invoiceId')),
      payments: (paymentsByInvoice.get(String(row.id)) ?? []).map(p => without(p, 'id', 'invoiceId')),
    })) as unknown as SharedSourceSnapshot['invoices'],
    suppliers: t.suppliers as unknown as SharedSourceSnapshot['suppliers'],
    purchaseOrders: t.purchaseOrders.map(row => ({
      ...(row as object),
      lines: (orderLinesByOrder.get(String(row.id)) ?? []).map(l => without(l, 'orderId')),
    })) as unknown as SharedSourceSnapshot['purchaseOrders'],
    purchaseReceipts: t.receipts.map(row => ({
      ...(row as object),
      lines: (receiptLinesByReceipt.get(String(row.id)) ?? []).map(l => without(l, 'id', 'receiptId')),
    })) as unknown as SharedSourceSnapshot['purchaseReceipts'],
    dayClosings: t.dayClosings.map(row => {
      const { businessDate, ...rest } = row;
      const figureKeys = ['bills', 'returns', 'netSalesPaise', 'cashReceivedPaise', 'cashRefundedPaise', 'cashFromAccountsPaise', 'upiNetPaise', 'cardNetPaise', 'onAccountNetPaise'];
      const figures = { date: businessDate, ...Object.fromEntries(figureKeys.map(k => [k, rest[k]])) };
      const parent = without(rest, ...figureKeys);
      return { ...parent, figures } as unknown as DayClosing;
    }) as unknown as SharedSourceSnapshot['dayClosings'],
    loyaltyLedger: t.loyaltyLedger as unknown as SharedSourceSnapshot['loyaltyLedger'],
    heldBills: t.heldBills.map(row => ({
      ...(row as object),
      lines: (heldLinesByBill.get(String(row.id)) ?? [])
        .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
        .map(l => l.snapshot),
    })) as unknown as SharedSourceSnapshot['heldBills'],
    quotations: t.quotations.map(row => {
      const header = cartHeaders.get(String(row.id)) ?? {};
      const lines = (quoteLinesByQuote.get(String(row.id)) ?? [])
        .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
        .map(l => l.snapshot);
      return { ...(row as object), cart: { ...header, lines } };
    }) as unknown as SharedSourceSnapshot['quotations'],
    stockCounts: t.stockCounts.map(row => ({
      ...(row as object),
      lines: (countLinesByCount.get(String(row.id)) ?? []).map(l => ({
        variantId: l.variantId,
        expected: l.expectedQuantity,
        counted: l.countedQuantity,
      })),
    })) as unknown as SharedSourceSnapshot['stockCounts'],
    auditLog: t.auditLog as unknown as SharedSourceSnapshot['auditLog'],
  };
}
