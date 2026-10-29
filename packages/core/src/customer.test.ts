import { describe, expect, it } from "vitest";
import { CustomerError, maskPhoneForInvoice, newCustomer } from "./customer.js";

describe("maskPhoneForInvoice", () => {
  it("hides the last 6 digits", () => {
    expect(maskPhoneForInvoice("9876543210")).toBe("9876******");
  });

  it("masks entirely when 6 digits or fewer", () => {
    expect(maskPhoneForInvoice("12345")).toBe("*****");
  });

  it("passes through null", () => {
    expect(maskPhoneForInvoice(null)).toBeNull();
  });

  it("strips non-digit characters before masking", () => {
    expect(maskPhoneForInvoice("+91 98765-43210")).toBe("919876******");
  });
});

describe("newCustomer", () => {
  it("rejects an empty name", () => {
    expect(() => newCustomer({ name: "   " })).toThrow(CustomerError);
  });

  it("rejects a negative credit limit", () => {
    expect(() => newCustomer({ name: "Asha", creditLimit: -1 })).toThrow(CustomerError);
  });

  it("normalizes a blank phone to null", () => {
    const customer = newCustomer({ name: "Asha", phone: "  " });
    expect(customer.phone).toBeNull();
  });

  it("creates a trimmed, valid customer", () => {
    const customer = newCustomer({ name: "  Asha  ", phone: "9876543210", creditLimit: 500 });
    expect(customer.name).toBe("Asha");
    expect(customer.phone).toBe("9876543210");
    expect(customer.creditLimit).toBe(500);
  });

  it("starts with zero loyalty points", () => {
    expect(newCustomer({ name: "Asha" }).loyaltyPoints).toBe(0);
  });
});
