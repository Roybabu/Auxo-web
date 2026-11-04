// Checks a decrypted auxo-backup v1 payload against docs/BACKUP_FORMAT.md before anything is restored.
// Pure function: it reports problems and never changes data. Nothing is applied when problems exist.

import { SHARED_TABLE_NAMES, type SharedPayload, type SharedRow, type SharedTableName } from './sharedPayload';
import { REQUIRED, type Kind } from './sharedSpec';

export type ValidationProblem = { table: string; index: number | null; field: string | null; message: string };
export type ValidationResult = { valid: boolean; problems: ValidationProblem[] };

// Foreign keys: child table field -> parent table that must contain that ID.
const FOREIGN_KEYS: Array<[SharedTableName, string, SharedTableName]> = [
  ['subcategories', 'categoryId', 'categories'],
  ['variants', 'productId', 'products'],
  ['stockBatches', 'variantId', 'variants'],
  ['stockMovements', 'variantId', 'variants'],
  ['customerLedger', 'customerId', 'customers'],
  ['invoices', 'customerId', 'customers'],
  ['invoiceLines', 'invoiceId', 'invoices'],
  ['payments', 'invoiceId', 'invoices'],
  ['purchaseOrders', 'supplierId', 'suppliers'],
  ['purchaseOrderLines', 'orderId', 'purchaseOrders'],
  ['receiptLines', 'receiptId', 'receipts'],
  ['heldBillLines', 'heldBillId', 'heldBills'],
  ['quotationLines', 'quotationId', 'quotations'],
  ['stockCountLines', 'stockCountId', 'stockCounts'],
  ['stockCountLines', 'variantId', 'variants'],
  ['loyaltyLedger', 'customerId', 'customers'],
];

// Fields that must be unique across the table (document numbers).
const UNIQUE_FIELDS: Array<[SharedTableName, string]> = [
  ['invoices', 'number'], ['quotations', 'number'], ['purchaseOrders', 'number'], ['receipts', 'number'],
];

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const PAISE = /^-?\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkValue(kind: Kind, value: unknown): string | null {
  const nullable = kind.endsWith('?');
  if (value === null) return nullable ? null : 'may not be null';
  switch (kind.replace('?', '')) {
    case 'uuid': return typeof value === 'string' && UUID.test(value) ? null : 'must be a UUID';
    case 'str': return typeof value === 'string' ? null : 'must be text';
    case 'int': return Number.isSafeInteger(value) ? null : 'must be a whole number';
    case 'bool': return typeof value === 'boolean' ? null : 'must be true or false';
    case 'paise': return typeof value === 'string' && PAISE.test(value) ? null : 'must be a whole-paise text value';
    case 'instant': return Number.isSafeInteger(value) && (value as number) >= 0 ? null : 'must be a UTC millisecond time';
    case 'date': return typeof value === 'string' && DATE.test(value) ? null : 'must be a YYYY-MM-DD date';
    case 'obj': return typeof value === 'object' && !Array.isArray(value) ? null : 'must be an object';
    case 'any': return null;
    case 'literal:shop': return value === 'shop' ? null : 'must be "shop"';
    case 'literal:rules': return value === 'rules' ? null : 'must be "rules"';
    default: return null;
  }
}

/** Validates a parsed payload. Returns every problem found, so a file can be fixed or rejected as a whole. */
export function validateSharedPayload(payload: unknown): ValidationResult {
  const problems: ValidationProblem[] = [];
  const add = (table: string, index: number | null, field: string | null, message: string) => problems.push({ table, index, field, message });
  const p = payload as Partial<SharedPayload> | null;

  if (!p || typeof p !== 'object') return { valid: false, problems: [{ table: 'file', index: null, field: null, message: 'not an object' }] };
  if (p.format !== 'auxo-backup') add('file', null, 'format', 'must be "auxo-backup"');
  if (p.version !== 1) add('file', null, 'version', 'must be 1');
  if (p.sharedModelVersion !== 1) add('file', null, 'sharedModelVersion', 'must be 1');
  if (!Number.isSafeInteger(p.createdAt)) add('file', null, 'createdAt', 'must be a UTC millisecond time');
  if (typeof p.shopName !== 'string') add('file', null, 'shopName', 'must be text');
  if (!Array.isArray(p.photos)) add('file', null, 'photos', 'must be a list');
  if (!p.tables || typeof p.tables !== 'object') return { valid: false, problems: [...problems, { table: 'file', index: null, field: 'tables', message: 'missing' }] };

  const tables = p.tables as Record<string, unknown>;
  for (const name of SHARED_TABLE_NAMES) {
    if (!Array.isArray(tables[name])) add(name, null, null, 'table is missing or not a list');
  }
  if (problems.some(x => x.table !== 'file' && x.index === null)) return { valid: false, problems };

  const rows = (name: SharedTableName) => (tables[name] as SharedRow[]) ?? [];

  // Required fields and types, and duplicate IDs.
  for (const name of SHARED_TABLE_NAMES) {
    const required = REQUIRED[name];
    const seen = new Set<string>();
    rows(name).forEach((row, index) => {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        add(name, index, null, 'row is not an object');
        return;
      }
      for (const [field, kind] of Object.entries(required)) {
        if (!(field in row)) {
          add(name, index, field, 'required field is missing');
          continue;
        }
        const reason = checkValue(kind, row[field]);
        if (reason) add(name, index, field, reason);
      }
      if (name === 'heldBills' && 'placeOfSupplyStateCode' in row) {
        const value = row.placeOfSupplyStateCode;
        if (value !== null && !(typeof value === 'string' && /^[0-9]{2}$/.test(value))) add(name, index, 'placeOfSupplyStateCode', 'must be a two-digit state code or null');
      }
      if (name === 'invoices' && typeof row.seller === 'object' && row.seller !== null) {
        for (const field of ['storeName', 'address', 'gstin', 'stateCode', 'phone']) {
          if (typeof (row.seller as Record<string, unknown>)[field] !== 'string') add(name, index, `seller.${field}`, 'required field is missing');
        }
      }
      if ('id' in required && typeof row.id === 'string') {
        if (seen.has(row.id)) add(name, index, 'id', 'duplicate ID');
        seen.add(row.id);
      }
    });
  }

  // Duplicate document numbers.
  for (const [name, field] of UNIQUE_FIELDS) {
    const seen = new Set<unknown>();
    rows(name).forEach((row, index) => {
      if (seen.has(row[field])) add(name, index, field, 'duplicate number');
      seen.add(row[field]);
    });
  }

  // Relationships: every reference must point to a row that exists.
  for (const [child, field, parent] of FOREIGN_KEYS) {
    const parentIds = new Set(rows(parent).map(r => r.id));
    rows(child).forEach((row, index) => {
      const value = row[field];
      if (value === null || value === undefined) return;
      if (!parentIds.has(value)) add(child, index, field, `refers to a ${parent} row that is not in the file`);
    });
  }

  // Photo references must point to a photo in the file.
  const photoIds = new Set((p.photos ?? []).map(photo => photo.id));
  const photoRefs: Array<[SharedTableName, string]> = [['products', 'photoId'], ['variants', 'photoId'], ['settings', 'storeLogoPhotoId']];
  for (const [table, field] of photoRefs) {
    rows(table).forEach((row, index) => {
      const value = row[field];
      if (value !== null && value !== undefined && !photoIds.has(value as string)) add(table, index, field, 'refers to a photo that is not in the file');
    });
  }

  return { valid: problems.length === 0, problems };
}
