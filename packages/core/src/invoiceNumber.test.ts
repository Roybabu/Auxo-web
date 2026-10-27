import { describe, expect, it } from "vitest";
import { formatInvoiceNumber, nextSequence, parseInvoiceNumber } from "./invoiceNumber.js";

describe("invoiceNumber", () => {
  it("formats device ID and padded sequence", () => {
    expect(formatInvoiceNumber({ deviceId: "A3K9QZ", sequence: 42 })).toBe("A3K9QZ-000042");
  });

  it("round-trips through parse", () => {
    const formatted = formatInvoiceNumber({ deviceId: "B7P2LM", sequence: 7 });
    expect(parseInvoiceNumber(formatted)).toEqual({ deviceId: "B7P2LM", sequence: 7 });
  });

  it("rejects non-positive or non-integer sequences", () => {
    expect(() => formatInvoiceNumber({ deviceId: "A3K9QZ", sequence: 0 })).toThrow();
    expect(() => formatInvoiceNumber({ deviceId: "A3K9QZ", sequence: -1 })).toThrow();
    expect(() => formatInvoiceNumber({ deviceId: "A3K9QZ", sequence: 1.5 })).toThrow();
  });

  it("two devices never collide on the same sequence", () => {
    const a = formatInvoiceNumber({ deviceId: "A3K9QZ", sequence: 42 });
    const b = formatInvoiceNumber({ deviceId: "B7P2LM", sequence: 42 });
    expect(a).not.toBe(b);
  });

  it("nextSequence increments by one", () => {
    expect(nextSequence(41)).toBe(42);
  });
});
