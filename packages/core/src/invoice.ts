import type { Entity } from "./entity.js";
import type { UUID } from "./ids.js";

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

export function invoiceTotal(invoice: Pick<Invoice, "lines">): number {
  return invoice.lines.reduce((sum, line) => sum + lineSubtotal(line) + lineTax(line), 0);
}

export function invoiceBalanceDue(invoice: Pick<Invoice, "lines" | "amountPaid">): number {
  return invoiceTotal(invoice) - invoice.amountPaid;
}
