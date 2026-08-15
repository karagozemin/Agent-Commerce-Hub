import type { PaymentOrder, PaymentProof, ServiceManifest } from "@/domain/types";

export interface CreatePaymentInput {
  invocationId: string;
  buyerWallet: `0x${string}`;
  service: ServiceManifest;
}

export interface PaymentConfirmation {
  sessionId?: string;
}

export interface PaymentProvider {
  createOrder(input: CreatePaymentInput): Promise<PaymentOrder>;
  confirmOrder(order: PaymentOrder, service: ServiceManifest, confirmation?: PaymentConfirmation): Promise<PaymentProof>;
}
