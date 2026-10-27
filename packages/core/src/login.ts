import type { ISODateTime } from "./entity.js";
import { nowISO } from "./entity.js";
import { verifyPassword } from "./auth.js";
import { findActiveEmployeeByUsername, type Employee } from "./permissions.js";
import type { UUID } from "./ids.js";

export interface Session {
  employeeId: UUID;
  loggedInAt: ISODateTime;
}

export function newSession(employeeId: UUID): Session {
  return { employeeId, loggedInAt: nowISO() };
}

export type LoginResult =
  | { ok: true; employee: Employee }
  | { ok: false; reason: "not_found" | "wrong_password" };

export async function attemptLogin(
  employees: readonly Employee[],
  username: string,
  password: string
): Promise<LoginResult> {
  const employee = findActiveEmployeeByUsername(employees, username);
  if (!employee) {
    // Deliberately the same "not_found" reason an inactive-but-matching
    // username would otherwise leak — findActiveEmployeeByUsername
    // already excludes inactive employees, so this covers both "no such
    // username" and "that username exists but is deactivated" without
    // telling a caller which one it was.
    return { ok: false, reason: "not_found" };
  }
  const passwordOk = await verifyPassword(password, employee.passwordHash);
  if (!passwordOk) {
    return { ok: false, reason: "wrong_password" };
  }
  return { ok: true, employee };
}
