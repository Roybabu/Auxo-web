import type { ISODateTime } from "./entity.js";
import { nowISO } from "./entity.js";

/**
 * The shop's own profile. A singleton (not an Entity with soft-delete —
 * there is exactly one business per install), stored by the app under a
 * reserved settings key.
 */
export interface Business {
  name: string;
  ownerName: string;
  createdAt: ISODateTime;
  /** GST identification number, if registered. Optional — not every shop is GST-registered. */
  gstin?: string | null;
  /** FSSAI license number, if applicable (food businesses). */
  fssaiNumber?: string | null;
}

export interface BusinessSetupInput {
  businessName: string;
  ownerName: string;
}

export class BusinessSetupError extends Error {}

export function validateBusinessSetup(input: BusinessSetupInput): void {
  if (input.businessName.trim().length === 0) {
    throw new BusinessSetupError("Business name is required.");
  }
  if (input.ownerName.trim().length === 0) {
    throw new BusinessSetupError("Owner name is required.");
  }
}

export function newBusiness(input: BusinessSetupInput): Business {
  validateBusinessSetup(input);
  return {
    name: input.businessName.trim(),
    ownerName: input.ownerName.trim(),
    createdAt: nowISO(),
  };
}
