import { describe, expect, it } from "vitest";
import { ActivityLogError, newActivityLog } from "./activityLog.js";

describe("newActivityLog", () => {
  it("rejects an empty action", () => {
    expect(() => newActivityLog({ employeeId: null, action: "   ", summary: "Did a thing" })).toThrow(
      ActivityLogError
    );
  });

  it("rejects an empty summary", () => {
    expect(() => newActivityLog({ employeeId: null, action: "sale.completed", summary: "   " })).toThrow(
      ActivityLogError
    );
  });

  it("creates a trimmed, valid entry", () => {
    const entry = newActivityLog({
      employeeId: null,
      action: "  sale.completed  ",
      summary: "  Completed sale A1-000001  ",
      metadata: { invoiceNumber: "A1-000001" },
    });
    expect(entry.action).toBe("sale.completed");
    expect(entry.summary).toBe("Completed sale A1-000001");
    expect(entry.metadata).toEqual({ invoiceNumber: "A1-000001" });
  });

  it("defaults metadata to null when omitted", () => {
    const entry = newActivityLog({ employeeId: null, action: "login", summary: "Signed in" });
    expect(entry.metadata).toBeNull();
  });
});
