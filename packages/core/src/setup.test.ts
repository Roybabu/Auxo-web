import { describe, expect, it } from "vitest";
import { newOwnerEmployee, SetupError, validateOwnerSetup } from "./setup.js";
import { verifyPassword } from "./auth.js";

describe("validateOwnerSetup", () => {
  it("requires an owner name", () => {
    expect(() => validateOwnerSetup({ ownerName: "  ", username: "owner", password: "secret1" })).toThrow(
      SetupError
    );
  });

  it("requires a username", () => {
    expect(() => validateOwnerSetup({ ownerName: "Ravi", username: "  ", password: "secret1" })).toThrow(
      SetupError
    );
  });

  it("requires a password of at least 6 characters", () => {
    expect(() => validateOwnerSetup({ ownerName: "Ravi", username: "owner", password: "abc" })).toThrow(
      SetupError
    );
  });

  it("accepts valid input", () => {
    expect(() =>
      validateOwnerSetup({ ownerName: "Ravi", username: "owner", password: "secret1" })
    ).not.toThrow();
  });
});

describe("newOwnerEmployee", () => {
  it("creates an active super_admin with a verifiable password", async () => {
    const owner = await newOwnerEmployee({ ownerName: "Ravi", username: "Owner", password: "secret1" });
    expect(owner.role).toBe("super_admin");
    expect(owner.active).toBe(true);
    expect(owner.username).toBe("owner"); // normalized
    expect(await verifyPassword("secret1", owner.passwordHash)).toBe(true);
  });
});
