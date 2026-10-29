import { newEntityBase, type Entity } from "./entity.js";

export class SupplierError extends Error {}

export interface Supplier extends Entity {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  /** GST identification number, if the supplier is GST-registered. */
  gstin: string | null;
}

export interface NewSupplierInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
}

export function validateSupplierInput(input: NewSupplierInput): void {
  if (input.name.trim().length === 0) {
    throw new SupplierError("Supplier name is required.");
  }
}

export function newSupplier(input: NewSupplierInput): Supplier {
  validateSupplierInput(input);
  return {
    ...newEntityBase(),
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    gstin: input.gstin?.trim() || null,
  };
}
