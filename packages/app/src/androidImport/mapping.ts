import {
  newId,
  newEntityBase,
  type Category,
  type Product,
  type ProductVariant,
  type Customer,
  type StockMovement,
  type StockMovementReason,
  type Invoice,
  type InvoiceLine,
  type UUID,
} from "@auxo/core";
import type { SqlRow } from "./sqlcipherDb.js";

/** Android stores money as integer paise (1/100 rupee); the web app uses plain rupee numbers. */
function minorToRupees(minor: number | null | undefined): number {
  return minor == null ? 0 : minor / 100;
}

function toISO(epochMillis: number | null | undefined): string {
  return new Date(epochMillis ?? Date.now()).toISOString();
}

function str(row: SqlRow, col: string): string | null {
  const v = row[col];
  return typeof v === "string" ? v : v == null ? null : String(v);
}

function num(row: SqlRow, col: string): number | null {
  const v = row[col];
  return typeof v === "number" ? v : v == null ? null : Number(v);
}

/** Remaps Android's auto-increment Long ids to this import's freshly generated UUIDs. */
export class IdMap {
  private readonly map = new Map<string, UUID>();

  get(table: string, androidId: number | string): UUID {
    const key = `${table}:${androidId}`;
    let id = this.map.get(key);
    if (!id) {
      id = newId();
      this.map.set(key, id);
    }
    return id;
  }

  tryGet(table: string, androidId: number | string | null): UUID | null {
    if (androidId == null) return null;
    return this.get(table, androidId);
  }
}

export function mapCategories(rows: SqlRow[], ids: IdMap): Category[] {
  return rows.map((row) => {
    const base = newEntityBase();
    return {
      ...base,
      id: ids.get("shop_categories", num(row, "id")!),
      name: str(row, "name") || str(row, "profile") || "Category",
      enabled: Boolean(row.enabled),
    };
  });
}

export function mapProducts(rows: SqlRow[], ids: IdMap): Product[] {
  return rows.map((row) => {
    const base = newEntityBase();
    const categoryId = row.category_id != null ? ids.tryGet("shop_categories", num(row, "category_id")) : null;
    const gstRateBp = num(row, "gst_rate_bp");
    return {
      ...base,
      id: ids.get("products", num(row, "id")!),
      createdAt: toISO(num(row, "created_at")),
      updatedAt: toISO(num(row, "updated_at")),
      categoryId,
      name: str(row, "name") ?? "Product",
      taxRatePercent: gstRateBp != null ? gstRateBp / 100 : null,
    };
  });
}

export function mapProductVariants(rows: SqlRow[], ids: IdMap): ProductVariant[] {
  return rows.map((row) => {
    const base = newEntityBase();
    const size = str(row, "size");
    const colour = str(row, "colour");
    const label = [size, colour].filter(Boolean).join(" / ") || str(row, "sku") || str(row, "barcode") || "Default";
    const priceMinor = num(row, "price_minor") ?? 0;
    const mrpMinor = num(row, "mrp_minor");
    return {
      ...base,
      id: ids.get("product_variants", num(row, "id")!),
      productId: ids.get("products", num(row, "product_id")!),
      name: label,
      sku: str(row, "sku"),
      barcode: str(row, "barcode"),
      mrp: minorToRupees(mrpMinor ?? priceMinor),
      sellingPrice: minorToRupees(priceMinor),
    };
  });
}

export function mapCustomers(rows: SqlRow[], ids: IdMap): Customer[] {
  return rows.map((row) => {
    const base = newEntityBase();
    const creditLimitMinor = num(row, "credit_limit_minor");
    return {
      ...base,
      id: ids.get("customers", num(row, "id")!),
      createdAt: toISO(num(row, "created_at")),
      updatedAt: toISO(num(row, "updated_at")),
      name: str(row, "name") ?? "Customer",
      phone: str(row, "phone"),
      creditLimit: creditLimitMinor != null ? minorToRupees(creditLimitMinor) : null,
    };
  });
}

const STOCK_REASON_MAP: Record<string, StockMovementReason> = {
  INITIAL: "initial_stock",
  RECEIVED: "purchase",
  RETURNED: "sale_return",
  SOLD: "sale",
  DAMAGED: "manual_adjustment",
  CORRECTION: "stock_take",
  EXPIRED: "manual_adjustment",
  SPOILED: "manual_adjustment",
};

/**
 * Stock movements whose variant no longer exists on the Android side
 * (variant_id can be null there after a delete) are skipped — there's
 * nothing meaningful to attach them to here.
 */
export function mapStockMovements(rows: SqlRow[], ids: IdMap, knownVariantAndroidIds: Set<number>): StockMovement[] {
  const out: StockMovement[] = [];
  for (const row of rows) {
    const variantAndroidId = num(row, "variant_id");
    if (variantAndroidId == null || !knownVariantAndroidIds.has(variantAndroidId)) continue;
    const base = newEntityBase();
    const reasonRaw = str(row, "reason") ?? "";
    const reason = STOCK_REASON_MAP[reasonRaw] ?? "manual_adjustment";
    const originalNote = str(row, "note");
    const note =
      reasonRaw in STOCK_REASON_MAP && !["DAMAGED", "EXPIRED", "SPOILED"].includes(reasonRaw)
        ? originalNote
        : [originalNote, `(imported: ${reasonRaw.toLowerCase()})`].filter(Boolean).join(" ");
    out.push({
      ...base,
      createdAt: toISO(num(row, "created_at")),
      updatedAt: toISO(num(row, "created_at")),
      productVariantId: ids.get("product_variants", variantAndroidId),
      quantityDelta: num(row, "quantity_change") ?? 0,
      reason,
      referenceId: null,
      note,
    });
  }
  return out;
}

export interface MappedInvoice {
  invoice: Invoice;
}

/**
 * Only SALE-type invoices are imported; RETURN (credit note) invoices are
 * skipped for now — the web app doesn't yet model credit notes, and
 * approximating one as a negative sale would misrepresent the data rather
 * than just omit something. Skipped invoices are counted by the caller for
 * the import summary.
 */
export function mapInvoices(
  invoiceRows: SqlRow[],
  lineRowsByInvoiceId: Map<number, SqlRow[]>,
  paymentTotalsByInvoiceId: Map<number, number>,
  ids: IdMap,
  knownVariantAndroidIds: Set<number>,
  placeholderVariantId: () => UUID
): { imported: Invoice[]; skippedReturns: number; skippedNoLines: number } {
  const imported: Invoice[] = [];
  let skippedReturns = 0;
  let skippedNoLines = 0;

  for (const row of invoiceRows) {
    const androidId = num(row, "id")!;
    const type = str(row, "type");
    if (type === "RETURN") {
      skippedReturns++;
      continue;
    }

    const lineRows = lineRowsByInvoiceId.get(androidId) ?? [];
    const lines: InvoiceLine[] = lineRows.map((lineRow) => {
      const variantAndroidId = num(lineRow, "variant_id");
      const productVariantId =
        variantAndroidId != null && knownVariantAndroidIds.has(variantAndroidId)
          ? ids.get("product_variants", variantAndroidId)
          : placeholderVariantId();
      const gstBp = num(lineRow, "gst_rate_bp") ?? 0;
      return {
        id: newId(),
        productVariantId,
        quantity: num(lineRow, "quantity") ?? 1,
        unitPrice: minorToRupees(num(lineRow, "unit_price_minor")),
        discountAmount: minorToRupees(num(lineRow, "discount_minor")),
        taxRatePercent: gstBp / 100,
      };
    });

    if (lines.length === 0) {
      skippedNoLines++;
      continue;
    }

    const customerAndroidId = num(row, "customer_id");
    const amountPaid = minorToRupees(paymentTotalsByInvoiceId.get(androidId) ?? 0);
    const total = lines.reduce(
      (sum, l) => sum + (l.quantity * l.unitPrice - l.discountAmount) * (1 + l.taxRatePercent / 100),
      0
    );

    const createdAtIso = toISO(num(row, "created_at"));
    imported.push({
      id: newId(),
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
      deletedAt: null,
      invoiceNumber: str(row, "number") ?? `ANDROID-${androidId}`,
      customerId: customerAndroidId != null ? ids.get("customers", customerAndroidId) : null,
      employeeId: null,
      lines,
      status: "completed",
      paymentStatus: amountPaid <= 0 ? "on_credit" : amountPaid >= total ? "paid" : "part_paid",
      tableNumber: null,
      amountPaid,
      createdDeviceId: "ANDROID-IMPORT",
    });
  }

  return { imported, skippedReturns, skippedNoLines };
}
