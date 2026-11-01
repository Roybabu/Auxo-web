// Report identifiers and period/current-position behavior from Android temp.
export const reports = [
  ['SALES_SUMMARY', 'Sales summary', true], ['ITEM_SALES', 'Item sales', true],
  ['COLLECTIONS', 'Collections', true], ['GST_RATES', 'GST rates', true],
  ['HSN_SUMMARY', 'HSN summary', true], ['PURCHASES', 'Purchases', true],
  ['STOCK_MOVEMENTS', 'Stock movements', true], ['WASTAGE', 'Wastage', true],
  ['STOCK_VALUE', 'Stock value', false], ['LOW_STOCK', 'Low stock', false],
  ['EXPIRY', 'Expiry', false], ['CUSTOMER_BALANCES', 'Customer balances', false],
  ['CUSTOMER_AGING', 'Customer aging', false],
] as const;
