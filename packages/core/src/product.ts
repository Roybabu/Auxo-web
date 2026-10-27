import type { Entity } from "./entity.js";
import type { UUID } from "./ids.js";

export interface Category extends Entity {
  name: string;
  /** First-time setup starts with every category unticked by the owner. */
  enabled: boolean;
}

export interface Product extends Entity {
  categoryId: UUID | null;
  name: string;
  /** GST/other tax rate as a percentage, e.g. 5 for 5%. Null = use category/shop default. */
  taxRatePercent: number | null;
}

export interface ProductVariant extends Entity {
  productId: UUID;
  name: string;
  sku: string | null;
  barcode: string | null;
  mrp: number;
  sellingPrice: number;
}

/**
 * MRP vs selling price is shown on invoices as a discount, per Android
 * invoice-copy rules — never as a silently different price.
 */
export function impliedDiscount(variant: Pick<ProductVariant, "mrp" | "sellingPrice">): number {
  return Math.max(0, variant.mrp - variant.sellingPrice);
}
