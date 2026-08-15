import { describe, expect, it } from "vitest";
import type { PaymentOrder, PaymentProof } from "@/domain/types";
import type { CreatePaymentInput, PaymentProvider } from "./payment/provider";
import { MemoryInvocationRepository } from "./repository";
import { InvocationService } from "./invocation-service";

const token = "0x0000000000000000000000000000000000000001" as const;
const buyer = "0x12a000000000000000000000000000000000009a" as const;

class TestPaymentProvider implements PaymentProvider {
  orders = 0;
  mutateProof?: (proof: PaymentProof) => PaymentProof;

  async createOrder({ invocationId, buyerWallet, service }: CreatePaymentInput): Promise<PaymentOrder> {
    this.orders += 1;
    return {
      orderId: `order_${invocationId}`,
      flow: "ERC20_DIRECT",
      tokenSymbol: "USDC",
      tokenContract: token,
      fromAddress: buyerWallet,
      payToAddress: service.sellerWallet,
      chainId: 48816,
      amountWei: service.pricing.amountWei,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    };
  }

  async confirmOrder(order: PaymentOrder): Promise<PaymentProof> {
    const proof: PaymentProof = {
      orderId: order.orderId,
      txHash: `0x${"b".repeat(64)}`,
      fromAddress: order.fromAddress,
      toAddress: order.payToAddress,
      tokenContract: order.tokenContract,
      amountWei: order.amountWei,
      chainId: order.chainId,
      confirmedAt: new Date().toISOString(),
    };
    return this.mutateProof?.(proof) ?? proof;
  }
}

function startInput() {
  return {
    slug: "wallet-lens",
    buyerWallet: buyer,
    idempotencyKey: "stable-request-key",
    payload: { address: buyer },
  };
}

describe("InvocationService", () => {
  it("reuses an invocation for the same payer and idempotency key", async () => {
    const payments = new TestPaymentProvider();
    const service = new InvocationService(new MemoryInvocationRepository(), payments);
    const first = await service.start(startInput());
    const second = await service.start(startInput());

    expect(first.id).toBe(second.id);
    expect(payments.orders).toBe(1);
  });

  it("rejects an idempotency key reused with different input", async () => {
    const payments = new TestPaymentProvider();
    const service = new InvocationService(new MemoryInvocationRepository(), payments);
    await service.start(startInput());

    await expect(service.start({
      ...startInput(),
      payload: { address: "0x0000000000000000000000000000000000000001" },
    })).rejects.toThrow("different invocation");
    expect(payments.orders).toBe(1);
  });

  it("fulfills once after matching proof", async () => {
    const service = new InvocationService(new MemoryInvocationRepository(), new TestPaymentProvider());
    const started = await service.start(startInput());
    const fulfilled = await service.confirm(started.id);
    const retried = await service.confirm(started.id);

    expect(fulfilled.status).toBe("SUCCEEDED");
    expect(fulfilled.receipt?.txHash).toMatch(/^0x/);
    expect(retried.status).toBe("SUCCEEDED");
  });

  it("refuses a proof that pays the wrong recipient", async () => {
    const payments = new TestPaymentProvider();
    payments.mutateProof = (proof) => ({
      ...proof,
      toAddress: "0x0000000000000000000000000000000000000002",
    });
    const service = new InvocationService(new MemoryInvocationRepository(), payments);
    const started = await service.start(startInput());

    await expect(service.confirm(started.id)).rejects.toThrow("does not match");
  });

  it("does not bind an unverified QuickPay session", async () => {
    const repository = new MemoryInvocationRepository();
    const payments: PaymentProvider = {
      async createOrder({ invocationId, buyerWallet, service }) {
        return {
          orderId: `quickpay_intent_${invocationId}`,
          flow: "QUICKPAY_PRODUCT",
          tokenSymbol: "USDC",
          tokenContract: token,
          fromAddress: buyerWallet,
          payToAddress: service.sellerWallet,
          chainId: 2345,
          amountWei: service.pricing.amountWei,
          expiresAt: Math.floor(Date.now() / 1000) + 60,
          quickPay: {
            origin: "https://flow-quickpay.goat.network",
            merchantId: "agentcommercehub",
            productKey: "wallet-analysis",
            clientReferenceId: invocationId,
            idempotencyKey: invocationId,
          },
        };
      },
      async confirmOrder() {
        throw new Error("Payment is not confirmed: ORDER_CREATED");
      },
    };
    const service = new InvocationService(repository, payments);
    const started = await service.start(startInput());

    await expect(service.confirm(started.id, { sessionId: "qps_unverified" })).rejects.toThrow("not confirmed");
    expect((await repository.findById(started.id))?.paymentSessionId).toBeUndefined();
  });
});
