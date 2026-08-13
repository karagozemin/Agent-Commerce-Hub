import { and, desc, eq } from "drizzle-orm";
import { findPublishedServiceById } from "@/server/catalog";
import { assertTransition } from "@/domain/invocation-machine";
import type { InvocationRecord, InvocationStatus, PaymentOrder, PaymentProof } from "@/domain/types";
import { getDatabase } from "@/db/client";
import { ensureCatalogSeeded } from "@/db/seed";
import { invocations } from "@/db/schema";
import type { InvocationRepository } from "./repository";

type InvocationRow = typeof invocations.$inferSelect;

function toRecord(row: InvocationRow): InvocationRecord {
  return {
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    serviceId: row.serviceId,
    buyerWallet: row.buyerWallet as `0x${string}`,
    status: row.status,
    input: row.input,
    inputHash: row.inputHash as `0x${string}`,
    output: row.output ?? undefined,
    outputHash: row.outputHash as `0x${string}` | undefined,
    paymentOrder: row.paymentOrder as PaymentOrder | undefined,
    paymentProof: row.paymentProof as PaymentProof | undefined,
    receipt: row.receipt as InvocationRecord["receipt"],
    failureReason: row.failureReason ?? undefined,
    isInternal: row.isInternal,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PostgresInvocationRepository implements InvocationRepository {
  async findById(id: string) {
    await ensureCatalogSeeded();
    const [row] = await getDatabase().select().from(invocations).where(eq(invocations.id, id)).limit(1);
    return row ? toRecord(row) : undefined;
  }

  async findByIdempotencyKey(key: string, buyerWallet: string) {
    await ensureCatalogSeeded();
    const [row] = await getDatabase().select().from(invocations).where(and(
      eq(invocations.idempotencyKey, key),
      eq(invocations.buyerWallet, buyerWallet.toLowerCase()),
    )).limit(1);
    return row ? toRecord(row) : undefined;
  }

  async create(record: InvocationRecord) {
    await ensureCatalogSeeded();
    const service = await findPublishedServiceById(record.serviceId);
    if (!service) throw new Error(`Service not found: ${record.serviceId}`);

    const rows = await getDatabase().insert(invocations).values({
      id: record.id,
      idempotencyKey: record.idempotencyKey,
      serviceId: record.serviceId,
      buyerWallet: record.buyerWallet.toLowerCase(),
      amount: service.pricing.amount,
      amountWei: service.pricing.amountWei,
      asset: service.pricing.asset,
      status: record.status,
      input: record.input,
      inputHash: record.inputHash,
      isInternal: record.isInternal,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    }).onConflictDoNothing({
      target: [invocations.idempotencyKey, invocations.buyerWallet],
    }).returning();

    if (rows[0]) return toRecord(rows[0]);
    const existing = await this.findByIdempotencyKey(record.idempotencyKey, record.buyerWallet);
    if (!existing) throw new Error("Invocation idempotency reconciliation failed");
    return existing;
  }

  async transition(id: string, status: InvocationStatus, patch: Partial<InvocationRecord> = {}) {
    const current = await this.require(id);
    assertTransition(current.status, status);
    const now = new Date();
    const [row] = await getDatabase().update(invocations).set({
      status,
      output: patch.output,
      outputHash: patch.outputHash,
      receipt: patch.receipt,
      failureReason: patch.failureReason,
      paymentConfirmedAt: status === "PAYMENT_CONFIRMED" ? now : undefined,
      executionStartedAt: status === "EXECUTING" ? now : undefined,
      executionCompletedAt: status === "SUCCEEDED" || status === "EXECUTION_FAILED" ? now : undefined,
      updatedAt: now,
    }).where(and(eq(invocations.id, id), eq(invocations.status, current.status))).returning();

    if (!row) throw new Error(`Concurrent invocation transition rejected: ${current.status} -> ${status}`);
    return toRecord(row);
  }

  async setPaymentOrder(id: string, paymentOrder: PaymentOrder) {
    const [row] = await getDatabase().update(invocations).set({
      orderId: paymentOrder.orderId,
      paymentOrder,
      updatedAt: new Date(),
    }).where(eq(invocations.id, id)).returning();
    if (!row) throw new Error(`Invocation not found: ${id}`);
    return toRecord(row);
  }

  async setPaymentProof(id: string, paymentProof: PaymentProof) {
    const [row] = await getDatabase().update(invocations).set({
      txHash: paymentProof.txHash,
      paymentProof,
      updatedAt: new Date(),
    }).where(eq(invocations.id, id)).returning();
    if (!row) throw new Error(`Invocation not found: ${id}`);
    return toRecord(row);
  }

  async list() {
    await ensureCatalogSeeded();
    const rows = await getDatabase().select().from(invocations).orderBy(desc(invocations.createdAt));
    return rows.map(toRecord);
  }

  private async require(id: string) {
    const record = await this.findById(id);
    if (!record) throw new Error(`Invocation not found: ${id}`);
    return record;
  }
}
