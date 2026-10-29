import type { Category, Product, ProductVariant } from "./product.js";
import type { Customer } from "./customer.js";
import type { Employee } from "./permissions.js";
import type { StockMovement } from "./stock.js";
import type { Invoice } from "./invoice.js";
import type { Supplier } from "./supplier.js";
import type { Purchase } from "./purchase.js";
import type { Return } from "./return.js";
import type { DayClosing } from "./dayClosing.js";
import type { ActivityLog } from "./activityLog.js";

/**
 * The neutral JSON export/import format. "Neutral" means: no SQLite
 * implementation detail leaks in here, so this format is stable even
 * if the storage engine changes (e.g. a future desktop build using a
 * different embedded DB). Every entity array includes soft-deleted
 * records, so a restore reproduces the exact prior state.
 */
export const BACKUP_FORMAT_VERSION = 1;

export interface AuxoBackupData {
  categories: Category[];
  products: Product[];
  productVariants: ProductVariant[];
  customers: Customer[];
  employees: Employee[];
  stockMovements: StockMovement[];
  invoices: Invoice[];
  /**
   * Added after format v1 shipped — optional so backups made before
   * suppliers/purchases existed still parse. Readers should default a
   * missing array to empty rather than treat it as malformed.
   */
  suppliers?: Supplier[];
  purchases?: Purchase[];
  returns?: Return[];
  dayClosings?: DayClosing[];
  activityLogs?: ActivityLog[];
  /** Shop settings and other small key/value state (business name, GST, FSSAI no., etc). */
  settings: Record<string, string>;
}

export interface AuxoBackupFile {
  formatVersion: number;
  createdAt: string;
  deviceId: string;
  data: AuxoBackupData;
}

/**
 * Shallow structural check that a parsed JSON file looks like an Auxo
 * backup before anything tries to import it. Not a full schema
 * validator — just enough to reject garbage/unrelated JSON early with
 * a clear reason instead of a confusing downstream crash.
 */
export function isAuxoBackupFile(value: unknown): value is AuxoBackupFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.formatVersion !== "number") return false;
  if (typeof v.createdAt !== "string") return false;
  if (typeof v.deviceId !== "string") return false;
  if (typeof v.data !== "object" || v.data === null) return false;
  const requiredArrays = [
    "categories",
    "products",
    "productVariants",
    "customers",
    "employees",
    "stockMovements",
    "invoices",
  ] as const;
  const data = v.data as Record<string, unknown>;
  return requiredArrays.every((key) => Array.isArray(data[key]));
}

export function assertSupportedBackupVersion(backup: AuxoBackupFile): void {
  if (backup.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error(
      `This backup (format v${backup.formatVersion}) was made by a newer version of Auxo than this one (supports up to v${BACKUP_FORMAT_VERSION}). Update Auxo before restoring it.`
    );
  }
}

export function emptyBackupData(): AuxoBackupData {
  return {
    categories: [],
    products: [],
    productVariants: [],
    customers: [],
    employees: [],
    stockMovements: [],
    invoices: [],
    suppliers: [],
    purchases: [],
    returns: [],
    dayClosings: [],
    activityLogs: [],
    settings: {},
  };
}
