import { describe, expect, it } from "vitest";
import { newEmployee, validateNewEmployee } from "./addEmployee.js";
import { SetupError } from "./setup.js";
import { newOwnerEmployee } from "./setup.js";

describe("validateNewEmployee / newEmployee", () => {
  it("rejects a duplicate active username", async () => {
    const owner = await newOwnerEmployee({ ownerName: "Ravi", username: "owner", password: "secret1" });
    expect(() =>
      validateNewEmployee({ name: "Amjad", username: "Owner", password: "secret2", permissions: [] }, [owner])
    ).toThrow(SetupError);
  });

  it("allows reusing a username that belongs to a deactivated employee", async () => {
    const owner = await newOwnerEmployee({ ownerName: "Ravi", username: "owner", password: "secret1" });
    const deactivated = { ...owner, active: false };
    expect(() =>
      validateNewEmployee({ name: "Amjad", username: "owner", password: "secret2", permissions: [] }, [
        deactivated,
      ])
    ).not.toThrow();
  });

  it("creates an active employee (not super_admin) with the chosen permissions", async () => {
    const employee = await newEmployee(
      { name: "Amjad", username: "amjad", password: "secret2", permissions: ["billing.create"] },
      []
    );
    expect(employee.role).toBe("employee");
    expect(employee.active).toBe(true);
    expect(employee.permissions).toEqual(["billing.create"]);
  });
});
