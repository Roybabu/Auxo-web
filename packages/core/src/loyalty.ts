export class LoyaltyError extends Error {}

export interface LoyaltyProgramSettings {
  enabled: boolean;
  /** Points earned per rupee spent, e.g. 0.01 = 1 point per ₹100. */
  pointsPerRupeeSpent: number;
  /** Rupee value of one point when redeemed. */
  redemptionValuePerPoint: number;
}

export const DEFAULT_LOYALTY_SETTINGS: LoyaltyProgramSettings = {
  enabled: true,
  pointsPerRupeeSpent: 0.01,
  redemptionValuePerPoint: 1,
};

export function validateLoyaltyProgramSettings(settings: LoyaltyProgramSettings): void {
  if (!Number.isFinite(settings.pointsPerRupeeSpent) || settings.pointsPerRupeeSpent < 0) {
    throw new LoyaltyError("Points per rupee spent cannot be negative.");
  }
  if (!Number.isFinite(settings.redemptionValuePerPoint) || settings.redemptionValuePerPoint < 0) {
    throw new LoyaltyError("Redemption value per point cannot be negative.");
  }
}

/** Points a sale of this amount earns, rounded down to a whole point. */
export function pointsEarnedForSale(amount: number, settings: LoyaltyProgramSettings): number {
  if (!settings.enabled || amount <= 0) return 0;
  return Math.floor(amount * settings.pointsPerRupeeSpent);
}

/** Rupee value of a number of points, at the program's current redemption rate. */
export function redemptionValue(points: number, settings: LoyaltyProgramSettings): number {
  return points * settings.redemptionValuePerPoint;
}

/** Applies a signed points change (earn = positive, redeem = negative), refusing to go negative. */
export function applyPointsDelta(currentPoints: number, delta: number): number {
  const next = currentPoints + delta;
  if (next < 0) {
    throw new LoyaltyError("That would take the customer's points balance below zero.");
  }
  return next;
}
