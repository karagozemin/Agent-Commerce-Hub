import { describe, expect, it } from "vitest";
import { validateSellerEndpoint } from "./endpoint-security";

describe("seller endpoint validation", () => {
  it.each([
    "http://api.example.com/run",
    "https://localhost/run",
    "https://127.0.0.1/run",
    "https://10.1.2.3/run",
    "https://192.168.1.5/run",
    "https://user:secret@example.com/run",
  ])("rejects unsafe endpoint %s", (endpoint) => {
    expect(() => validateSellerEndpoint(endpoint)).toThrow();
  });

  it("accepts a public HTTPS endpoint shape", () => {
    expect(validateSellerEndpoint("https://api.example.com/v1/run")).toBe("https://api.example.com/v1/run");
  });
});
