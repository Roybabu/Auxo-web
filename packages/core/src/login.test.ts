import { describe, expect, it } from "vitest";
import { attemptLogin } from "./login.js";
import { newOwnerEmployee } from "./setup.js";

describe("attemptLogin", () => {
  it("succeeds with the correct username and password", async () => {
    const owner = await newOwnerEmployee({ ownerName: "Ravi", username: "owner", password: "secret1" });
    const result = await attemptLogin([owner], "Owner", "secret1"); // case-insensitive username
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.employee.id).toBe(owner.id);
  });

  it("fails with the wrong password", async () => {
    const owner = await newOwnerEmployee({ ownerName: "Ravi", username: "owner", password: "secret1" });
    const result = await attemptLogin([owner], "owner", "wrong");
    expect(result).toEqual({ ok: false, reason: "wrong_password" });
  });

  it("fails for an unknown username", async () => {
    const owner = await newOwnerEmployee({ ownerName: "Ravi", username: "owner", password: "secret1" });
    const result = await attemptLogin([owner], "nobody", "secret1");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("fails for a deactivated employee even with the correct password", async () => {
    const owner = await newOwnerEmployee({ ownerName: "Ravi", username: "owner", password: "secret1" });
    const deactivated = { ...owner, active: false };
    const result = await attemptLogin([deactivated], "owner", "secret1");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});
