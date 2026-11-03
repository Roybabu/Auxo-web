// Sample shop used by the shared backup tests. Test data only.

import { deriveSharedId, type SharedSourceSnapshot } from './sharedPayload';

// A small but complete sample shop: one of every record kind with nested children.
export function sampleSnapshot(): SharedSourceSnapshot {
  const variant = { id: 'v-1', size: 'M', colour: 'Blue', sku: 'SKU1', barcode: '8901', pricePaise: '49900', mrpPaise: '59900', costPaise: '30000', stock: 12, lowStockThreshold: 3, reorderQuantity: 10 };
  const line = { productId: 'p-1', variantId: 'v-1', name: 'Shirt', variantLabel: 'M / Blue', barcode: '8901', quantity: 2, stockUnit: 'UNIT', unitPricePaise: '49900', lineDiscountPaise: '0', billDiscountSharePaise: '0', discountPaise: '0', discountReason: null, taxablePaise: '99800', gstRateBasisPoints: 500, cgstPaise: '2495', sgstPaise: '2495', igstPaise: '0', totalPaise: '104790', returnedQuantity: 0 };
  return {
    shop: { storeName: 'Sample Shop', address: 'Main Road', gstin: '', stateCode: '19', gstRegistered: true, pricesIncludeTax: true, roundOff: true, invoicePrefix: 'INV', creditNotePrefix: 'CN' },
    loyaltyRules: { enabled: true, spendPerPointPaise: '500', pointValuePaise: '100' },
    categories: [{ id: 'cat-1', name: 'Apparel', profile: 'GARMENT', enabled: true, sortOrder: 1, builtIn: true, subcategories: [{ id: 'sub-1', name: 'Shirts', sortOrder: 1 }] }],
    products: [{ id: 'p-1', name: 'Shirt', category: 'GARMENT', categoryId: 'cat-1', brand: null, createdAt: 1000, updatedAt: 2000, stockUnit: 'UNIT', tracksStock: true, apparelGst: true, variants: [variant, { ...variant, id: 'v-2', size: 'L', sku: 'SKU2', barcode: '8902' }] }],
    stockBatches: [],
    movements: [{ id: 'm-1', variantId: 'v-1', quantityChange: 12, reason: 'INITIAL', note: null, createdAt: 1000 }],
    customers: [{ id: 'c-1', name: 'Asha', phone: '9000000001', creditLimitPaise: '100000', balancePaise: '-5000', onHold: false, createdAt: 1000 }],
    customerLedger: [{ id: 'l-1', customerId: 'c-1', type: 'PAYMENT', amountPaise: '-5000', invoiceId: null, invoiceNumber: null, method: 'CASH', reference: null, createdAt: 3000, note: null }],
    invoices: [{
      id: 'i-1', number: 'INV/26-27/00001', createdAt: 4000, type: 'SALE', placeOfSupply: '19', lines: [line, { ...line, variantId: 'v-2', quantity: 1 }],
      subtotalPaise: '149700', lineDiscountPaise: '0', billDiscountPaise: '0', discountPaise: '0', billDiscountReason: null,
      taxablePaise: '142571', cgstPaise: '3571', sgstPaise: '3571', igstPaise: '0', roundOffPaise: '0', roundedToRupee: false, grandTotalPaise: '149700',
      gstRegistered: true, pricesIncludeTax: true, interState: false,
      seller: { storeName: 'Sample Shop', address: 'Main Road', gstin: '', stateCode: '19', phone: '' },
      customer: { id: 'c-1', name: 'Asha', phone: '9000000001' },
      payments: [{ method: 'CASH', amountPaise: '149700', reference: null, tenderedPaise: '150000', changePaise: '300', kind: 'PAYMENT' }],
      originalInvoiceId: null, originalInvoiceNumber: null, returnReason: null,
    }],
    suppliers: [{ id: 's-1', name: 'Fabric Co', contactPerson: null, phone: null, email: null, gstin: null, stateCode: null, address: null, notes: null, active: true, createdAt: 1000 }],
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

/** The sample shop with UUID IDs, as the real app would create them. */
export async function realisticSample(): Promise<SharedSourceSnapshot> {
  return withUuidIds(sampleSnapshot());
}
