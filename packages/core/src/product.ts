import { newEntityBase, type Entity } from "./entity.js";
import type { UUID } from "./ids.js";

export class CatalogError extends Error {}

export interface Category extends Entity {
  name: string;
  /** First-time setup starts with every category unticked by the owner. */
  enabled: boolean;
}

/** New categories always start unticked — the owner opts each one in. */
export function newCategory(name: string): Category {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new CatalogError("Category name is required.");
  }
  return { ...newEntityBase(), name: trimmed, enabled: false };
}

export interface Product extends Entity {
  categoryId: UUID | null;
  name: string;
  /** GST/other tax rate as a percentage, e.g. 5 for 5%. Null = use category/shop default. */
  taxRatePercent: number | null;
}

export interface NewProductInput {
  categoryId: UUID | null;
  name: string;
  taxRatePercent: number | null;
}

export function validateProductInput(input: NewProductInput): void {
  if (input.name.trim().length === 0) {
    throw new CatalogError("Product name is required.");
  }
  if (input.taxRatePercent !== null && (input.taxRatePercent < 0 || input.taxRatePercent > 100)) {
    throw new CatalogError("Tax rate must be between 0 and 100.");
  }
}

export function newProduct(input: NewProductInput): Product {
  validateProductInput(input);
  return {
    ...newEntityBase(),
    categoryId: input.categoryId,
    name: input.name.trim(),
    taxRatePercent: input.taxRatePercent,
  };
}

export interface ProductVariant extends Entity {
  productId: UUID;
  name: string;
  sku: string | null;
  barcode: string | null;
  mrp: number;
  sellingPrice: number;
}

export interface NewProductVariantInput {
  productId: UUID;
  name: string;
  sku: string | null;
  barcode: string | null;
  mrp: number;
  sellingPrice: number;
}

export function validateProductVariantInput(input: NewProductVariantInput): void {
  if (input.name.trim().length === 0) {
    throw new CatalogError("Variant name is required.");
  }
  if (input.mrp < 0) {
    throw new CatalogError("MRP cannot be negative.");
  }
  if (input.sellingPrice < 0) {
    throw new CatalogError("Selling price cannot be negative.");
  }
}

export function newProductVariant(input: NewProductVariantInput): ProductVariant {
  validateProductVariantInput(input);
  return {
    ...newEntityBase(),
    productId: input.productId,
    name: input.name.trim(),
    sku: input.sku?.trim() || null,
    barcode: input.barcode?.trim() || null,
    mrp: input.mrp,
    sellingPrice: input.sellingPrice,
  };
}

/**
 * MRP vs selling price is shown on invoices as a discount, per Android
 * invoice-copy rules — never as a silently different price.
 */
export function impliedDiscount(variant: Pick<ProductVariant, "mrp" | "sellingPrice">): number {
  return Math.max(0, variant.mrp - variant.sellingPrice);
}
