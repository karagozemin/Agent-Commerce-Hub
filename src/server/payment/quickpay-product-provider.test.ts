import { describe, expect, it, vi } from "vitest";
import { services } from "@/data/services";
import type { PaymentOrder, PaymentProof } from "@/domain/types";
import type { PaymentProvider } from "./provider";
import { QuickPayProductPaymentProvider } from "./quickpay-product-provider";

const buyer = "0x12a000000000000000000000000000000000009a" as const;
const token = "0x0000000000000000000000000000000000000001" as const;
const txHash = `0x${"b".repeat(64)}` as const;

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function fetchFor(snapshot: Record<string, unknown>) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/manifest.json")) {
      return json({
        merchant: { merchant_id: "agentcommercehub" },
        rails: {
          x402: {
            enabled: true,
            tokens: [{ chain_id: 2345, token_symbol: "USDC", token_contract: token, decimals: 6 }],
            products: [{ product_key: "wallet-analysis", price: "0.10" }],
          },
        },
      });
    }
    return json(snapshot);
  }) as unknown as typeof fetch;
}

class OrderVerifier implements PaymentProvider {
  confirm = vi.fn(async (order: PaymentOrder): Promise<PaymentProof> => ({
    orderId: order.orderId,
    txHash,
    fromAddress: order.fromAddress,
    toAddress: order.payToAddress,
    tokenContract: order.tokenContract,
    amountWei: order.amountWei,
    chainId: order.chainId,
    confirmedAt: new Date().toISOString(),
    dappOrderId: "quickpay:qps_test",
  }));

  async createOrder(): Promise<PaymentOrder> {
    throw new Error("not used");
  }

  confirmOrder(order: PaymentOrder) {
    return this.confirm(order);
  }
}

function confirmedSnapshot(reference = "inv_test") {
  return {
    session_id: "qps_test",
    order_id: "order_test",
    status: "PAYMENT_CONFIRMED",
    tx_hash: txHash,
    merchant_id: "agentcommercehub",
    payer_addr: buyer,
    chain_id: 2345,
    token_contract: token,
    amount_wei: "100000",
    product_key: "wallet-analysis",
    client_reference_id: reference,
  };
}

describe("QuickPayProductPaymentProvider", () => {
  it("uses the live fixed-product price and verifies the merchant order proof", async () => {
    const verifier = new OrderVerifier();
    const provider = new QuickPayProductPaymentProvider(verifier, fetchFor(confirmedSnapshot()));
    const order = await provider.createOrder({ invocationId: "inv_test", buyerWallet: buyer, service: services[0] });
    const proof = await provider.confirmOrder(order, services[0], { sessionId: "qps_test" });

    expect(order).toMatchObject({ flow: "QUICKPAY_PRODUCT", amountWei: "100000", tokenContract: token });
    expect(proof).toMatchObject({
      orderId: "order_test",
      paymentSessionId: "qps_test",
      productKey: "wallet-analysis",
      clientReferenceId: "inv_test",
    });
    expect(verifier.confirm).toHaveBeenCalledOnce();
  });

  it("rejects a session created for a different invocation", async () => {
    const verifier = new OrderVerifier();
    const provider = new QuickPayProductPaymentProvider(verifier, fetchFor(confirmedSnapshot("inv_other")));
    const order = await provider.createOrder({ invocationId: "inv_test", buyerWallet: buyer, service: services[0] });

    await expect(provider.confirmOrder(order, services[0], { sessionId: "qps_test" }))
      .rejects.toThrow("not correlated");
    expect(verifier.confirm).not.toHaveBeenCalled();
  });

  it("accepts the production public session shape when optional product metadata is omitted", async () => {
    const verifier = new OrderVerifier();
    const snapshot = Object.fromEntries(
      Object.entries(confirmedSnapshot()).filter(([key]) => key !== "product_key" && key !== "client_reference_id"),
    );
    const provider = new QuickPayProductPaymentProvider(verifier, fetchFor(snapshot));
    const order = await provider.createOrder({ invocationId: "inv_test", buyerWallet: buyer, service: services[0] });

    const proof = await provider.confirmOrder(order, services[0], { sessionId: "qps_test" });

    expect(proof).toMatchObject({
      orderId: "order_test",
      paymentSessionId: "qps_test",
      productKey: "wallet-analysis",
    });
    expect(proof.clientReferenceId).toBeUndefined();
    expect(verifier.confirm).toHaveBeenCalledOnce();
  });

  it("rejects a merchant proof created for a different QuickPay session", async () => {
    const verifier = new OrderVerifier();
    verifier.confirm.mockResolvedValueOnce({
      ...(await new OrderVerifier().confirm({
        orderId: "order_test",
        flow: "ERC20_DIRECT",
        tokenSymbol: "USDC",
        tokenContract: token,
        fromAddress: buyer,
        payToAddress: buyer,
        chainId: 2345,
        amountWei: "100000",
        expiresAt: 0,
      })),
      dappOrderId: "quickpay:qps_other",
    });
    const provider = new QuickPayProductPaymentProvider(verifier, fetchFor(confirmedSnapshot()));
    const order = await provider.createOrder({ invocationId: "inv_test", buyerWallet: buyer, service: services[0] });

    await expect(provider.confirmOrder(order, services[0], { sessionId: "qps_test" }))
      .rejects.toThrow("does not match the QuickPay session");
  });
});
