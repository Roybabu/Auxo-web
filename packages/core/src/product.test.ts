import { describe, expect, it } from "vitest";
import { impliedDiscount } from "./product.js";

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
