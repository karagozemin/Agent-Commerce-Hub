import { GoatFlowClient } from "goatflow-sdk-server";
import { env } from "@/config/env";
import type { PaymentOrder, PaymentProof } from "@/domain/types";
import type { CreatePaymentInput, PaymentProvider } from "./provider";
import type { ServiceManifest } from "@/domain/types";
import { sellerRepository } from "@/server/seller/repository";
import { decryptCredential } from "@/server/credential-crypto";

export class GoatFlowPaymentProvider implements PaymentProvider {
  private assertFirstPartyReceivingWallet(service: ServiceManifest) {
    if (service.sellerId || !env.GOATX402_RECEIVING_WALLET) return;
    if (service.sellerWallet.toLowerCase() !== env.GOATX402_RECEIVING_WALLET.toLowerCase()) {
      throw new Error("First-party service is not configured for the GOAT merchant receiving wallet");
    }
  }

  private async clientFor(service: ServiceManifest) {
    if (service.sellerId) {
      const config = await sellerRepository.findMerchantConfig(service.sellerId);
      if (!config?.verifiedAt) throw new Error("Seller merchant configuration is not verified");
      return new GoatFlowClient({
        baseUrl: config.apiUrl,
        apiKey: decryptCredential(config.encryptedApiKey),
        apiSecret: decryptCredential(config.encryptedApiSecret),
      });
    }
    if (!env.GOATX402_API_KEY || !env.GOATX402_API_SECRET) throw new Error("GOAT Flow credentials are required for first-party services");
    return new GoatFlowClient({ baseUrl: env.GOATX402_API_URL, apiKey: env.GOATX402_API_KEY, apiSecret: env.GOATX402_API_SECRET });
  }

  async createOrder({ invocationId, buyerWallet, service }: CreatePaymentInput): Promise<PaymentOrder> {
    const client = await this.clientFor(service);
    this.assertFirstPartyReceivingWallet(service);
    const chainId = service.network === "goat-mainnet" ? 2345 : 48816;
    const order = await client.createOrder({
      dappOrderId: invocationId,
      chainId,
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

  async confirmOrder(order: PaymentOrder, service: ServiceManifest): Promise<PaymentProof> {
    const client = await this.clientFor(service);
    const status = await client.getOrderStatus(order.orderId);
    if (status.status !== "PAYMENT_CONFIRMED" && status.status !== "INVOICED") {
      throw new Error(`Payment is not confirmed: ${status.status}`);
    }

    const proof = await client.getOrderProof(order.orderId);
    return {
      orderId: proof.payload.order_id,
      txHash: proof.payload.tx_hash as `0x${string}`,
      fromAddress: proof.payload.from_addr as `0x${string}`,
      toAddress: proof.payload.to_addr as `0x${string}`,
      tokenContract: status.tokenContract as `0x${string}`,
      amountWei: proof.payload.amount_wei,
      chainId: proof.payload.from_chain_id,
      confirmedAt: status.confirmedAt ?? new Date().toISOString(),
      dappOrderId: status.dappOrderId,
    };
  }
}
