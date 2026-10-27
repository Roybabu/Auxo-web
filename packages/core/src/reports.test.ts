import { describe, expect, it } from "vitest";
import { newId } from "./ids.js";
import { newInvoiceLine, newInvoice, type Invoice } from "./invoice.js";
import { inventoryValue, salesSummary, topCustomersBySpend, topProductsByQuantity } from "./reports.js";

function completedInvoice(overrides: {
  customerId?: string | null;
  lines: Parameters<typeof newInvoiceLine>[0][];
}): Invoice {
  const lines = overrides.lines.map((input) => newInvoiceLine(input));
  return newInvoice({
    invoiceNumber: `A3K9QZ-${Math.floor(Math.random() * 100000)}`,
    customerId: overrides.customerId ?? null,
    employeeId: newId(),
    lines,
    status: "completed",
    amountPaid: lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    createdDeviceId: "A3K9QZ",
  });
}

describe("salesSummary", () => {
  it("returns zeros for no invoices", () => {
    expect(salesSummary([])).toEqual({
      invoiceCount: 0,
      totalSales: 0,
      totalTax: 0,
      totalDiscount: 0,
      averageSale: 0,
    });
  });

  it("sums totals, tax, and discount across invoices", () => {
    const variantId = newId();
    const invoices = [
      completedInvoice({ lines: [{ productVariantId: variantId, quantity: 1, unitPrice: 100, taxRatePercent: 5 }] }), // 105
      completedInvoice({
        lines: [{ productVariantId: variantId, quantity: 1, unitPrice: 50, discountAmount: 10 }],
      }), // 40
    ];
    const summary = salesSummary(invoices);
    expect(summary.invoiceCount).toBe(2);
    expect(summary.totalSales).toBe(145);
    expect(summary.totalTax).toBe(5);
    expect(summary.totalDiscount).toBe(10);
    expect(summary.averageSale).toBe(72.5);
  });
});

describe("topProductsByQuantity", () => {
  it("ranks variants by total quantity sold across invoices", () => {
    const popular = newId();
    const rare = newId();
    const invoices = [
      completedInvoice({ lines: [{ productVariantId: popular, quantity: 5, unitPrice: 10 }] }),
      completedInvoice({
        lines: [
          { productVariantId: popular, quantity: 3, unitPrice: 10 },
          { productVariantId: rare, quantity: 1, unitPrice: 20 },
        ],
      }),
    ];
    const ranked = topProductsByQuantity(invoices);
    expect(ranked[0]?.productVariantId).toBe(popular);
    expect(ranked[0]?.quantitySold).toBe(8);
    expect(ranked[1]?.productVariantId).toBe(rare);
    expect(ranked[1]?.quantitySold).toBe(1);
  });

  it("respects the limit", () => {
    const invoices = Array.from({ length: 5 }, (_, i) =>
      completedInvoice({ lines: [{ productVariantId: newId(), quantity: i + 1, unitPrice: 10 }] })
    );
    expect(topProductsByQuantity(invoices, 2)).toHaveLength(2);
  });
});

describe("topCustomersBySpend", () => {
  it("excludes walk-in (null customerId) sales", () => {
    const customerId = newId();
    const invoices = [
      completedInvoice({ customerId, lines: [{ productVariantId: newId(), quantity: 1, unitPrice: 100 }] }),
      completedInvoice({ customerId: null, lines: [{ productVariantId: newId(), quantity: 1, unitPrice: 999 }] }),
    ];
    const ranked = topCustomersBySpend(invoices);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.customerId).toBe(customerId);
    expect(ranked[0]?.totalSpend).toBe(100);
  });

  it("aggregates multiple invoices from the same customer", () => {
    const customerId = newId();
    const invoices = [
      completedInvoice({ customerId, lines: [{ productVariantId: newId(), quantity: 1, unitPrice: 100 }] }),
      completedInvoice({ customerId, lines: [{ productVariantId: newId(), quantity: 1, unitPrice: 50 }] }),
    ];
    const ranked = topCustomersBySpend(invoices);
    expect(ranked[0]?.invoiceCount).toBe(2);
    expect(ranked[0]?.totalSpend).toBe(150);
  });
});

describe("inventoryValue", () => {
  it("values stock on hand at selling price", () => {
    const v1 = { id: "v1", sellingPrice: 90 } as never;
    const v2 = { id: "v2", sellingPrice: 10 } as never;
    const stock = new Map([
      ["v1", 5],
      ["v2", 20],
    ]);
    expect(inventoryValue([v1, v2], stock)).toBe(5 * 90 + 20 * 10);
  });

  it("treats a variant with no stock movements as zero", () => {
    const v1 = { id: "v1", sellingPrice: 90 } as never;
    expect(inventoryValue([v1], new Map())).toBe(0);
  });
});
