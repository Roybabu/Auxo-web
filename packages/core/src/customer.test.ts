import { describe, expect, it } from "vitest";
import { maskPhoneForInvoice } from "./customer.js";

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
