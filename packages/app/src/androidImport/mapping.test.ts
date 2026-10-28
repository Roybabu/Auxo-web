import { describe, expect, it } from "vitest";
import { newId } from "@auxo/core";
import { IdMap, mapCategories, mapCustomers, mapInvoices, mapProductVariants, mapProducts, mapStockMovements } from "./mapping.js";
import type { SqlRow } from "./sqlcipherDb.js";

describe("IdMap", () => {
  it("returns the same UUID for the same (table, androidId) pair", () => {
    const ids = new IdMap();
    const a = ids.get("products", 5);
    const b = ids.get("products", 5);
    expect(a).toBe(b);
  });

  it("returns different UUIDs for the same id in different tables", () => {
    const ids = new IdMap();
    expect(ids.get("products", 1)).not.toBe(ids.get("customers", 1));
  });

  it("tryGet returns null for a null androidId without allocating an id", () => {
    const ids = new IdMap();
    expect(ids.tryGet("products", null)).toBeNull();
  });
});

describe("mapCategories", () => {
  it("falls back to profile when name is null (built-in category)", () => {
    const rows: SqlRow[] = [{ id: 1, name: null, profile: "GARMENT", enabled: 0, sort_order: 0, built_in: 1 }];
    const [category] = mapCategories(rows, new IdMap());
    expect(category!.name).toBe("GARMENT");
    expect(category!.enabled).toBe(false);
  });
});

describe("mapProducts / mapProductVariants", () => {
  it("converts paise to rupees and basis points to percent", () => {
    const ids = new IdMap();
    const [product] = mapProducts(
      [{ id: 1, name: "Rice", category: "GENERAL", category_id: null, gst_rate_bp: 500, created_at: 0, updated_at: 0 }],
      ids
    );
    expect(product!.taxRatePercent).toBe(5); // 500 bp = 5%

    const [variant] = mapProductVariants(
      [{ id: 10, product_id: 1, sku: "SKU1", barcode: "BC1", size: null, colour: null, price_minor: 9000, mrp_minor: 10000 }],
      ids
    );
    expect(variant!.sellingPrice).toBe(90);
    expect(variant!.mrp).toBe(100);
    expect(variant!.productId).toBe(ids.get("products", 1)); // same UUID as the product above
  });

  it("builds a readable variant name from size/colour when present", () => {
    const ids = new IdMap();
    const [variant] = mapProductVariants(
      [{ id: 1, product_id: 1, sku: null, barcode: null, size: "M", colour: "Red", price_minor: 100, mrp_minor: null }],
      ids
    );
    expect(variant!.name).toBe("M / Red");
  });
});

describe("mapCustomers", () => {
  it("maps a null credit limit to null, not zero", () => {
    const [customer] = mapCustomers(
      [{ id: 1, name: "Asha", phone: "999", credit_limit_minor: null, created_at: 0, updated_at: 0 }],
      new IdMap()
    );
    expect(customer!.creditLimit).toBeNull();
  });
});

describe("mapStockMovements", () => {
  it("skips movements whose variant no longer exists", () => {
    const ids = new IdMap();
    const rows: SqlRow[] = [
      { id: 1, variant_id: 1, quantity_change: 5, reason: "SOLD", note: null, created_at: 0 },
      { id: 2, variant_id: 99, quantity_change: 5, reason: "SOLD", note: null, created_at: 0 }, // 99 deleted
    ];
    const movements = mapStockMovements(rows, ids, new Set([1]));
    expect(movements).toHaveLength(1);
    expect(movements[0]!.quantityDelta).toBe(5);
  });

  it("maps Android reasons to core reasons", () => {
    const ids = new IdMap();
    const rows: SqlRow[] = [{ id: 1, variant_id: 1, quantity_change: 1, reason: "RECEIVED", note: null, created_at: 0 }];
    const [movement] = mapStockMovements(rows, ids, new Set([1]));
    expect(movement!.reason).toBe("purchase");
  });
});

describe("mapInvoices", () => {
  it("skips RETURN-type invoices and counts them", () => {
    const ids = new IdMap();
    const rows: SqlRow[] = [
      { id: 1, type: "SALE", number: "INV-1", created_at: 0, customer_id: null },
      { id: 2, type: "RETURN", number: "CN-1", created_at: 0, customer_id: null },
    ];
    const lines = new Map<number, SqlRow[]>([
      [1, [{ variant_id: 10, quantity: 1, unit_price_minor: 1000, discount_minor: 0, gst_rate_bp: 0 }]],
    ]);
    const { imported, skippedReturns } = mapInvoices(rows, lines, new Map(), ids, new Set([10]), () => newId());
    expect(imported).toHaveLength(1);
    expect(skippedReturns).toBe(1);
  });

  it("uses a placeholder variant for a line whose product was deleted on Android", () => {
    const ids = new IdMap();
    const rows: SqlRow[] = [{ id: 1, type: "SALE", number: "INV-1", created_at: 0, customer_id: null }];
    const lines = new Map<number, SqlRow[]>([
      [1, [{ variant_id: null, quantity: 1, unit_price_minor: 500, discount_minor: 0, gst_rate_bp: 0 }]],
    ]);
    const placeholderId = newId();
    const { imported } = mapInvoices(rows, lines, new Map(), ids, new Set(), () => placeholderId);
    expect(imported[0]!.lines[0]!.productVariantId).toBe(placeholderId);
  });

  it("derives paymentStatus from the payment total vs. the line total", () => {
    const ids = new IdMap();
    const rows: SqlRow[] = [{ id: 1, type: "SALE", number: "INV-1", created_at: 0, customer_id: null }];
    const lines = new Map<number, SqlRow[]>([
      [1, [{ variant_id: 10, quantity: 1, unit_price_minor: 10000, discount_minor: 0, gst_rate_bp: 0 }]],
    ]);
    const payments = new Map<number, number>([[1, 10000]]); // paid in full, in paise
    const { imported } = mapInvoices(rows, lines, payments, ids, new Set([10]), () => newId());
    expect(imported[0]!.paymentStatus).toBe("paid");
    expect(imported[0]!.amountPaid).toBe(100);
  });

  it("skips a SALE invoice that ended up with no lines", () => {
    const ids = new IdMap();
    const rows: SqlRow[] = [{ id: 1, type: "SALE", number: "INV-1", created_at: 0, customer_id: null }];
    const { imported, skippedNoLines } = mapInvoices(rows, new Map(), new Map(), ids, new Set(), () => newId());
    expect(imported).toHaveLength(0);
    expect(skippedNoLines).toBe(1);
  });
});
