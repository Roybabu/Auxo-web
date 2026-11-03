// Required fields per shared table, from docs/BACKUP_FORMAT.md section 2. Used by both the mapping (to fill
// defaults) and the validator (to check files). Keep this file free of imports from the other shared modules.

import type { SharedTableName } from './sharedTableNames';

export type Kind = 'uuid' | 'uuid?' | 'str' | 'str?' | 'int' | 'int?' | 'bool' | 'paise' | 'paise?' | 'instant' | 'instant?' | 'date' | 'date?' | 'obj' | 'obj?' | 'any' | 'literal:shop' | 'literal:rules';

// Required properties per table, from the spec's table contracts. "?" means the value may be null.
export const REQUIRED: Record<SharedTableName, Record<string, Kind>> = {
  settings: { id: 'literal:shop', storeName: 'str', address: 'str', gstin: 'str', stateCode: 'str', gstRegistered: 'bool', pricesIncludeTax: 'bool', roundOff: 'bool', invoicePrefix: 'str', creditNotePrefix: 'str', phone: 'str', fssai: 'str', upiId: 'str', upiPayeeName: 'str', receiptPaper: 'str', receiptFooter: 'str', receiptLanguage: 'str', receiptShowHsn: 'bool', receiptShowTaxBreakdown: 'bool', receiptShowCustomer: 'bool', receiptShowSavings: 'bool', receiptShowBarcode: 'bool', receiptShowUpiQr: 'bool', employeeDiscountLimitBp: 'int', expiryWarningDays: 'int', metalRatesPaise: 'obj' },
  categories: { id: 'uuid', name: 'str?', profile: 'str', enabled: 'bool', sortOrder: 'int', builtIn: 'bool' },
  subcategories: { id: 'uuid', categoryId: 'uuid', name: 'str', sortOrder: 'int' },
  products: { id: 'uuid', name: 'str', category: 'str', brand: 'str?', createdAt: 'instant', updatedAt: 'instant', stockUnit: 'str', gstRateBasisPoints: 'int?', apparelGst: 'bool', available: 'bool', tracksStock: 'bool' },
  variants: { id: 'uuid', productId: 'uuid', sku: 'str', barcode: 'str', size: 'str', colour: 'str', pricePaise: 'paise', mrpPaise: 'paise?', costPaise: 'paise?', stockQuantity: 'int', lowStockThreshold: 'int', reorderQuantity: 'int' },
  stockBatches: { id: 'uuid', variantId: 'uuid', batchNumber: 'str?', expiryDate: 'date?', quantity: 'int', receivedAt: 'instant', unitCostPaise: 'paise?' },
  stockMovements: { id: 'uuid', variantId: 'uuid', quantityChange: 'int', reason: 'str', note: 'str?', createdAt: 'instant' },
  customers: { id: 'uuid', name: 'str', balancePaise: 'paise', createdAt: 'instant', updatedAt: 'instant' },
  customerLedger: { id: 'uuid', customerId: 'uuid', type: 'str', amountPaise: 'paise', invoiceId: 'uuid?', invoiceNumber: 'str?', method: 'str?', reference: 'str?', createdAt: 'instant', note: 'str?' },
  invoices: { id: 'uuid', number: 'str', type: 'str', createdAt: 'instant', seller: 'obj', buyer: 'obj?', customerId: 'uuid?', originalInvoiceId: 'uuid?', originalInvoiceNumber: 'str?', note: 'str?', returnReason: 'str?', placeOfSupply: 'str', gstRegistered: 'bool', pricesIncludeTax: 'bool', interState: 'bool', subtotalPaise: 'paise', lineDiscountPaise: 'paise', billDiscountPaise: 'paise', discountPaise: 'paise', billDiscountReason: 'str?', loyaltyPointsRedeemed: 'int', loyaltyDiscountPaise: 'paise', taxablePaise: 'paise', cgstPaise: 'paise', sgstPaise: 'paise', igstPaise: 'paise', roundOffPaise: 'paise', roundedToRupee: 'bool', grandTotalPaise: 'paise', savingsPaise: 'paise' },
  invoiceLines: { id: 'uuid', invoiceId: 'uuid', productId: 'uuid?', variantId: 'uuid?', originalLineId: 'uuid?', name: 'str', variantLabel: 'str', barcode: 'str', hsnCode: 'str?', customItem: 'bool', quantity: 'int', stockUnit: 'str', unitPricePaise: 'paise', mrpPaise: 'paise?', lineDiscountPaise: 'paise', billDiscountSharePaise: 'paise', discountPaise: 'paise', discountReason: 'str?', taxablePaise: 'paise', gstRateBasisPoints: 'int', cgstPaise: 'paise', sgstPaise: 'paise', igstPaise: 'paise', totalPaise: 'paise', returnedQuantity: 'int' },
  payments: { id: 'uuid', invoiceId: 'uuid', method: 'str', kind: 'str', amountPaise: 'paise', reference: 'str?', tenderedPaise: 'paise?', changePaise: 'paise?', createdAt: 'instant' },
  suppliers: { id: 'uuid', name: 'str', active: 'bool', createdAt: 'instant', updatedAt: 'instant' },
  purchaseOrders: { id: 'uuid', number: 'str', supplierId: 'uuid', status: 'str', createdAt: 'instant', updatedAt: 'instant', expectedDate: 'date?', note: 'str?' },
  purchaseOrderLines: { id: 'uuid', orderId: 'uuid', variantId: 'uuid?', productName: 'str', variantLabel: 'str', stockUnit: 'str', quantityOrdered: 'int', quantityReceived: 'int', unitCostPaise: 'paise' },
  receipts: { id: 'uuid', number: 'str', supplierId: 'uuid?', supplierName: 'str?', orderId: 'uuid?', orderNumber: 'str?', supplierInvoiceNumber: 'str?', receivedAt: 'instant', note: 'str?', totalPaise: 'paise', requestId: 'str' },
  receiptLines: { id: 'uuid', receiptId: 'uuid', variantId: 'uuid?', orderLineId: 'uuid?', productName: 'str', variantLabel: 'str', stockUnit: 'str', quantity: 'int', unitCostPaise: 'paise', batchNumber: 'str?', expiryDate: 'date?', batchId: 'uuid?' },
  dayClosings: { id: 'uuid', businessDate: 'date', bills: 'int', returns: 'int', netSalesPaise: 'paise', cashReceivedPaise: 'paise', cashRefundedPaise: 'paise', cashFromAccountsPaise: 'paise', upiNetPaise: 'paise', cardNetPaise: 'paise', onAccountNetPaise: 'paise', countedCashPaise: 'paise', note: 'str?', closedAt: 'instant', closedBy: 'str' },
  loyaltySettings: { id: 'literal:rules', enabled: 'bool', spendPerPointPaise: 'paise', pointValuePaise: 'paise' },
  loyaltyLedger: { id: 'uuid', customerId: 'uuid', type: 'str', points: 'int', invoiceId: 'uuid?', sourceInvoiceId: 'uuid?', createdAt: 'instant', note: 'str?' },
  heldBills: { id: 'uuid', label: 'str', createdAt: 'instant', updatedAt: 'instant', itemCount: 'int', totalPaise: 'paise', tableNumber: 'int?', tokenNumber: 'int?', discount: 'obj', interState: 'bool', customerId: 'str', buyerName: 'str?', buyerPhone: 'str?', buyerGstin: 'str?' },
  heldBillLines: { id: 'uuid', heldBillId: 'uuid', sortOrder: 'int', snapshot: 'obj' },
  quotations: { id: 'uuid', number: 'str', createdAt: 'instant', validUntil: 'date', customerName: 'str', customerPhone: 'str', itemCount: 'int', totalPaise: 'paise', status: 'str', convertedInvoiceId: 'uuid?', customerId: 'uuid?' },
  quotationLines: { id: 'uuid', quotationId: 'uuid', sortOrder: 'int', snapshot: 'obj' },
  stockCounts: { id: 'uuid', status: 'str', startedAt: 'instant', finishedAt: 'instant?', reason: 'str?', note: 'str?', adjustedCount: 'int', matchedCount: 'int' },
  stockCountLines: { id: 'uuid', stockCountId: 'uuid', variantId: 'uuid', expectedQuantity: 'int', countedQuantity: 'int' },
  auditLog: { id: 'uuid', createdAt: 'instant', actorId: 'str?', actorName: 'str', actorRole: 'str?', action: 'str', entityType: 'str', entityId: 'str?', summary: 'str' },
  numberSequences: { name: 'str', nextValue: 'int' },
  extensions: { namespace: 'str', ownerType: 'str', ownerId: 'str', key: 'str', value: 'any' },
};


/**
 * Fixed UUIDs for the built-in product categories. The web app uses the product type (e.g. "GARMENT") as their ID,
 * and the spec needs UUIDs. Export maps each to its UUID; import maps it back. Values come from
 * deriveSharedId('builtin-category', profile) and are checked by a test.
 */
export const BUILT_IN_CATEGORY_IDS: Readonly<Record<string, string>> = {
  GARMENT: '21698313-7bd8-56ea-9c69-9ebe0fc84a82',
  FOOTWEAR: '326c2ddf-a1a0-5d1e-91eb-ddb8cb003a87',
  ACCESSORIES: '890d9f9a-c20c-5a59-aa2c-303f77300787',
  PACKAGED_FOOD: '4fc4cfed-fae8-550c-a895-7f52e5e29c08',
  BEVERAGE: '2a47ef63-65f0-54e1-8f27-934d8dc7a4a5',
  GENERAL: '828e7b4d-9fac-5892-ad9d-726e22c55973',
  ELECTRONICS: '12f7da24-108e-5afa-8d7d-016d30d75a3d',
  PHARMACY: 'cb054182-c54d-53c8-940f-0dab4bb99460',
  COSMETICS: '9a48869d-c8c3-5d01-99c7-0fb9ee73f78a',
  LOOSE: 'fb0db978-456f-5fa1-b083-43b002189187',
  JEWELLERY: 'd327dc5b-352a-57d1-846f-f62cc826463b',
  RESTAURANT: '27533c16-dbd0-5a7f-b95a-cddc6e984278',
};

/** The reverse of BUILT_IN_CATEGORY_IDS: UUID back to the web app's product type. */
export const BUILT_IN_CATEGORY_FROM_ID: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(BUILT_IN_CATEGORY_IDS).map(([profile, id]) => [id, profile]),
);
