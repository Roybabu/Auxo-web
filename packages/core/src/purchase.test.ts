import { describe, expect, it } from "vitest";
import { newId } from "./ids.js";
import {
  PurchaseError,
  cancelPurchase,
  markPurchaseReceived,
  newPurchase,
  newPurchaseLine,
  purchaseBalanceDue,
  purchaseTotal,
} from "./purchase.js";

function line(overrides: Partial<Parameters<typeof newPurchaseLine>[0]> = {}) {
  return newPurchaseLine({
    productVariantId: newId(),
    quantity: 10,
    unitCost: 50,
    ...overrides,
  });
}

describe("newPurchaseLine", () => {
  it("rejects a non-positive quantity", () => {
    expect(() => line({ quantity: 0 })).toThrow(PurchaseError);
    expect(() => line({ quantity: -1 })).toThrow(PurchaseError);
  });

  it("rejects a negative unit cost", () => {
    expect(() => line({ unitCost: -1 })).toThrow(PurchaseError);
  });
});

describe("purchaseTotal / purchaseBalanceDue", () => {
  it("sums line totals", () => {
    const lines = [line({ quantity: 2, unitCost: 100 }), line({ quantity: 1, unitCost: 50 })];
    expect(purchaseTotal({ lines })).toBe(250);
  });

  it("computes balance due from amount paid", () => {
    const lines = [line({ quantity: 2, unitCost: 100 })];
    expect(purchaseBalanceDue({ lines, amountPaid: 50 })).toBe(150);
  });
});

describe("newPurchase", () => {
  it("rejects a purchase with no lines", () => {
    expect(() =>
      newPurchase({ purchaseNumber: "A1-000001", supplierId: newId(), employeeId: null, lines: [] })
    ).toThrow(PurchaseError);
  });

  it("starts as a draft with no receivedAt", () => {
    const purchase = newPurchase({
      purchaseNumber: "A1-000001",
      supplierId: newId(),
      employeeId: null,
      lines: [line()],
    });
    expect(purchase.status).toBe("draft");
    expect(purchase.receivedAt).toBeNull();
    expect(purchase.amountPaid).toBe(0);
  });
});

describe("markPurchaseReceived", () => {
  it("transitions a draft to received and stamps receivedAt", () => {
    const purchase = newPurchase({
      purchaseNumber: "A1-000001",
      supplierId: newId(),
      employeeId: null,
      lines: [line()],
    });
    const received = markPurchaseReceived(purchase);
    expect(received.status).toBe("received");
    expect(received.receivedAt).not.toBeNull();
  });

  it("refuses to receive a non-draft purchase twice", () => {
    const purchase = newPurchase({
      purchaseNumber: "A1-000001",
      supplierId: newId(),
      employeeId: null,
      lines: [line()],
    });
    const received = markPurchaseReceived(purchase);
    expect(() => markPurchaseReceived(received)).toThrow(PurchaseError);
  });
});

describe("cancelPurchase", () => {
  it("cancels a draft purchase", () => {
    const purchase = newPurchase({
      purchaseNumber: "A1-000001",
      supplierId: newId(),
      employeeId: null,
      lines: [line()],
    });
    expect(cancelPurchase(purchase).status).toBe("cancelled");
  });

  it("refuses to cancel a received purchase", () => {
    const purchase = newPurchase({
      purchaseNumber: "A1-000001",
      supplierId: newId(),
      employeeId: null,
      lines: [line()],
    });
    const received = markPurchaseReceived(purchase);
    expect(() => cancelPurchase(received)).toThrow(PurchaseError);
  });
});
