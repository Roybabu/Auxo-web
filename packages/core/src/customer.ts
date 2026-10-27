import type { Entity } from "./entity.js";

export interface Customer extends Entity {
  name: string;
  phone: string | null;
  /** Running credit balance: positive = customer owes the shop. */
  creditLimit: number | null;
}

/**
 * Masks a phone number for invoice printing: hides the last 6 digits,
 * per the Android invoice-copy rule.
 */
export function maskPhoneForInvoice(phone: string | null): string | null {
  if (phone === null) return null;
  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length <= 6) {
    return "*".repeat(digitsOnly.length);
  }
  const visible = digitsOnly.slice(0, digitsOnly.length - 6);
  return `${visible}${"*".repeat(6)}`;
}
