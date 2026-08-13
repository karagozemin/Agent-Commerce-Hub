import { randomUUID } from "node:crypto";
import { hashPayload } from "@/domain/hash";
import type { InvocationReceipt, PaymentOrder, PaymentProof, ServiceManifest } from "@/domain/types";
import { getServiceById, getServiceBySlug } from "@/data/services";
import { executeService } from "./executor";
import { getPaymentProvider } from "./payment";
import type { PaymentProvider } from "./payment/provider";
import { invocationRepository, type InvocationRepository } from "./repository";
import { validateServiceInput } from "./input-validation";

const internalWallets = new Set<string>();

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
    const service = getServiceBySlug(input.slug);
    if (!service) throw new Error("Service not found");
    if (service.availability !== "online") throw new Error("Service is not available");
    validateServiceInput(service, input.payload);

    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey, input.buyerWallet);
    if (existing) return existing;

    const now = new Date().toISOString();
    const invocation = await this.repository.create({
      id: `inv_${randomUUID().replaceAll("-", "")}`,
      idempotencyKey: input.idempotencyKey,
      serviceId: service.id,
      buyerWallet: input.buyerWallet,
      status: "CREATED",
      input: input.payload,
      inputHash: hashPayload(input.payload),
      isInternal: internalWallets.has(input.buyerWallet.toLowerCase()),
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

  async confirm(id: string) {
    let invocation = await this.repository.findById(id);
    if (!invocation) throw new Error("Invocation not found");
    if (invocation.status === "SUCCEEDED" || invocation.status === "EXECUTING") return invocation;
    if (!invocation.paymentOrder) throw new Error("Payment order is missing");
    const paymentOrder = invocation.paymentOrder;

    if (invocation.status === "PAYMENT_REQUIRED") {
      invocation = await this.repository.transition(id, "PAYMENT_SUBMITTED");
    }
    if (invocation.status !== "PAYMENT_SUBMITTED") {
      throw new Error(`Invocation cannot be confirmed from ${invocation.status}`);
    }

    const service = getServiceById(invocation.serviceId);
    if (!service) throw new Error("Service not found");
    const proof = await this.payments.confirmOrder(paymentOrder);
    this.assertProof(paymentOrder, proof, service);
    await this.repository.setPaymentProof(id, proof);
    invocation = await this.repository.transition(id, "PAYMENT_CONFIRMED");
    invocation = await this.repository.transition(id, "EXECUTING");

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
    }
  }

  async get(id: string) {
    return this.repository.findById(id);
  }

  private assertProof(order: PaymentOrder, proof: PaymentProof, service: ServiceManifest) {
    const equalAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    const valid =
      proof.orderId === order.orderId &&
      equalAddress(proof.fromAddress, order.fromAddress) &&
      equalAddress(proof.toAddress, service.sellerWallet) &&
      equalAddress(proof.tokenContract, order.tokenContract) &&
      proof.amountWei === service.pricing.amountWei &&
      proof.chainId === order.chainId;

    if (!valid) throw new Error("Payment proof does not match the invocation terms");
  }
}

export const invocationService = new InvocationService();
