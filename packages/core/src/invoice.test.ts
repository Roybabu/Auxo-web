import { describe, expect, it } from "vitest";
import { newId } from "./ids.js";
import {
  BillingError,
  computePaymentStatus,
  invoiceBalanceDue,
  invoiceTotal,
  lineSubtotal,
  lineTax,
  newInvoice,
  newInvoiceLine,
  type InvoiceLine,
} from "./invoice.js";

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

describe("newInvoiceLine", () => {
  const productVariantId = newId();

  it("rejects a non-positive quantity", () => {
    expect(() => newInvoiceLine({ productVariantId, quantity: 0, unitPrice: 10 })).toThrow(BillingError);
    expect(() => newInvoiceLine({ productVariantId, quantity: -1, unitPrice: 10 })).toThrow(BillingError);
  });

  it("rejects a discount larger than the pre-discount line amount", () => {
    expect(() =>
      newInvoiceLine({ productVariantId, quantity: 1, unitPrice: 10, discountAmount: 11 })
    ).toThrow(BillingError);
  });

  it("rejects an out-of-range tax rate", () => {
    expect(() =>
      newInvoiceLine({ productVariantId, quantity: 1, unitPrice: 10, taxRatePercent: 101 })
    ).toThrow(BillingError);
  });

  it("defaults discount and tax to zero", () => {
    const line = newInvoiceLine({ productVariantId, quantity: 2, unitPrice: 50 });
    expect(line.discountAmount).toBe(0);
    expect(line.taxRatePercent).toBe(0);
  });
});

describe("computePaymentStatus", () => {
  it("is on_credit when nothing has been paid", () => {
    expect(computePaymentStatus(100, 0)).toBe("on_credit");
  });

  it("is part_paid when something but not everything has been paid", () => {
    expect(computePaymentStatus(100, 40)).toBe("part_paid");
  });

  it("is paid when the full amount (or more) has been paid", () => {
    expect(computePaymentStatus(100, 100)).toBe("paid");
    expect(computePaymentStatus(100, 150)).toBe("paid");
  });
});

describe("newInvoice", () => {
  const employeeId = newId();

  it("rejects completing an invoice with no lines", () => {
    expect(() =>
      newInvoice({
        invoiceNumber: "A3K9QZ-000001",
        customerId: null,
        employeeId,
        lines: [],
        status: "completed",
        createdDeviceId: "A3K9QZ",
      })
    ).toThrow(BillingError);
  });

  it("allows holding an invoice with no lines yet", () => {
    expect(() =>
      newInvoice({
        invoiceNumber: "A3K9QZ-000001",
        customerId: null,
        employeeId,
        lines: [],
        status: "held",
        createdDeviceId: "A3K9QZ",
      })
    ).not.toThrow();
  });

  it("derives paymentStatus from the total and amountPaid for a completed sale", () => {
    const line = newInvoiceLine({ productVariantId: newId(), quantity: 1, unitPrice: 100 });
    const invoice = newInvoice({
      invoiceNumber: "A3K9QZ-000001",
      customerId: null,
      employeeId,
      lines: [line],
      status: "completed",
      amountPaid: 100,
      createdDeviceId: "A3K9QZ",
    });
    expect(invoice.paymentStatus).toBe("paid");
    expect(invoice.status).toBe("completed");
  });

  it("a held invoice is always on_credit regardless of amountPaid", () => {
    const invoice = newInvoice({
      invoiceNumber: "A3K9QZ-000001",
      customerId: null,
      employeeId,
      lines: [],
      status: "held",
      createdDeviceId: "A3K9QZ",
    });
    expect(invoice.paymentStatus).toBe("on_credit");
  });
});
