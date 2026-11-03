import { describe, expect, it } from 'vitest';
import { validateSharedPayload } from './sharedValidate';
import { SHARED_TABLE_NAMES, type SharedPayload } from './sharedPayload';

const SHOP_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const VARIANT_ID = '33333333-3333-4333-8333-333333333333';
const INVOICE_ID = '44444444-4444-4444-8444-444444444444';
const CUSTOMER_ID = '55555555-5555-4555-8555-555555555555';

function emptyTables(): Record<string, unknown[]> {
  return Object.fromEntries(SHARED_TABLE_NAMES.map(name => [name, []]));
}

/** A complete, valid payload: one shop, one product with a variant, one invoice with a line and a payment. */
function validPayload(): SharedPayload {
  const tables = emptyTables();
  tables.settings = [{
    id: 'shop', storeName: 'Sample', address: 'Road', gstin: '', stateCode: '19', gstRegistered: false, pricesIncludeTax: true,
    roundOff: true, invoicePrefix: 'INV', creditNotePrefix: 'CN', phone: '', fssai: '', upiId: '', upiPayeeName: '',
    receiptPaper: 'THERMAL_80', receiptFooter: 'Thanks', receiptLanguage: 'en', receiptShowHsn: true, receiptShowTaxBreakdown: true,
    receiptShowCustomer: true, receiptShowSavings: true, receiptShowBarcode: true, receiptShowUpiQr: true,
    employeeDiscountLimitBp: 0, expiryWarningDays: 30, metalRatesPaise: {},
  }];
  tables.loyaltySettings = [{ id: 'rules', enabled: false, spendPerPointPaise: '500', pointValuePaise: '100' }];
  tables.products = [{ id: PRODUCT_ID, name: 'Mug', category: 'PACKAGED_FOOD', brand: null, createdAt: 1, updatedAt: 1, stockUnit: 'UNIT', gstRateBasisPoints: 0, apparelGst: false, available: true, tracksStock: true }];
  tables.variants = [{ id: VARIANT_ID, productId: PRODUCT_ID, sku: 'M1', barcode: '890', size: '', colour: '', pricePaise: '1000', mrpPaise: null, costPaise: null, stockQuantity: 3, lowStockThreshold: 0, reorderQuantity: 0 }];
  tables.customers = [{ id: CUSTOMER_ID, name: 'Asha', balancePaise: '0', createdAt: 1, updatedAt: 1 }];
  tables.invoices = [{ id: INVOICE_ID, number: 'INV/26-27/00001', type: 'SALE', createdAt: 2, seller: { storeName: 'Sample' }, buyer: null, customerId: null, originalInvoiceId: null, originalInvoiceNumber: null, note: null, returnReason: null, placeOfSupply: '19', gstRegistered: false, pricesIncludeTax: true, interState: false, subtotalPaise: '1000', lineDiscountPaise: '0', billDiscountPaise: '0', discountPaise: '0', billDiscountReason: null, loyaltyPointsRedeemed: 0, loyaltyDiscountPaise: '0', taxablePaise: '1000', cgstPaise: '0', sgstPaise: '0', igstPaise: '0', roundOffPaise: '0', roundedToRupee: false, grandTotalPaise: '1000', savingsPaise: '0' }];
  tables.invoiceLines = [{ id: '66666666-6666-4666-8666-666666666666', invoiceId: INVOICE_ID, productId: PRODUCT_ID, variantId: VARIANT_ID, originalLineId: null, name: 'Mug', variantLabel: '', barcode: '890', hsnCode: null, customItem: false, quantity: 1, stockUnit: 'UNIT', unitPricePaise: '1000', mrpPaise: null, lineDiscountPaise: '0', billDiscountSharePaise: '0', discountPaise: '0', discountReason: null, taxablePaise: '1000', gstRateBasisPoints: 0, cgstPaise: '0', sgstPaise: '0', igstPaise: '0', totalPaise: '1000', returnedQuantity: 0 }];
  tables.payments = [{ id: '77777777-7777-4777-8777-777777777777', invoiceId: INVOICE_ID, method: 'CASH', kind: 'PAYMENT', amountPaise: '1000', reference: null, tenderedPaise: '1000', changePaise: '0', createdAt: 2 }];
  return { format: 'auxo-backup', version: 1, sharedModelVersion: 1, createdAt: 3, source: { platform: 'web', appVersion: 'test' }, shopName: 'Sample', tables: tables as unknown as SharedPayload['tables'], photos: [] };
}

const clone = (p: SharedPayload): SharedPayload => JSON.parse(JSON.stringify(p));

describe('shared payload validator', () => {
  it('accepts a complete, consistent payload', () => {
    expect(validateSharedPayload(validPayload())).toEqual({ valid: true, problems: [] });
  });

  it('rejects a missing table', () => {
    const p = clone(validPayload());
    delete (p.tables as Record<string, unknown>).variants;
    const result = validateSharedPayload(p);
    expect(result.valid).toBe(false);
    expect(result.problems.some(x => x.table === 'variants')).toBe(true);
  });

  it('rejects a missing required field', () => {
    const p = clone(validPayload());
    delete (p.tables.products[0] as Record<string, unknown>).available;
    expect(validateSharedPayload(p).problems).toContainEqual(expect.objectContaining({ table: 'products', field: 'available', message: 'required field is missing' }));
  });

  it('rejects money written as a number or decimal', () => {
    const p = clone(validPayload());
    (p.tables.invoices[0] as Record<string, unknown>).grandTotalPaise = 1000;
    (p.tables.payments[0] as Record<string, unknown>).amountPaise = '10.50';
    const messages = validateSharedPayload(p).problems.map(x => `${x.table}.${x.field}`);
    expect(messages).toEqual(expect.arrayContaining(['invoices.grandTotalPaise', 'payments.amountPaise']));
  });

  it('rejects a reference to a row that is not in the file', () => {
    const p = clone(validPayload());
    (p.tables.variants[0] as Record<string, unknown>).productId = '99999999-9999-4999-8999-999999999999';
    expect(validateSharedPayload(p).problems).toContainEqual(expect.objectContaining({ table: 'variants', field: 'productId' }));
  });

  it('rejects duplicate IDs and duplicate invoice numbers', () => {
    const p = clone(validPayload());
    p.tables.products.push({ ...p.tables.products[0] } as never);
    const copy = { ...(p.tables.invoices[0] as Record<string, unknown>), id: '88888888-8888-4888-8888-888888888888' };
    p.tables.invoices.push(copy as never);
    const messages = validateSharedPayload(p).problems.map(x => `${x.table}.${x.field}:${x.message}`);
    expect(messages).toContain('products.id:duplicate ID');
    expect(messages).toContain('invoices.number:duplicate number');
  });

  it('rejects a photo reference when the photo is not in the file', () => {
    const p = clone(validPayload());
    (p.tables.products[0] as Record<string, unknown>).photoId = '12121212-1212-4121-8121-121212121212';
    expect(validateSharedPayload(p).problems).toContainEqual(expect.objectContaining({ table: 'products', field: 'photoId' }));
  });

  it('rejects a payload from another version', () => {
    const p = clone(validPayload());
    (p as unknown as { version: number }).version = 2;
    expect(validateSharedPayload(p).problems).toContainEqual(expect.objectContaining({ table: 'file', field: 'version' }));
  });

  it('rejects something that is not an object', () => {
    expect(validateSharedPayload('nope').valid).toBe(false);
  });
});

import { toSharedPayload } from './sharedPayload';
import { sampleSnapshot } from './sharedFixtures';
import { deriveSharedId } from './sharedPayload';

/** Replaces the sample's short test IDs with UUIDs, the same way the real app creates them. */
async function withUuidIds<T>(value: T): Promise<T> {
  const idKeys = new Set(['id', 'productId', 'variantId', 'customerId', 'invoiceId', 'originalInvoiceId', 'categoryId', 'orderId', 'orderLineId', 'supplierId', 'receiptId', 'heldBillId', 'quotationId', 'stockCountId', 'batchId', 'sourceInvoiceId', 'convertedInvoiceId', 'photoId', 'preferredSupplierId', 'stockCountId']);
  const ids = new Map<string, string>();
  const collect = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) {
      if (idKeys.has(k) && typeof v === 'string' && v) ids.set(v, '');
      collect(v);
    }
  };
  collect(value);
  for (const old of ids.keys()) ids.set(old, await deriveSharedId('sample', old));
  const rewrite = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rewrite);
    if (typeof node === 'string') return ids.get(node) ?? node;
    if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, rewrite(v)]));
    return node;
  };
  return rewrite(value) as T;
}

describe('a realistic export', () => {
  it('passes the checker with no problems once IDs are UUIDs', async () => {
    const snapshot = await withUuidIds(sampleSnapshot());
    const payload = await toSharedPayload({ snapshot: snapshot as never, photos: [], createdAt: 1, appVersion: 'test' });
    const result = validateSharedPayload(JSON.parse(JSON.stringify(payload)));
    expect(result.problems).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
