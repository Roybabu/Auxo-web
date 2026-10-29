import { describe, expect, it } from "vitest";
import { SupplierError, newSupplier } from "./supplier.js";

describe("newSupplier", () => {
  it("rejects an empty name", () => {
    expect(() => newSupplier({ name: "   " })).toThrow(SupplierError);
  });

  it("normalizes blank optional fields to null", () => {
    const supplier = newSupplier({ name: "Acme Traders", phone: "  ", email: "", address: "  " });
    expect(supplier.phone).toBeNull();
    expect(supplier.email).toBeNull();
    expect(supplier.address).toBeNull();
    expect(supplier.gstin).toBeNull();
  });

  it("creates a trimmed, valid supplier", () => {
    const supplier = newSupplier({
      name: "  Acme Traders  ",
      phone: "9876543210",
      email: "acme@example.com",
      gstin: "22AAAAA0000A1Z5",
    });
    expect(supplier.name).toBe("Acme Traders");
    expect(supplier.phone).toBe("9876543210");
    expect(supplier.email).toBe("acme@example.com");
    expect(supplier.gstin).toBe("22AAAAA0000A1Z5");
  });
});
