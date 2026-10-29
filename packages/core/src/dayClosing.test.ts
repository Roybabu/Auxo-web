import { describe, expect, it } from "vitest";
import { DayClosingError, businessDateFor, newDayClosing } from "./dayClosing.js";

describe("businessDateFor", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(businessDateFor(new Date(2026, 9, 5))).toBe("2026-10-05"); // month is 0-indexed
  });
});

describe("newDayClosing", () => {
  it("rejects a malformed businessDate", () => {
    expect(() =>
      newDayClosing({
        businessDate: "10/29/2026",
        openingCash: 0,
        collectedCash: 0,
        refundedCash: 0,
        countedCash: 0,
        employeeId: null,
      })
    ).toThrow(DayClosingError);
  });

  it("rejects negative opening or counted cash", () => {
    const base = { businessDate: "2026-10-29", openingCash: 0, collectedCash: 0, refundedCash: 0, countedCash: 0, employeeId: null };
    expect(() => newDayClosing({ ...base, openingCash: -1 })).toThrow(DayClosingError);
    expect(() => newDayClosing({ ...base, countedCash: -1 })).toThrow(DayClosingError);
  });

  it("computes expectedCash and variance", () => {
    const closing = newDayClosing({
      businessDate: "2026-10-29",
      openingCash: 500,
      collectedCash: 2000,
      refundedCash: 100,
      countedCash: 2350,
      employeeId: null,
    });
    expect(closing.expectedCash).toBe(2400); // 500 + 2000 - 100
    expect(closing.variance).toBe(-50); // 2350 - 2400
  });

  it("reports a positive variance when the drawer has more than expected", () => {
    const closing = newDayClosing({
      businessDate: "2026-10-29",
      openingCash: 0,
      collectedCash: 1000,
      refundedCash: 0,
      countedCash: 1010,
      employeeId: null,
    });
    expect(closing.variance).toBe(10);
  });
});
