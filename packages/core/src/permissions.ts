import type { Entity } from "./entity.js";

export type Role = "super_admin" | "employee";

/**
 * Individual permissions a Super Admin can grant to an employee.
 * Deliberately per-permission (not a single preset) since the owner
 * wants custom access per employee, not one blanket restriction.
 */
export type Permission =
  | "billing.create"
  | "billing.void"
  | "inventory.view"
  | "inventory.edit"
  | "customers.view"
  | "customers.edit"
  | "reports.view"
  | "settings.edit"
  | "employees.manage";

export const ALL_PERMISSIONS: readonly Permission[] = [
  "billing.create",
  "billing.void",
  "inventory.view",
  "inventory.edit",
  "customers.view",
  "customers.edit",
  "reports.view",
  "settings.edit",
  "employees.manage",
];

export interface Employee extends Entity {
  name: string;
  username: string;
  role: Role;
  /** Super admins implicitly have every permission; this is ignored for them. */
  permissions: readonly Permission[];
  active: boolean;
}

export function hasPermission(employee: Pick<Employee, "role" | "permissions" | "active">, permission: Permission): boolean {
  if (!employee.active) return false;
  if (employee.role === "super_admin") return true;
  return employee.permissions.includes(permission);
}
