import { newProductVariant, type ProductVariant, type UUID } from "@auxo/core";
import { decryptPassphraseBackup, looksPassphraseEncrypted } from "./tinkDecrypt.js";
import { extractAndroidBackup, AndroidBackupError } from "./androidBackupArchive.js";
import { openAndroidDatabase, type SqlRow } from "./sqlcipherDb.js";
import { IdMap, mapCategories, mapCustomers, mapInvoices, mapProductVariants, mapProducts, mapStockMovements } from "./mapping.js";
import { getRepositories } from "../db/repositories.js";

export interface ImportSummary {
  shopName: string;
  categories: number;
  products: number;
  variants: number;
  customers: number;
  stockMovements: number;
  invoicesImported: number;
  invoicesSkippedAsReturns: number;
  invoicesSkippedNoLines: number;
}

/**
 * Imports catalog/customer/invoice/stock data from an exported Android app
 * backup into this (already set-up) web shop. Employee logins are
 * deliberately never part of this — the Android app excludes accounts from
 * its own backups by design, so there's nothing to import there; everyone
 * keeps using their existing web login.
 *
 * This is additive: it creates new records (with fresh UUIDs) alongside
 * whatever already exists in the web shop, rather than replacing anything.
 */
export async function importAndroidBackup(
  file: File,
  passphrase: string | null,
  onProgress?: (step: string) => void
): Promise<ImportSummary> {
  onProgress?.("Reading file…");
  const fileBytes = new Uint8Array(await file.arrayBuffer());

  let zipBytes: Uint8Array = fileBytes;
  if (looksPassphraseEncrypted(fileBytes)) {
    if (!passphrase) {
      throw new AndroidBackupError("This backup is passphrase-locked — enter the passphrase to continue.");
    }
    onProgress?.("Decrypting backup…");
    zipBytes = await decryptPassphraseBackup(fileBytes, passphrase);
  }

  onProgress?.("Unpacking backup…");
  const extracted = extractAndroidBackup(zipBytes);

  onProgress?.("Opening database…");
  const androidDb = await openAndroidDatabase(extracted.database, extracted.databaseKey);

  try {
    const ids = new IdMap();

    // Some tables were added in later Android app schema versions (e.g.
    // shop_categories in version 17) — an older backup simply won't have
    // them, and that's fine; treat a missing table as "nothing to import
    // from it" rather than failing the whole import.
    const safeQuery = (table: string, sql: string): SqlRow[] => (androidDb.tableExists(table) ? androidDb.query(sql) : []);

    onProgress?.("Reading categories and products…");
    const categoryRows = safeQuery("shop_categories", "SELECT * FROM shop_categories;");
    const categories = mapCategories(categoryRows, ids);

    const productRows = safeQuery("products", "SELECT * FROM products;");
    const products = mapProducts(productRows, ids);

    const variantRows = safeQuery("product_variants", "SELECT * FROM product_variants;");
    const variants = mapProductVariants(variantRows, ids);
    const knownVariantAndroidIds = new Set(variantRows.map((r) => Number(r.id)));

    onProgress?.("Reading customers…");
    const customerRows = safeQuery("customers", "SELECT * FROM customers;");
    const customers = mapCustomers(customerRows, ids);

    onProgress?.("Reading stock history…");
    const stockRows = safeQuery("stock_movements", "SELECT * FROM stock_movements;");
    const stockMovements = mapStockMovements(stockRows, ids, knownVariantAndroidIds);

    onProgress?.("Reading invoices…");
    const invoiceRows = safeQuery("invoices", "SELECT * FROM invoices;");
    const lineRows = safeQuery("invoice_lines", "SELECT * FROM invoice_lines;");
    const linesByInvoice = groupBy(lineRows, "invoice_id");
    const paymentRows = safeQuery(
      "payments",
      "SELECT invoice_id, SUM(amount_minor) AS total FROM payments GROUP BY invoice_id;"
    );
    const paymentTotals = new Map<number, number>(
      paymentRows.map((r) => [Number(r.invoice_id), Number(r.total ?? 0)])
    );

    let placeholder: ProductVariant | null = null;
    const placeholderVariantId = (): UUID => {
      if (!placeholder) {
        placeholder = newProductVariant({
          productId: products[0]?.id ?? ids.get("products", -1),
          name: "Imported item (original deleted)",
          sku: null,
          barcode: null,
          mrp: 0,
          sellingPrice: 0,
        });
      }
      return placeholder.id;
    };

    const { imported: invoices, skippedReturns, skippedNoLines } = mapInvoices(
      invoiceRows,
      linesByInvoice,
      paymentTotals,
      ids,
      knownVariantAndroidIds,
      placeholderVariantId
    );

    onProgress?.("Saving to this shop…");
    const repos = getRepositories();
    for (const c of categories) await repos.categories.save(c);
    for (const p of products) await repos.products.save(p);
    for (const v of variants) await repos.productVariants.save(v);
    if (placeholder) await repos.productVariants.save(placeholder);
    for (const c of customers) await repos.customers.save(c);
    for (const m of stockMovements) await repos.stockMovements.save(m);
    for (const inv of invoices) await repos.invoices.save(inv);

    return {
      shopName: extracted.manifest.shopName,
      categories: categories.length,
      products: products.length,
      variants: variants.length,
      customers: customers.length,
      stockMovements: stockMovements.length,
      invoicesImported: invoices.length,
      invoicesSkippedAsReturns: skippedReturns,
      invoicesSkippedNoLines: skippedNoLines,
    };
  } finally {
    androidDb.close();
  }
}

function groupBy(rows: SqlRow[], key: string): Map<number, SqlRow[]> {
  const out = new Map<number, SqlRow[]>();
  for (const row of rows) {
    const k = Number(row[key]);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}
