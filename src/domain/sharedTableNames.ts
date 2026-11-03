// The 29 table names of the shared auxo-backup v1 format (docs/BACKUP_FORMAT.md section 2).

export const SHARED_TABLE_NAMES = [
  'settings', 'categories', 'subcategories', 'products', 'variants', 'stockBatches', 'stockMovements',
  'customers', 'customerLedger', 'invoices', 'invoiceLines', 'payments', 'suppliers', 'purchaseOrders',
  'purchaseOrderLines', 'receipts', 'receiptLines', 'dayClosings', 'loyaltySettings', 'loyaltyLedger',
  'heldBills', 'heldBillLines', 'quotations', 'quotationLines', 'stockCounts', 'stockCountLines',
  'auditLog', 'numberSequences', 'extensions',
] as const;
export type SharedTableName = (typeof SHARED_TABLE_NAMES)[number];
