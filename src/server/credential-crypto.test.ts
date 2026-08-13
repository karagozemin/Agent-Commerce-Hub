import { beforeEach, describe, expect, it, vi } from "vitest";

describe("credential encryption", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("round-trips an authenticated ciphertext without exposing plaintext", async () => {
    const { decryptCredential, encryptCredential } = await import("./credential-crypto");
    const encrypted = encryptCredential("merchant-secret-value");
    expect(encrypted).not.toContain("merchant-secret-value");
    expect(decryptCredential(encrypted)).toBe("merchant-secret-value");
  });

  it("rejects tampered ciphertext", async () => {
    const { decryptCredential, encryptCredential } = await import("./credential-crypto");
    const encrypted = encryptCredential("merchant-secret-value");
    expect(() => decryptCredential(`${encrypted.slice(0, -1)}A`)).toThrow();
  });
});
