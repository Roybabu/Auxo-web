import { describe, expect, it } from "vitest";
import { BusinessSetupError, newBusiness, validateBusinessSetup } from "./business.js";

describe("business setup", () => {
  it("requires a business name", () => {
    expect(() => validateBusinessSetup({ businessName: "  ", ownerName: "Ravi" })).toThrow(
      BusinessSetupError
    );
  });

  it("requires an owner name", () => {
    expect(() => validateBusinessSetup({ businessName: "Roy Stores", ownerName: "" })).toThrow(
      BusinessSetupError
    );
  });

  it("trims whitespace when creating the business record", () => {
    const business = newBusiness({ businessName: "  Roy Stores  ", ownerName: " Ravi " });
    expect(business.name).toBe("Roy Stores");
    expect(business.ownerName).toBe("Ravi");
  });
});
