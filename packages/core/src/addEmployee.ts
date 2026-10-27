import { newEntityBase } from "./entity.js";
import { hashPassword } from "./auth.js";
import { normalizeUsername, type Employee, type Permission } from "./permissions.js";
import { SetupError } from "./setup.js";

export interface NewEmployeeInput {
  name: string;
  username: string;
  password: string;
  /** Super Admin picks exactly which permissions this employee gets — no presets. */
  permissions: readonly Permission[];
}

const MIN_PASSWORD_LENGTH = 6;

export function validateNewEmployee(input: NewEmployeeInput, existing: readonly Employee[]): void {
  if (input.name.trim().length === 0) {
    throw new SetupError("Employee name is required.");
  }
  const username = normalizeUsername(input.username);
  if (username.length === 0) {
    throw new SetupError("Username is required.");
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new SetupError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const taken = existing.some((e) => e.active && normalizeUsername(e.username) === username);
  if (taken) {
    throw new SetupError(`Username "${username}" is already in use.`);
  }
}

export async function newEmployee(
  input: NewEmployeeInput,
  existing: readonly Employee[]
): Promise<Employee> {
  validateNewEmployee(input, existing);
  return {
    ...newEntityBase(),
    name: input.name.trim(),
    username: normalizeUsername(input.username),
    passwordHash: await hashPassword(input.password),
    role: "employee",
    permissions: input.permissions,
    active: true,
  };
}
