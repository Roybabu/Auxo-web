import { describe, expect, it } from "vitest";
import { newId } from "./ids.js";
import { invoiceBalanceDue, invoiceTotal, lineSubtotal, lineTax, type InvoiceLine } from "./invoice.js";

function line(overrides: Partial<InvoiceLine> = {}): InvoiceLine {
  return {
    id: newId(),
    productVariantId: newId(),
    quantity: 1,
    unitPrice: 100,
    discountAmount: 0,
    taxRatePercent: 0,
    ...overrides,
  };
}

describe("invoice math", () => {
  it("lineSubtotal applies quantity and discount", () => {
    expect(lineSubtotal(line({ quantity: 2, unitPrice: 50, discountAmount: 10 }))).toBe(90);
  });

  it("lineTax applies the rate to the discounted subtotal", () => {
    expect(lineTax(line({ quantity: 1, unitPrice: 100, discountAmount: 0, taxRatePercent: 5 }))).toBe(5);
  });

  it("invoiceTotal sums subtotal + tax across lines", () => {
    const invoice = {
      lines: [
        line({ quantity: 1, unitPrice: 100, taxRatePercent: 5 }), // 100 + 5 = 105
        line({ quantity: 2, unitPrice: 50, discountAmount: 20, taxRatePercent: 0 }), // (100-20) = 80
      ],
    };
    expect(invoiceTotal(invoice)).toBe(185);
  });

  it("invoiceBalanceDue subtracts amountPaid from the total", () => {
    const invoice = {
      lines: [line({ quantity: 1, unitPrice: 100, taxRatePercent: 0 })],
      amountPaid: 40,
    };
    expect(invoiceBalanceDue(invoice)).toBe(60);
  });
});
