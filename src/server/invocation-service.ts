import { randomUUID } from "node:crypto";
import { hashPayload } from "@/domain/hash";
import type { InvocationReceipt, PaymentOrder, PaymentProof, ServiceManifest } from "@/domain/types";
import { findPublishedServiceById, findPublishedServiceBySlug } from "./catalog";
import { executeService } from "./executor";
import { getPaymentProvider } from "./payment";
import type { PaymentProvider } from "./payment/provider";
import type { PaymentConfirmation } from "./payment/provider";
import { invocationRepository, type InvocationRepository } from "./repository";
import { validateServiceInput } from "./input-validation";
import { acquireServiceSlot, assertInvocationRate } from "./invocation-guards";
import { isInternalWallet } from "./internal-wallets";

export class InvocationService {
  constructor(
    private readonly repository: InvocationRepository = invocationRepository,
    private readonly payments: PaymentProvider = getPaymentProvider(),
  ) {}

  async start(input: {
    slug: string;
    buyerWallet: `0x${string}`;
    idempotencyKey: string;
    payload: unknown;
  }) {
    const service = await findPublishedServiceBySlug(input.slug);
    if (!service) throw new Error("Service not found");
    if (service.availability !== "online") throw new Error("Service is not available");
    validateServiceInput(service, input.payload);

    const inputHash = hashPayload(input.payload);
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey, input.buyerWallet);
    if (existing) {
      if (existing.serviceId !== service.id || existing.inputHash !== inputHash) {
        throw new Error("Idempotency key was already used for a different invocation");
      }
      return existing;
    }
    assertInvocationRate(input.buyerWallet);

    const now = new Date().toISOString();
    const invocation = await this.repository.create({
      id: `inv_${randomUUID().replaceAll("-", "")}`,
      idempotencyKey: input.idempotencyKey,
      serviceId: service.id,
      buyerWallet: input.buyerWallet,
      status: "CREATED",
      input: input.payload,
      inputHash,
      isInternal: await isInternalWallet(input.buyerWallet),
      createdAt: now,
      updatedAt: now,
    });

    if (invocation.status !== "CREATED") return invocation;
    const paymentOrder = await this.payments.createOrder({
      invocationId: invocation.id,
      buyerWallet: input.buyerWallet,
      service,
    });
    await this.repository.setPaymentOrder(invocation.id, paymentOrder);
    return this.repository.transition(invocation.id, "PAYMENT_REQUIRED");
  }

  async confirm(id: string, confirmation: PaymentConfirmation = {}) {
    let invocation = await this.repository.findById(id);
    if (!invocation) throw new Error("Invocation not found");
    if (invocation.status === "SUCCEEDED" || invocation.status === "EXECUTING") return invocation;
    if (!invocation.paymentOrder) throw new Error("Payment order is missing");
    const paymentOrder = invocation.paymentOrder;

    if (paymentOrder.flow === "QUICKPAY_PRODUCT") {
      const sessionId = confirmation.sessionId ?? invocation.paymentSessionId;
      if (!sessionId) throw new Error("A QuickPay session ID is required to confirm this invocation");
      confirmation = { sessionId };
    }

    if (invocation.status === "PAYMENT_REQUIRED") {
      invocation = await this.repository.transition(id, "PAYMENT_SUBMITTED");
    }
    if (invocation.status !== "PAYMENT_SUBMITTED") {
      throw new Error(`Invocation cannot be confirmed from ${invocation.status}`);
    }

    const service = await findPublishedServiceById(invocation.serviceId);
    if (!service) throw new Error("Service not found");
    const releaseSlot = acquireServiceSlot(service.id);
    let proof: PaymentProof;
    try {
      proof = await this.payments.confirmOrder(paymentOrder, service, confirmation);
    } catch (error) {
      releaseSlot();
      throw error;
    }
    try {
      if (proof.paymentSessionId) {
        invocation = await this.repository.bindPaymentSession(id, proof.paymentSessionId);
      }
      this.assertProof(paymentOrder, proof, service, invocation.paymentSessionId);
      await this.repository.setPaymentProof(id, proof);
      invocation = await this.repository.transition(id, "PAYMENT_CONFIRMED");
    } catch (error) {
      releaseSlot();
      throw error;
    }
    try {
      invocation = await this.repository.transition(id, "EXECUTING");
    } catch (error) {
      releaseSlot();
      throw error;
    }

    try {
      const output = await executeService(service, invocation.input);
      const outputHash = hashPayload(output);
      const receipt: InvocationReceipt = {
        invocationId: invocation.id,
        serviceId: service.id,
        buyer: invocation.buyerWallet,
        seller: service.sellerWallet,
        amount: service.pricing.amount,
        asset: service.pricing.asset,
        txHash: proof.txHash,
        paymentOrderId: proof.orderId,
        paymentSessionId: proof.paymentSessionId,
        inputHash: invocation.inputHash,
        outputHash,
        status: "succeeded",
        timestamp: new Date().toISOString(),
      };
      return this.repository.transition(id, "SUCCEEDED", { output, outputHash, receipt });
    } catch (error) {
      return this.repository.transition(id, "EXECUTION_FAILED", {
        failureReason: error instanceof Error ? error.message : "Unknown execution failure",
      });
    } finally {
      releaseSlot();
    }
  }

  async requestRefund(id: string, reason?: string) {
    const invocation = await this.repository.findById(id);
    if (!invocation) throw new Error("Invocation not found");
    if (invocation.status === "REFUND_REQUIRED" || invocation.status === "REFUNDED") return invocation;
    if (invocation.status !== "EXECUTION_FAILED") throw new Error("Only failed executions can be marked for refund");
    return this.repository.transition(id, "REFUND_REQUIRED", { failureReason: reason ?? invocation.failureReason ?? "Seller requested refund" });
  }

  async get(id: string) {
    return this.repository.findById(id);
  }

  private assertProof(order: PaymentOrder, proof: PaymentProof, service: ServiceManifest, paymentSessionId?: string) {
    const equalAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    const validOrder = order.flow === "QUICKPAY_PRODUCT"
      ? proof.paymentSessionId !== undefined
        && proof.paymentSessionId === paymentSessionId
        && proof.productKey === order.quickPay?.productKey
      : proof.orderId === order.orderId;
    const valid =
      validOrder &&
      equalAddress(proof.fromAddress, order.fromAddress) &&
      equalAddress(proof.toAddress, service.sellerWallet) &&
      equalAddress(proof.tokenContract, order.tokenContract) &&
      proof.amountWei === service.pricing.amountWei &&
      proof.chainId === order.chainId;

    if (!valid) throw new Error("Payment proof does not match the invocation terms");
  }
}

export const invocationService = new InvocationService();
