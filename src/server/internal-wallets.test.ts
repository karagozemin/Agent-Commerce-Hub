import { describe, expect, it } from "vitest";
import { services } from "@/data/services";
import { isInternalWallet } from "./internal-wallets";

describe("internal wallets", () => {
  it("always classifies first-party seller wallets as internal", async () => {
    expect(await isInternalWallet(services[0].sellerWallet)).toBe(true);
  });
});
