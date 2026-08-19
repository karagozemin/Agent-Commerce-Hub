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
  testInput: { address: session.walletAddress },
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

  it("publishes only after endpoint and identity verification", async () => {
    const repository = new MemorySellerRepository();
    const seller = new SellerService(
      repository,
      async (endpoint) => validateSellerEndpoint(endpoint),
      async () => ({ verifiedAt: new Date(), latencyMs: 42, sampleOutput: {} }),
      async (_identity, wallet) => ({ ownerWallet: wallet as `0x${string}`, verifiedAt: new Date() }),
    );
    await seller.createProfile(session, { displayName: "Test Labs" });
    const draft = await seller.createService(session, {
      ...serviceInput,
      agentId: "42",
      agentUri: "https://example.com/agent.json",
    });

    await expect(seller.publish(session, draft.id)).rejects.toThrow("identity");
    await seller.verifyEndpoint(session, draft.id);
    await expect(seller.publish(session, draft.id)).rejects.toThrow("identity");
    await seller.verifyIdentity(session, draft.id);
    const now = new Date();
    await repository.upsertMerchantConfig({
      id: "merchant_test",
      sellerId: draft.sellerId,
      merchantId: "merchant_42",
      apiUrl: "https://flow-api.testnet3.goat.network",
      encryptedApiKey: "encrypted-key",
      encryptedApiSecret: "encrypted-secret",
      receivingWallet: draft.receivingWallet,
      network: draft.network,
      receiveType: "DIRECT",
      supportedTokens: [],
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await expect(seller.publish(session, draft.id)).resolves.toMatchObject({ status: "published" });
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

  it("rejects a receiving wallet that differs from the authenticated seller", async () => {
    const seller = new SellerService(
      new MemorySellerRepository(),
      async (endpoint) => validateSellerEndpoint(endpoint),
    );
    await seller.createProfile(session, { displayName: "Test Labs" });

    await expect(seller.createService(session, {
      ...serviceInput,
      receivingWallet: "0x12a000000000000000000000000000000000009b",
    })).rejects.toThrow("authenticated seller wallet");
  });
});
