import { describe, expect, it } from "vitest";
import { newId } from "./ids.js";
import {
  ReturnError,
  newReturn,
  newReturnLine,
  returnTotal,
  returnedQuantityByVariant,
} from "./return.js";

function line(overrides: Partial<Parameters<typeof newReturnLine>[0]> = {}) {
  return newReturnLine({
    productVariantId: newId(),
    quantity: 2,
    unitPrice: 50,
    ...overrides,
  });
}

describe("newReturnLine", () => {
  it("rejects a non-positive quantity", () => {
    expect(() => line({ quantity: 0 })).toThrow(ReturnError);
  });

  it("rejects a negative unit price", () => {
    expect(() => line({ unitPrice: -1 })).toThrow(ReturnError);
  });
});

describe("returnTotal", () => {
  it("sums line refunds", () => {
    const lines = [line({ quantity: 2, unitPrice: 50 }), line({ quantity: 1, unitPrice: 20 })];
    expect(returnTotal({ lines })).toBe(120);
  });
});

describe("newReturn", () => {
  it("rejects a return with no lines", () => {
    expect(() =>
      newReturn({
        returnNumber: "A1-000001",
        invoiceId: newId(),
        customerId: null,
        employeeId: null,
        lines: [],
        resolution: "cash_refund",
      })
    ).toThrow(ReturnError);
  });

  it("rejects store credit for a walk-in (no customer)", () => {
    expect(() =>
      newReturn({
        returnNumber: "A1-000001",
        invoiceId: newId(),
        customerId: null,
        employeeId: null,
        lines: [line()],
        resolution: "store_credit",
      })
    ).toThrow(ReturnError);
  });

  it("allows a cash refund for a walk-in", () => {
    const ret = newReturn({
      returnNumber: "A1-000001",
      invoiceId: newId(),
      customerId: null,
      employeeId: null,
      lines: [line()],
      resolution: "cash_refund",
    });
    expect(ret.resolution).toBe("cash_refund");
  });

  it("allows store credit when a customer is attached", () => {
    const ret = newReturn({
      returnNumber: "A1-000001",
      invoiceId: newId(),
      customerId: newId(),
      employeeId: null,
      lines: [line()],
      resolution: "store_credit",
    });
    expect(ret.resolution).toBe("store_credit");
  });
});

describe("returnedQuantityByVariant", () => {
  it("sums quantities per variant, skipping deleted returns", () => {
    const variantId = newId();
    const returns = [
      { lines: [{ id: newId(), productVariantId: variantId, quantity: 2, unitPrice: 10 }], deletedAt: null },
      { lines: [{ id: newId(), productVariantId: variantId, quantity: 3, unitPrice: 10 }], deletedAt: null },
      { lines: [{ id: newId(), productVariantId: variantId, quantity: 5, unitPrice: 10 }], deletedAt: new Date().toISOString() },
    ];
    const totals = returnedQuantityByVariant(returns);
    expect(totals.get(variantId)).toBe(5);
  });
});
