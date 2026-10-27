import { describe, expect, it } from "vitest";
import { newEntityBase } from "./entity.js";
import { currentStock, stockByVariant, type StockMovement } from "./stock.js";

function movement(
  productVariantId: string,
  quantityDelta: number,
  overrides: Partial<StockMovement> = {}
): StockMovement {
  return {
    ...newEntityBase(),
    productVariantId,
    quantityDelta,
    reason: "manual_adjustment",
    referenceId: null,
    note: null,
    ...overrides,
  };
}

describe("stock", () => {
  it("sums movements to get current stock", () => {
    const movements = [movement("v1", 10), movement("v1", -3), movement("v1", 5)];
    expect(currentStock(movements)).toBe(12);
  });

  it("excludes soft-deleted (reversed) movements", () => {
    const reversed = movement("v1", -3, { deletedAt: new Date().toISOString() });
    const movements = [movement("v1", 10), reversed];
    expect(currentStock(movements)).toBe(10);
  });

  it("stockByVariant groups totals per variant", () => {
    const movements = [movement("v1", 10), movement("v2", 4), movement("v1", -2)];
    const totals = stockByVariant(movements);
    expect(totals.get("v1")).toBe(8);
    expect(totals.get("v2")).toBe(4);
  });
});
