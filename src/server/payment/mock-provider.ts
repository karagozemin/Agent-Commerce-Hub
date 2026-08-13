import { hashPayload } from "@/domain/hash";
import type { PaymentOrder, PaymentProof } from "@/domain/types";
import type { CreatePaymentInput, PaymentProvider } from "./provider";

const mockToken = "0x0000000000000000000000000000000000000001" as const;

export class MockPaymentProvider implements PaymentProvider {
  async createOrder({ invocationId, buyerWallet, service }: CreatePaymentInput): Promise<PaymentOrder> {
    return {
      orderId: `mock_${invocationId}`,
      flow: "ERC20_DIRECT",
      tokenSymbol: service.pricing.asset,
      tokenContract: mockToken,
      fromAddress: buyerWallet,
      payToAddress: service.sellerWallet,
      chainId: 48816,
      amountWei: service.pricing.amountWei,
      expiresAt: Math.floor(Date.now() / 1000) + 15 * 60,
      simulation: true,
    };
  }

  async confirmOrder(order: PaymentOrder): Promise<PaymentProof> {
    const txHash = hashPayload({ orderId: order.orderId, paidAt: new Date().toISOString() });
    return {
      orderId: order.orderId,
      txHash,
      fromAddress: order.fromAddress,
      toAddress: order.payToAddress,
      tokenContract: order.tokenContract,
      amountWei: order.amountWei,
      chainId: order.chainId,
      confirmedAt: new Date().toISOString(),
    };
  }
}
