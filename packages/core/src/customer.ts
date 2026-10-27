import { newEntityBase, type Entity } from "./entity.js";

export class CustomerError extends Error {}

export interface Customer extends Entity {
  name: string;
  phone: string | null;
  /** Running credit balance: positive = customer owes the shop. */
  creditLimit: number | null;
}

export interface NewCustomerInput {
  name: string;
  phone?: string | null;
  creditLimit?: number | null;
}

export function validateCustomerInput(input: NewCustomerInput): void {
  if (input.name.trim().length === 0) {
    throw new CustomerError("Customer name is required.");
  }
  if (input.creditLimit != null && input.creditLimit < 0) {
    throw new CustomerError("Credit limit cannot be negative.");
  }
}

export function newCustomer(input: NewCustomerInput): Customer {
  validateCustomerInput(input);
  return {
    ...newEntityBase(),
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    creditLimit: input.creditLimit ?? null,
  };
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
