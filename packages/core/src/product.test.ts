import { describe, expect, it } from "vitest";
import {
  CatalogError,
  impliedDiscount,
  newCategory,
  newProduct,
  newProductVariant,
} from "./product.js";

describe("impliedDiscount", () => {
  it("returns the gap between MRP and selling price", () => {
    expect(impliedDiscount({ mrp: 100, sellingPrice: 80 })).toBe(20);
  });

  it("never returns negative when selling price exceeds MRP", () => {
    expect(impliedDiscount({ mrp: 100, sellingPrice: 120 })).toBe(0);
  });

  it("returns zero when prices match", () => {
    expect(impliedDiscount({ mrp: 50, sellingPrice: 50 })).toBe(0);
  });
});

describe("newCategory", () => {
  it("always starts unticked, regardless of input", () => {
    expect(newCategory("Beverages").enabled).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(() => newCategory("   ")).toThrow(CatalogError);
  });
});

describe("newProduct", () => {
  it("rejects an empty name", () => {
    expect(() => newProduct({ categoryId: null, name: "  ", taxRatePercent: null })).toThrow(
      CatalogError
    );
  });

  it("rejects an out-of-range tax rate", () => {
    expect(() => newProduct({ categoryId: null, name: "Rice", taxRatePercent: 150 })).toThrow(
      CatalogError
    );
    expect(() => newProduct({ categoryId: null, name: "Rice", taxRatePercent: -1 })).toThrow(
      CatalogError
    );
  });

  it("creates a trimmed, valid product", () => {
    const product = newProduct({ categoryId: null, name: "  Rice  ", taxRatePercent: 5 });
    expect(product.name).toBe("Rice");
    expect(product.taxRatePercent).toBe(5);
  });
});

describe("newProductVariant", () => {
  const productId = "11111111-1111-1111-1111-111111111111";

  it("rejects a negative MRP or selling price", () => {
    expect(() =>
      newProductVariant({ productId, name: "1kg", sku: null, barcode: null, mrp: -1, sellingPrice: 10 })
    ).toThrow(CatalogError);
    expect(() =>
      newProductVariant({ productId, name: "1kg", sku: null, barcode: null, mrp: 10, sellingPrice: -1 })
    ).toThrow(CatalogError);
  });

  it("normalizes blank sku/barcode to null", () => {
    const variant = newProductVariant({
      productId,
      name: "1kg",
      sku: "  ",
      barcode: "",
      mrp: 100,
      sellingPrice: 90,
    });
    expect(variant.sku).toBeNull();
    expect(variant.barcode).toBeNull();
  });
});
