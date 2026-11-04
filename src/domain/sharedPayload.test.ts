import { describe, expect, it } from 'vitest';
import { placeOfSupplyFor } from './billing';
import {
  SHARED_TABLE_NAMES,
  deriveSharedId,
  fromSharedPayload,
  toSharedPayload,
  type SharedPayload,
  type SharedSourceSnapshot,
} from './sharedPayload';

// A small but complete sample shop: one of every record kind with nested children.
function sampleSnapshot(): SharedSourceSnapshot {
  const variant = { id: 'v-1', size: 'M', colour: 'Blue', sku: 'SKU1', barcode: '8901', pricePaise: '49900', mrpPaise: '59900', costPaise: '30000', stock: 12, lowStockThreshold: 3, reorderQuantity: 10 };
  const line = { productId: 'p-1', variantId: 'v-1', name: 'Shirt', variantLabel: 'M / Blue', barcode: '8901', quantity: 2, stockUnit: 'UNIT', unitPricePaise: '49900', lineDiscountPaise: '0', billDiscountSharePaise: '0', discountPaise: '0', discountReason: null, taxablePaise: '99800', gstRateBasisPoints: 500, cgstPaise: '2495', sgstPaise: '2495', igstPaise: '0', totalPaise: '104790', returnedQuantity: 0 };
  return {
    shop: { storeName: 'Sample Shop', address: 'Main Road', gstin: '', stateCode: '19', gstRegistered: true, pricesIncludeTax: true, roundOff: true, invoicePrefix: 'INV', creditNotePrefix: 'CN' },
    loyaltyRules: { enabled: true, spendPerPointPaise: '500', pointValuePaise: '100' },
    categories: [{ id: 'cat-1', name: 'Apparel', profile: 'GARMENT', enabled: true, sortOrder: 1, builtIn: true, subcategories: [{ id: 'sub-1', name: 'Shirts', sortOrder: 1 }] }],
    products: [{ id: 'p-1', name: 'Shirt', category: 'GARMENT', categoryId: 'cat-1', brand: null, createdAt: 1000, updatedAt: 2000, stockUnit: 'UNIT', tracksStock: true, apparelGst: true, variants: [variant, { ...variant, id: 'v-2', size: 'L' }] }],
    stockBatches: [],
    movements: [{ id: 'm-1', variantId: 'v-1', quantityChange: 12, reason: 'INITIAL', note: null, createdAt: 1000 }],
    customers: [{ id: 'c-1', name: 'Asha', phone: '9000000001', creditLimitPaise: '100000', balancePaise: '-5000', onHold: false, createdAt: 1000 }],
    customerLedger: [{ id: 'l-1', customerId: 'c-1', type: 'PAYMENT', amountPaise: '5000', invoiceId: null, invoiceNumber: null, method: 'CASH', reference: null, createdAt: 3000, note: null }],
    invoices: [{
      id: 'i-1', number: 'INV/26-27/00001', createdAt: 4000, type: 'SALE', placeOfSupply: '19', lines: [line, { ...line, variantId: 'v-2', quantity: 1 }],
      subtotalPaise: '149700', lineDiscountPaise: '0', billDiscountPaise: '0', discountPaise: '0', billDiscountReason: null,
      taxablePaise: '142571', cgstPaise: '3571', sgstPaise: '3571', igstPaise: '0', roundOffPaise: '0', roundedToRupee: false, grandTotalPaise: '149700',
      gstRegistered: true, pricesIncludeTax: true, interState: false,
      seller: { storeName: 'Sample Shop', address: 'Main Road', gstin: '', stateCode: '19' },
      customer: { id: 'c-1', name: 'Asha', phone: '9000000001' },
      payments: [{ method: 'CASH', amountPaise: '149700', reference: null, tenderedPaise: '150000', changePaise: '300', kind: 'PAYMENT' }],
      originalInvoiceId: null, originalInvoiceNumber: null, returnReason: null,
    }],
    suppliers: [{ id: 's-1', name: 'Fabric Co', contactPerson: null, phone: null, email: null, gstin: null, stateCode: null, address: null, notes: null, active: true, createdAt: 1000, updatedAt: 1000 }],
    purchaseOrders: [{ id: 'po-1', number: 'PO/26-27/00001', supplierId: 's-1', supplierName: 'Fabric Co', status: 'ORDERED', createdAt: 1000, expectedDate: '2026-12-01', note: null, lines: [{ id: 'pol-1', variantId: 'v-1', productName: 'Shirt', variantLabel: 'M / Blue', stockUnit: 'UNIT', quantityOrdered: 10, quantityReceived: 0, unitCostPaise: '30000' }] }],
    purchaseReceipts: [{ id: 'r-1', number: 'GRN/26-27/00001', supplierId: 's-1', supplierName: 'Fabric Co', orderId: 'po-1', orderNumber: 'PO/26-27/00001', supplierInvoiceNumber: 'FC-1', receivedAt: 5000, note: null, totalPaise: '300000', requestId: 'req-1', lines: [{ variantId: 'v-1', orderLineId: 'pol-1', productName: 'Shirt', variantLabel: 'M / Blue', stockUnit: 'UNIT', quantity: 10, unitCostPaise: '30000', batchNumber: null, expiryDate: null }] }],
    dayClosings: [{ id: 'd-1', figures: { date: '2026-11-02', bills: 1, returns: 0, netSalesPaise: '149700', cashReceivedPaise: '149700', cashRefundedPaise: '0', cashFromAccountsPaise: '0', upiNetPaise: '0', cardNetPaise: '0', onAccountNetPaise: '0' }, countedCashPaise: '149700', note: null, closedAt: 6000, closedBy: 'Owner' }],
    loyaltyLedger: [{ id: 'ly-1', customerId: 'c-1', type: 'EARNED', points: 299, invoiceId: 'i-1', sourceInvoiceId: null, createdAt: 4000, note: null }],
    heldBills: [{ id: 'h-1', label: 'Table 2', createdAt: 7000, updatedAt: 7000, itemCount: 1, totalPaise: '49900', tableNumber: 2, tokenNumber: null, lines: [{ ...line, quantity: 1 }], discount: { kind: 'AMOUNT', value: '0', reason: '' }, interState: false, customerId: '', buyerName: '', buyerPhone: '', buyerGstin: '' }],
    quotations: [{ id: 'q-1', number: 'QT/26-27/00001', createdAt: 8000, validUntil: '2026-11-30', customerName: 'Asha', customerPhone: '9000000001', itemCount: 2, totalPaise: '149700', status: 'OPEN', convertedInvoiceId: null, cart: { lines: [line], discount: { kind: 'PERCENT', value: '5', reason: 'Festive' }, interState: false, customerId: 'c-1', buyerName: 'Asha', buyerPhone: '9000000001', buyerGstin: '' } }] as unknown as SharedSourceSnapshot['quotations'],
    stockCounts: [{ id: 'sc-1', startedAt: 9000, status: 'POSTED', lines: [{ variantId: 'v-1', expected: 12, counted: 11 }], finishedAt: 9500, reason: 'ROUTINE', note: null, adjustedCount: 1, matchedCount: 0 }] as unknown as SharedSourceSnapshot['stockCounts'],
    auditLog: [{ id: 'a-1', createdAt: 1000, actorId: 'u-1', actorName: 'Owner', actorRole: 'SUPER_ADMIN', action: 'SALE_RECORDED', entityType: 'invoice', entityId: 'i-1', summary: 'Sold 3 items' }] as unknown as SharedSourceSnapshot['auditLog'],
  } as unknown as SharedSourceSnapshot;
}

async function roundTrip(snapshot: SharedSourceSnapshot): Promise<SharedSourceSnapshot> {
  const payload = await toSharedPayload({ snapshot, photos: [], createdAt: 123, appVersion: 'test' });
  // Go through JSON text, as the real file will.
  const parsed = JSON.parse(JSON.stringify(payload)) as SharedPayload;
  return fromSharedPayload(parsed);
}

describe('shared payload mapping (web)', () => {
  it('writes every shared table, even when empty', async () => {
    const payload = await toSharedPayload({ snapshot: sampleSnapshot(), photos: [], createdAt: 1, appVersion: 'test' });
    expect(Object.keys(payload.tables).sort()).toEqual([...SHARED_TABLE_NAMES].sort());
    expect(payload.format).toBe('auxo-backup');
    expect(payload.version).toBe(1);
    expect(payload.shopName).toBe('Sample Shop');
  });

  it('splits nested children into their own tables with parent IDs', async () => {
    const { tables } = await toSharedPayload({ snapshot: sampleSnapshot(), photos: [], createdAt: 1, appVersion: 'test' });
    expect(tables.variants).toHaveLength(2);
    expect(tables.variants.every(v => v.productId === 'p-1')).toBe(true);
    expect(tables.invoiceLines).toHaveLength(2);
    expect(tables.invoiceLines.every(l => l.invoiceId === 'i-1' && typeof l.id === 'string')).toBe(true);
    expect(tables.payments[0]).toMatchObject({ invoiceId: 'i-1', method: 'CASH' });
    expect(tables.stockCountLines[0]).toMatchObject({ stockCountId: 'sc-1', expectedQuantity: 12, countedQuantity: 11 });
    expect(tables.dayClosings[0]).toMatchObject({ businessDate: '2026-11-02', netSalesPaise: '149700' });
  });

  it('never writes accounts or password material', async () => {
    const snapshot = { ...sampleSnapshot(), accounts: [{ id: 'acc', identifier: 'owner', hash: 'secret' }] } as unknown as SharedSourceSnapshot;
    const payload = await toSharedPayload({ snapshot, photos: [], createdAt: 1, appVersion: 'test' });
    expect(JSON.stringify(payload)).not.toContain('secret');
    expect(payload.tables).not.toHaveProperty('accounts');
  });

  it('round-trips the sample shop through JSON without losing or reordering anything', async () => {
    const original = sampleSnapshot();
    const restored = await roundTrip(original);
    expect(restored.shop).toEqual(original.shop);
    expect(restored.loyaltyRules).toEqual(original.loyaltyRules);
    expect(restored.categories).toEqual(original.categories);
    expect(restored.products).toEqual(original.products);
    expect(restored.invoices).toEqual(original.invoices);
    expect(restored.customers).toEqual(original.customers);
    expect(restored.customerLedger).toEqual(original.customerLedger);
    expect(restored.suppliers).toEqual(original.suppliers);
    expect(restored.purchaseOrders).toEqual(original.purchaseOrders);
    expect(restored.purchaseReceipts).toEqual(original.purchaseReceipts);
    expect(restored.dayClosings).toEqual(original.dayClosings);
    expect(restored.loyaltyLedger).toEqual(original.loyaltyLedger);
    expect(restored.heldBills).toEqual(original.heldBills);
    expect(restored.quotations).toEqual(original.quotations);
    expect(restored.stockCounts).toEqual(original.stockCounts);
    expect(restored.auditLog).toEqual(original.auditLog);
    expect(restored.movements).toEqual(original.movements);
  });

  it('keeps line order when an invoice has several lines', async () => {
    const original = sampleSnapshot();
    const restored = await roundTrip(original);
    expect(restored.invoices[0]!.lines.map(l => l.variantId)).toEqual(['v-1', 'v-2']);
  });

  it('derives the same child IDs every time for the same parent', async () => {
    expect(await deriveSharedId('invoiceLine', 'i-1', '0')).toBe(await deriveSharedId('invoiceLine', 'i-1', '0'));
    expect(await deriveSharedId('invoiceLine', 'i-1', '0')).not.toBe(await deriveSharedId('invoiceLine', 'i-1', '1'));
    expect(await deriveSharedId('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('refuses a payload from another format version', async () => {
    const payload = await toSharedPayload({ snapshot: sampleSnapshot(), photos: [], createdAt: 1, appVersion: 'test' });
    expect(() => fromSharedPayload({ ...payload, version: 2 as 1 })).toThrow(/cannot read/);
  });

  it('refuses a payload missing a required table', async () => {
    const payload = await toSharedPayload({ snapshot: sampleSnapshot(), photos: [], createdAt: 1, appVersion: 'test' });
    const { heldBillLines: _removed, ...tables } = payload.tables;
    expect(() => fromSharedPayload({ ...payload, tables } as SharedPayload)).toThrow(/heldBillLines/);
  });

  it('fills place of supply for older invoices that do not store it', async () => {
    const snapshot = sampleSnapshot();
    const { placeOfSupply: _omit, ...oldInvoice } = snapshot.invoices[0]!;
    const { tables } = await toSharedPayload({ snapshot: { ...snapshot, invoices: [oldInvoice] } as SharedSourceSnapshot, photos: [], createdAt: 1, appVersion: 'test' });
    expect(tables.invoices[0]).toMatchObject({ placeOfSupply: '19' });
  });
});

describe('place of supply rule', () => {
  it('uses the buyer state for inter-state sales with a known buyer state', () => {
    expect(placeOfSupplyFor({ interState: true, buyer: { stateCode: '07' }, seller: { stateCode: '19' } })).toBe('07');
  });
  it('uses the seller state for in-state sales', () => {
    expect(placeOfSupplyFor({ interState: false, buyer: { stateCode: '07' }, seller: { stateCode: '19' } })).toBe('19');
  });
  it('falls back to the seller state when the buyer state is unknown', () => {
    expect(placeOfSupplyFor({ interState: true, buyer: null, seller: { stateCode: '19' } })).toBe('19');
  });
});
