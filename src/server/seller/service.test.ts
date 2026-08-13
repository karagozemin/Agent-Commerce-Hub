import { describe, expect, it } from "vitest";
import type { AuthSession } from "@/server/auth/repository";
import { validateSellerEndpoint } from "@/server/endpoint-security";
import { MemorySellerRepository } from "./repository";
import { SellerService } from "./service";

const session: AuthSession = {
  id: "session_hash",
  userId: "usr_test",
  walletAddress: "0x12a000000000000000000000000000000000009a",
  expiresAt: new Date(Date.now() + 60_000),
};

const serviceInput = {
  name: "Risk Agent",
  description: "Analyzes a contract and returns a structured risk summary.",
  category: "Developer Tools",
  endpoint: "https://api.example.com/v1/risk",
  price: "0.10",
  receivingWallet: session.walletAddress,
  network: "goat-testnet",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
};

describe("seller onboarding", () => {
  it("creates an unpublished draft with six-decimal USDC amount", async () => {
    const seller = new SellerService(
      new MemorySellerRepository(),
      async (endpoint) => validateSellerEndpoint(endpoint),
    );
    await seller.createProfile(session, { displayName: "Test Labs" });
    const draft = await seller.createService(session, serviceInput);

    expect(draft.status).toBe("draft");
    expect(draft.amountWei).toBe("100000");
    expect(draft.slug).toBe("risk-agent");
  });

  it("requires a seller profile and enforces pilot pricing", async () => {
    const seller = new SellerService(
      new MemorySellerRepository(),
      async (endpoint) => validateSellerEndpoint(endpoint),
    );
    await expect(seller.createService(session, serviceInput)).rejects.toThrow("profile");
    await seller.createProfile(session, { displayName: "Test Labs" });
    await expect(seller.createService(session, { ...serviceInput, price: "2.00" })).rejects.toThrow("between");
  });
});
