import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOYALTY_SETTINGS,
  LoyaltyError,
  applyPointsDelta,
  pointsEarnedForSale,
  redemptionValue,
  validateLoyaltyProgramSettings,
} from "./loyalty.js";

describe("validateLoyaltyProgramSettings", () => {
  it("rejects a negative earn rate", () => {
    expect(() =>
      validateLoyaltyProgramSettings({ ...DEFAULT_LOYALTY_SETTINGS, pointsPerRupeeSpent: -1 })
    ).toThrow(LoyaltyError);
  });

  it("rejects a negative redemption value", () => {
    expect(() =>
      validateLoyaltyProgramSettings({ ...DEFAULT_LOYALTY_SETTINGS, redemptionValuePerPoint: -1 })
    ).toThrow(LoyaltyError);
  });

  it("accepts the defaults", () => {
    expect(() => validateLoyaltyProgramSettings(DEFAULT_LOYALTY_SETTINGS)).not.toThrow();
  });
});

describe("pointsEarnedForSale", () => {
  it("earns points at the configured rate, rounded down", () => {
    expect(pointsEarnedForSale(250, DEFAULT_LOYALTY_SETTINGS)).toBe(2); // 250 * 0.01 = 2.5 -> 2
  });

  it("earns nothing when the program is disabled", () => {
    expect(pointsEarnedForSale(1000, { ...DEFAULT_LOYALTY_SETTINGS, enabled: false })).toBe(0);
  });

  it("earns nothing for a zero or negative amount", () => {
    expect(pointsEarnedForSale(0, DEFAULT_LOYALTY_SETTINGS)).toBe(0);
    expect(pointsEarnedForSale(-50, DEFAULT_LOYALTY_SETTINGS)).toBe(0);
  });
});

describe("redemptionValue", () => {
  it("multiplies points by the redemption rate", () => {
    expect(redemptionValue(10, DEFAULT_LOYALTY_SETTINGS)).toBe(10);
    expect(redemptionValue(10, { ...DEFAULT_LOYALTY_SETTINGS, redemptionValuePerPoint: 0.5 })).toBe(5);
  });
});

describe("applyPointsDelta", () => {
  it("adds a positive delta", () => {
    expect(applyPointsDelta(5, 3)).toBe(8);
  });

  it("subtracts a negative delta", () => {
    expect(applyPointsDelta(5, -3)).toBe(2);
  });

  it("refuses to go below zero", () => {
    expect(() => applyPointsDelta(5, -10)).toThrow(LoyaltyError);
  });
});
