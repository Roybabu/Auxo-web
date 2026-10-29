import { newEntityBase, nowISO, type Entity } from "./entity.js";
import { newId, type UUID } from "./ids.js";

export class PurchaseError extends Error {}

/**
 * "draft" — being built, stock not yet affected.
 * "received" — goods received; stock movements have been posted.
 * "cancelled" — abandoned before receipt; never affects stock.
 */
export type PurchaseStatus = "draft" | "received" | "cancelled";

export interface PurchaseLine {
  id: UUID;
  productVariantId: UUID;
  quantity: number;
  /** Cost price paid to the supplier for this line, per unit. */
  unitCost: number;
}

export interface Purchase extends Entity {
  purchaseNumber: string; // see invoiceNumber.ts's format — reused here too
  supplierId: UUID;
  employeeId: UUID | null;
  lines: readonly PurchaseLine[];
  status: PurchaseStatus;
  amountPaid: number;
  note: string | null;
  /** Set once goods are marked received; null while still a draft. */
  receivedAt: string | null;
}

export function lineTotal(line: Pick<PurchaseLine, "quantity" | "unitCost">): number {
  return line.quantity * line.unitCost;
}

type LineForTotal = Pick<PurchaseLine, "quantity" | "unitCost">;

export function purchaseTotal(purchase: { lines: readonly LineForTotal[] }): number {
  return purchase.lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function purchaseBalanceDue(purchase: { lines: readonly LineForTotal[]; amountPaid: number }): number {
  return purchaseTotal(purchase) - purchase.amountPaid;
}

export interface NewPurchaseLineInput {
  productVariantId: UUID;
  quantity: number;
  unitCost: number;
}

export function validatePurchaseLineInput(input: NewPurchaseLineInput): void {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new PurchaseError("Quantity must be a positive number.");
  }
  if (!Number.isFinite(input.unitCost) || input.unitCost < 0) {
    throw new PurchaseError("Unit cost cannot be negative.");
  }
}

export function newPurchaseLine(input: NewPurchaseLineInput): PurchaseLine {
  validatePurchaseLineInput(input);
  return {
    id: newId(),
    productVariantId: input.productVariantId,
    quantity: input.quantity,
    unitCost: input.unitCost,
  };
}

export interface NewPurchaseInput {
  purchaseNumber: string;
  supplierId: UUID;
  employeeId: UUID | null;
  lines: readonly PurchaseLine[];
  amountPaid?: number;
  note?: string | null;
}

export function validateNewPurchaseInput(input: NewPurchaseInput): void {
  if (input.lines.length === 0) {
    throw new PurchaseError("A purchase needs at least one line item.");
  }
  if (input.amountPaid != null && input.amountPaid < 0) {
    throw new PurchaseError("Amount paid cannot be negative.");
  }
}

export function newPurchase(input: NewPurchaseInput): Purchase {
  validateNewPurchaseInput(input);
  return {
    ...newEntityBase(),
    purchaseNumber: input.purchaseNumber,
    supplierId: input.supplierId,
    employeeId: input.employeeId,
    lines: input.lines,
    status: "draft",
    amountPaid: input.amountPaid ?? 0,
    note: input.note ?? null,
    receivedAt: null,
  };
}

/** Marks a draft purchase received — callers are responsible for posting the matching stock movements. */
export function markPurchaseReceived(purchase: Purchase): Purchase {
  if (purchase.status !== "draft") {
    throw new PurchaseError("Only a draft purchase can be marked received.");
  }
  const ts = nowISO();
  return { ...purchase, status: "received", receivedAt: ts, updatedAt: ts };
}

export function cancelPurchase(purchase: Purchase): Purchase {
  if (purchase.status !== "draft") {
    throw new PurchaseError("Only a draft purchase can be cancelled.");
  }
  return { ...purchase, status: "cancelled", updatedAt: nowISO() };
}
