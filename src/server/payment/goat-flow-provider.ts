import { GoatFlowClient } from "goatflow-sdk-server";
import { env } from "@/config/env";
import type { PaymentOrder, PaymentProof } from "@/domain/types";
import type { CreatePaymentInput, PaymentProvider } from "./provider";

export class GoatFlowPaymentProvider implements PaymentProvider {
  private readonly client: GoatFlowClient;

  constructor() {
    if (!env.GOATX402_API_KEY || !env.GOATX402_API_SECRET) {
      throw new Error("GOAT Flow credentials are required when PAYMENT_PROVIDER=goat-flow");
    }
    this.client = new GoatFlowClient({
      baseUrl: env.GOATX402_API_URL,
      apiKey: env.GOATX402_API_KEY,
      apiSecret: env.GOATX402_API_SECRET,
    });
  }

  async createOrder({ invocationId, buyerWallet, service }: CreatePaymentInput): Promise<PaymentOrder> {
    const order = await this.client.createOrder({
      dappOrderId: invocationId,
      chainId: env.GOAT_CHAIN_ID,
      tokenSymbol: service.pricing.asset,
      fromAddress: buyerWallet,
      amountWei: service.pricing.amountWei,
    });

    if (order.flow !== "ERC20_DIRECT") {
      throw new Error(`Unsupported GOAT Flow payment mode: ${order.flow}`);
    }

    return {
      orderId: order.orderId,
      flow: order.flow,
      tokenSymbol: order.tokenSymbol,
      tokenContract: order.tokenContract as `0x${string}`,
      fromAddress: buyerWallet,
      payToAddress: order.payToAddress as `0x${string}`,
      chainId: order.fromChainId,
      amountWei: order.amountWei,
      expiresAt: order.expiresAt,
    };
  }

  async confirmOrder(order: PaymentOrder): Promise<PaymentProof> {
    const status = await this.client.getOrderStatus(order.orderId);
    if (status.status !== "PAYMENT_CONFIRMED" && status.status !== "INVOICED") {
      throw new Error(`Payment is not confirmed: ${status.status}`);
    }

    const proof = await this.client.getOrderProof(order.orderId);
    return {
      orderId: proof.payload.order_id,
      txHash: proof.payload.tx_hash as `0x${string}`,
      fromAddress: proof.payload.from_addr as `0x${string}`,
      toAddress: proof.payload.to_addr as `0x${string}`,
      tokenContract: status.tokenContract as `0x${string}`,
      amountWei: proof.payload.amount_wei,
      chainId: proof.payload.from_chain_id,
      confirmedAt: status.confirmedAt ?? new Date().toISOString(),
    };
  }
}
