import { newEntityBase, type Entity } from "./entity.js";
import { newId, type UUID } from "./ids.js";

export class BillingError extends Error {}

export type InvoiceStatus =
  | "held" // parked, not yet finalized
  | "completed"
  | "voided";

export type PaymentStatus = "paid" | "part_paid" | "on_credit" | "return";

export interface InvoiceLine {
  id: UUID;
  productVariantId: UUID;
  quantity: number;
  unitPrice: number;
  /** Per-line discount amount (absolute, in the shop's currency), if any. */
  discountAmount: number;
  taxRatePercent: number;
}

export interface Invoice extends Entity {
  invoiceNumber: string; // see invoiceNumber.ts — embeds the device ID
  customerId: UUID | null;
  employeeId: UUID | null;
  lines: readonly InvoiceLine[];
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  /** Held/parked bills for table-based shops require a table number. */
  tableNumber: string | null;
  amountPaid: number;
  createdDeviceId: string;
}

export function lineSubtotal(line: Pick<InvoiceLine, "quantity" | "unitPrice" | "discountAmount">): number {
  return line.quantity * line.unitPrice - line.discountAmount;
}

export function lineTax(line: Pick<InvoiceLine, "quantity" | "unitPrice" | "discountAmount" | "taxRatePercent">): number {
  return lineSubtotal(line) * (line.taxRatePercent / 100);
}

type LineForTotal = Pick<InvoiceLine, "quantity" | "unitPrice" | "discountAmount" | "taxRatePercent">;

/**
 * Takes only the fields actually needed for the math, not a full Invoice
 * — callers (like a billing screen's in-progress cart) can compute
 * running totals before lines have ids or belong to a saved invoice.
 */
export function invoiceTotal(invoice: { lines: readonly LineForTotal[] }): number {
  return invoice.lines.reduce((sum, line) => sum + lineSubtotal(line) + lineTax(line), 0);
}

export function invoiceBalanceDue(invoice: { lines: readonly LineForTotal[]; amountPaid: number }): number {
  return invoiceTotal(invoice) - invoice.amountPaid;
}

export interface NewInvoiceLineInput {
  productVariantId: UUID;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxRatePercent?: number;
}

export function newInvoiceLine(input: NewInvoiceLineInput): InvoiceLine {
  const discountAmount = input.discountAmount ?? 0;
  const taxRatePercent = input.taxRatePercent ?? 0;

  if (input.quantity <= 0) {
    throw new BillingError("Quantity must be greater than zero.");
  }
  if (input.unitPrice < 0) {
    throw new BillingError("Unit price cannot be negative.");
  }
  if (discountAmount < 0) {
    throw new BillingError("Discount cannot be negative.");
  }
  const grossAmount = input.quantity * input.unitPrice;
  if (discountAmount > grossAmount) {
    throw new BillingError("Discount cannot exceed the line amount before discount.");
  }
  if (taxRatePercent < 0 || taxRatePercent > 100) {
    throw new BillingError("Tax rate must be between 0 and 100.");
  }

  return {
    id: newId(),
    productVariantId: input.productVariantId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    discountAmount,
    taxRatePercent,
  };
}

/**
 * Derives payment status from the total and what's been paid so far.
 * "return" is never derived here — it's set explicitly when a return is
 * recorded, not inferred from amounts.
 */
export function computePaymentStatus(total: number, amountPaid: number): Exclude<PaymentStatus, "return"> {
  if (amountPaid <= 0) return "on_credit";
  if (amountPaid >= total) return "paid";
  return "part_paid";
}

export interface NewInvoiceInput {
  invoiceNumber: string;
  customerId: UUID | null;
  employeeId: UUID | null;
  lines: readonly InvoiceLine[];
  status: InvoiceStatus;
  tableNumber?: string | null;
  amountPaid?: number;
  createdDeviceId: string;
}

export function newInvoice(input: NewInvoiceInput): Invoice {
  if (input.status === "completed" && input.lines.length === 0) {
    throw new BillingError("Cannot complete an invoice with no line items.");
  }
  const amountPaid = input.amountPaid ?? 0;
  if (amountPaid < 0) {
    throw new BillingError("Amount paid cannot be negative.");
  }

  const total = invoiceTotal({ lines: input.lines });
  return {
    ...newEntityBase(),
    invoiceNumber: input.invoiceNumber,
    customerId: input.customerId,
    employeeId: input.employeeId,
    lines: input.lines,
    status: input.status,
    paymentStatus: input.status === "held" ? "on_credit" : computePaymentStatus(total, amountPaid),
    tableNumber: input.tableNumber ?? null,
    amountPaid,
    createdDeviceId: input.createdDeviceId,
  };
}
