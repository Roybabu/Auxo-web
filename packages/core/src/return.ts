import { newEntityBase, type Entity } from "./entity.js";
import { newId, type UUID } from "./ids.js";

export class ReturnError extends Error {}

/**
 * How the shop makes the customer whole for a return.
 * "store_credit" issues a credit note the customer can use against a
 * future purchase; "cash_refund" hands money back immediately.
 */
export type ReturnResolution = "cash_refund" | "store_credit";

export interface ReturnLine {
  id: UUID;
  productVariantId: UUID;
  quantity: number;
  /** Unit price from the original sale — the refund is computed from this, not today's price. */
  unitPrice: number;
}

export interface Return extends Entity {
  returnNumber: string; // same "{deviceId}-{sequence}" scheme as invoices/purchases
  invoiceId: UUID;
  customerId: UUID | null;
  employeeId: UUID | null;
  lines: readonly ReturnLine[];
  resolution: ReturnResolution;
  note: string | null;
}

export function lineRefund(line: Pick<ReturnLine, "quantity" | "unitPrice">): number {
  return line.quantity * line.unitPrice;
}

type LineForTotal = Pick<ReturnLine, "quantity" | "unitPrice">;

export function returnTotal(ret: { lines: readonly LineForTotal[] }): number {
  return ret.lines.reduce((sum, line) => sum + lineRefund(line), 0);
}

export interface NewReturnLineInput {
  productVariantId: UUID;
  quantity: number;
  unitPrice: number;
}

export function validateReturnLineInput(input: NewReturnLineInput): void {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new ReturnError("Return quantity must be a positive number.");
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
    throw new ReturnError("Unit price cannot be negative.");
  }
}

export function newReturnLine(input: NewReturnLineInput): ReturnLine {
  validateReturnLineInput(input);
  return {
    id: newId(),
    productVariantId: input.productVariantId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
  };
}

export interface NewReturnInput {
  returnNumber: string;
  invoiceId: UUID;
  customerId: UUID | null;
  employeeId: UUID | null;
  lines: readonly ReturnLine[];
  resolution: ReturnResolution;
  note?: string | null;
}

export function validateNewReturnInput(input: NewReturnInput): void {
  if (input.lines.length === 0) {
    throw new ReturnError("A return needs at least one line item.");
  }
  if (input.resolution === "store_credit" && input.customerId === null) {
    throw new ReturnError("Store credit requires a customer — walk-in sales can only be cash refunded.");
  }
}

export function newReturn(input: NewReturnInput): Return {
  validateNewReturnInput(input);
  return {
    ...newEntityBase(),
    returnNumber: input.returnNumber,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    employeeId: input.employeeId,
    lines: input.lines,
    resolution: input.resolution,
    note: input.note ?? null,
  };
}

/** Quantity already returned per variant across a set of returns — used to cap a new return at what's left. */
export function returnedQuantityByVariant(returns: readonly Pick<Return, "lines" | "deletedAt">[]): Map<UUID, number> {
  const totals = new Map<UUID, number>();
  for (const ret of returns) {
    if (ret.deletedAt !== null) continue;
    for (const line of ret.lines) {
      totals.set(line.productVariantId, (totals.get(line.productVariantId) ?? 0) + line.quantity);
    }
  }
  return totals;
}
