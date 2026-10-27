import {
  BACKUP_FORMAT_VERSION,
  assertSupportedBackupVersion,
  isAuxoBackupFile,
  type AuxoBackupFile,
  type BackupPort,
} from "@auxo/core";
import { getRepositories } from "./repositories.js";
import { getOrCreateDeviceId } from "./deviceId.js";
import { clearAllTables, saveNow } from "./sqlite.js";

/** Settings keys that are device-specific and must never travel in a backup. */
const DEVICE_LOCAL_KEYS = new Set(["device_id"]);

export class SqliteBackup implements BackupPort {
  async export(): Promise<AuxoBackupFile> {
    const repos = getRepositories();
    const deviceId = await getOrCreateDeviceId(repos.settings);
    const settingsEntries = await repos.settings.entries();
    const settings: Record<string, string> = {};
    for (const [key, value] of Object.entries(settingsEntries)) {
      if (!DEVICE_LOCAL_KEYS.has(key)) settings[key] = value;
    }

    const [categories, products, productVariants, customers, employees, stockMovements, invoices] =
      await Promise.all([
        repos.categories.listAll(),
        repos.products.listAll(),
        repos.productVariants.listAll(),
        repos.customers.listAll(),
        repos.employees.listAll(),
        repos.stockMovements.listAll(),
        repos.invoices.listAll(),
      ]);

    return {
      formatVersion: BACKUP_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      deviceId,
      data: {
        categories,
        products,
        productVariants,
        customers,
        employees,
        stockMovements,
        invoices,
        settings,
      },
    };
  }

  async import(backup: AuxoBackupFile): Promise<void> {
    if (!isAuxoBackupFile(backup)) {
      throw new Error("This file doesn't look like an Auxo backup.");
    }
    assertSupportedBackupVersion(backup);

    const repos = getRepositories();
    const { data } = backup;

    // Restore replaces current state rather than merging — until sync
    // between devices exists, "restore" means "go back to exactly this",
    // not "combine with what's already here".
    const keepDeviceId = await repos.settings.get("device_id");
    clearAllTables();
    if (keepDeviceId) await repos.settings.set("device_id", keepDeviceId);

    await Promise.all([
      ...data.categories.map((r) => repos.categories.save(r)),
      ...data.products.map((r) => repos.products.save(r)),
      ...data.productVariants.map((r) => repos.productVariants.save(r)),
      ...data.customers.map((r) => repos.customers.save(r)),
      ...data.employees.map((r) => repos.employees.save(r)),
      ...data.stockMovements.map((r) => repos.stockMovements.save(r)),
      ...data.invoices.map((r) => repos.invoices.save(r)),
      ...Object.entries(data.settings)
        .filter(([key]) => !DEVICE_LOCAL_KEYS.has(key))
        .map(([key, value]) => repos.settings.set(key, value)),
    ]);

    await saveNow();
  }
}
