import { describe, expect, it, vi } from "vitest";
import { verifyMerchantConfiguration } from "./merchant-verifier";

const input = {
  merchantId: "merchant_test",
  network: "goat-testnet" as const,
  receivingWallet: "0x12a000000000000000000000000000000000009a",
  asset: "USDC",
  apiKey: "test-key",
  apiSecret: "test-secret",
};

function merchantResponse(address = input.receivingWallet, receiveType = "DIRECT") {
  return new Response(JSON.stringify({
    merchant_id: input.merchantId,
    receive_type: receiveType,
    wallets: [{ address, chain_id: 48816, token_symbol: "USDC", token_contract: "0x0000000000000000000000000000000000000001" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("merchant verification", () => {
  const client = {
    createOrder: vi.fn(async () => ({ orderId: "order_test", flow: "ERC20_DIRECT", payToAddress: input.receivingWallet })),
    cancelOrder: vi.fn(async () => undefined),
  };
  const createClient = () => client as unknown as import("goatflow-sdk-server").GoatFlowClient;

  it("accepts an exact DIRECT settlement route", async () => {
    const request = vi.fn(async () => merchantResponse());
    const result = await verifyMerchantConfiguration(input, request as typeof fetch, createClient);
    expect(result.receiveType).toBe("DIRECT");
    expect(result.supportedTokens).toHaveLength(1);
    expect(client.cancelOrder).toHaveBeenCalledWith("order_test");
  });

  it("rejects a merchant that settles to another wallet", async () => {
    const request = vi.fn(async () => merchantResponse("0x0000000000000000000000000000000000000002"));
    await expect(verifyMerchantConfiguration(input, request as typeof fetch, createClient)).rejects.toThrow("no matching");
  });

  it("rejects non-DIRECT merchants", async () => {
    const request = vi.fn(async () => merchantResponse(input.receivingWallet, "DELEGATE"));
    await expect(verifyMerchantConfiguration(input, request as typeof fetch, createClient)).rejects.toThrow("DIRECT");
  });

  it("rejects credentials that cannot create an authenticated order", async () => {
    const request = vi.fn(async () => merchantResponse());
    const failingClient = () => ({ createOrder: vi.fn(async () => { throw new Error("401 Unauthorized"); }), cancelOrder: vi.fn() }) as unknown as import("goatflow-sdk-server").GoatFlowClient;
    await expect(verifyMerchantConfiguration(input, request as typeof fetch, failingClient)).rejects.toThrow("credentials");
  });
});
