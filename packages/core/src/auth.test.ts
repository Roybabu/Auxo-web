import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth.js";

describe("password hashing", () => {
  it("verifies the correct password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("never stores the password itself, only salt and hash", async () => {
    const hash = await hashPassword("secret123");
    expect(JSON.stringify(hash)).not.toContain("secret123");
  });

  it("produces different salts (and so different hashes) for the same password", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a.saltHex).not.toBe(b.saltHex);
    expect(a.hashHex).not.toBe(b.hashHex);
  });
});
