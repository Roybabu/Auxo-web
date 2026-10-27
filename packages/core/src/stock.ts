import { newEntityBase, type Entity } from "./entity.js";
import type { UUID } from "./ids.js";

export class StockError extends Error {}

/**
 * Stock is derived from an append-only ledger of movements, never from
 * an overwritten "current quantity" field. This makes stock auditable,
 * reversible, and safe to sync later (two devices' movements can both
 * be replayed; two overwritten totals cannot be merged).
 */
export type StockMovementReason =
  | "initial_stock"
  | "sale"
  | "sale_return"
  | "purchase"
  | "purchase_return"
  | "manual_adjustment"
  | "stock_take";

export interface StockMovement extends Entity {
  productVariantId: UUID;
  /** Positive = stock in, negative = stock out. */
  quantityDelta: number;
  reason: StockMovementReason;
  /** Invoice, purchase bill, or adjustment note this movement is tied to, if any. */
  referenceId: UUID | null;
  note: string | null;
}

/**
 * Computes current stock for a variant from its movement history.
 * Deleted (reversed) movements are excluded.
 */
export function currentStock(movements: readonly StockMovement[]): number {
  return movements
    .filter((m) => m.deletedAt === null)
    .reduce((total, m) => total + m.quantityDelta, 0);
}

export interface NewStockMovementInput {
  productVariantId: UUID;
  quantityDelta: number;
  reason: StockMovementReason;
  referenceId?: UUID | null;
  note?: string | null;
}

export function newStockMovement(input: NewStockMovementInput): StockMovement {
  if (input.quantityDelta === 0) {
    throw new StockError("A stock movement must change the quantity by a non-zero amount.");
  }
  if (!Number.isFinite(input.quantityDelta)) {
    throw new StockError("Stock quantity must be a finite number.");
  }
  return {
    ...newEntityBase(),
    productVariantId: input.productVariantId,
    quantityDelta: input.quantityDelta,
    reason: input.reason,
    referenceId: input.referenceId ?? null,
    note: input.note ?? null,
  };
}

/** Convenience: current stock per variant from a mixed list of movements. */
export function stockByVariant(
  movements: readonly StockMovement[]
): Map<UUID, number> {
  const totals = new Map<UUID, number>();
  for (const m of movements) {
    if (m.deletedAt !== null) continue;
    totals.set(m.productVariantId, (totals.get(m.productVariantId) ?? 0) + m.quantityDelta);
  }
  return totals;
}
