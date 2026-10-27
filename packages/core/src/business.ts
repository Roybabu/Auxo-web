import type { ISODateTime } from "./entity.js";
import { nowISO } from "./entity.js";

/**
 * The shop's own profile. A singleton (not an Entity with soft-delete —
 * there is exactly one business per install), stored by the app under a
 * reserved settings key. GST/FSSAI numbers are added in a later step,
 * per the build order; name and owner name are enough to get through
 * setup.
 */
export interface Business {
  name: string;
  ownerName: string;
  createdAt: ISODateTime;
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
