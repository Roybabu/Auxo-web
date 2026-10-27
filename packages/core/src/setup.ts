import { newEntityBase } from "./entity.js";
import { hashPassword } from "./auth.js";
import type { Employee } from "./permissions.js";
import { normalizeUsername } from "./permissions.js";

export class SetupError extends Error {}

export interface OwnerSetupInput {
  ownerName: string;
  username: string;
  password: string;
}

const MIN_PASSWORD_LENGTH = 6;

export function validateOwnerSetup(input: OwnerSetupInput): void {
  if (input.ownerName.trim().length === 0) {
    throw new SetupError("Owner name is required.");
  }
  if (normalizeUsername(input.username).length === 0) {
    throw new SetupError("Username is required.");
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new SetupError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

/** Creates the Super Admin employee record from the shop-setup form. */
export async function newOwnerEmployee(input: OwnerSetupInput): Promise<Employee> {
  validateOwnerSetup(input);
  return {
    ...newEntityBase(),
    name: input.ownerName.trim(),
    username: normalizeUsername(input.username),
    passwordHash: await hashPassword(input.password),
    role: "super_admin",
    permissions: [],
    active: true,
  };
}
