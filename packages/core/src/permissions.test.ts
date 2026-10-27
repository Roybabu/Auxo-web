import { describe, expect, it } from "vitest";
import { newEntityBase } from "./entity.js";
import { hasPermission, type Employee } from "./permissions.js";

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    ...newEntityBase(),
    name: "Test Employee",
    username: "test",
    passwordHash: { algorithm: "pbkdf2-sha256", iterations: 1, saltHex: "00", hashHex: "00" },
    role: "employee",
    permissions: [],
    active: true,
    ...overrides,
  };
}

describe("hasPermission", () => {
  it("super_admin has every permission regardless of the permissions list", () => {
    const admin = employee({ role: "super_admin", permissions: [] });
    expect(hasPermission(admin, "settings.edit")).toBe(true);
    expect(hasPermission(admin, "employees.manage")).toBe(true);
  });

  it("employee only has explicitly granted permissions", () => {
    const e = employee({ permissions: ["billing.create"] });
    expect(hasPermission(e, "billing.create")).toBe(true);
    expect(hasPermission(e, "inventory.edit")).toBe(false);
  });

  it("inactive employees have no permissions, even super_admin", () => {
    const inactiveAdmin = employee({ role: "super_admin", active: false });
    expect(hasPermission(inactiveAdmin, "settings.edit")).toBe(false);
  });
});
