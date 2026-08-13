import type { InvocationRecord, InvocationStatus, PaymentOrder, PaymentProof } from "@/domain/types";
import { assertTransition } from "@/domain/invocation-machine";

export interface InvocationRepository {
  findById(id: string): Promise<InvocationRecord | undefined>;
  findByIdempotencyKey(key: string, buyerWallet: string): Promise<InvocationRecord | undefined>;
  create(record: InvocationRecord): Promise<InvocationRecord>;
  transition(id: string, status: InvocationStatus, patch?: Partial<InvocationRecord>): Promise<InvocationRecord>;
  setPaymentOrder(id: string, order: PaymentOrder): Promise<InvocationRecord>;
  setPaymentProof(id: string, proof: PaymentProof): Promise<InvocationRecord>;
  list(): Promise<InvocationRecord[]>;
}

export class MemoryInvocationRepository implements InvocationRepository {
  private readonly records = new Map<string, InvocationRecord>();
  private readonly idempotencyIndex = new Map<string, string>();

  async findById(id: string) {
    return this.records.get(id);
  }

  async findByIdempotencyKey(key: string, buyerWallet: string) {
    const id = this.idempotencyIndex.get(`${buyerWallet.toLowerCase()}:${key}`);
    return id ? this.records.get(id) : undefined;
  }

  async create(record: InvocationRecord) {
    const indexKey = `${record.buyerWallet.toLowerCase()}:${record.idempotencyKey}`;
    const existing = this.idempotencyIndex.get(indexKey);
    if (existing) return this.records.get(existing)!;

    this.records.set(record.id, record);
    this.idempotencyIndex.set(indexKey, record.id);
    return record;
  }

  async transition(id: string, status: InvocationStatus, patch: Partial<InvocationRecord> = {}) {
    const current = this.require(id);
    assertTransition(current.status, status);
    const updated = { ...current, ...patch, status, updatedAt: new Date().toISOString() };
    this.records.set(id, updated);
    return updated;
  }

  async setPaymentOrder(id: string, paymentOrder: PaymentOrder) {
    const current = this.require(id);
    const updated = { ...current, paymentOrder, updatedAt: new Date().toISOString() };
    this.records.set(id, updated);
    return updated;
  }

  async setPaymentProof(id: string, paymentProof: PaymentProof) {
    const current = this.require(id);
    const updated = { ...current, paymentProof, updatedAt: new Date().toISOString() };
    this.records.set(id, updated);
    return updated;
  }

  async list() {
    return [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private require(id: string) {
    const record = this.records.get(id);
    if (!record) throw new Error(`Invocation not found: ${id}`);
    return record;
  }
}

const globalRepository = globalThis as typeof globalThis & {
  invocationRepository?: MemoryInvocationRepository;
};

export const invocationRepository =
  globalRepository.invocationRepository ?? new MemoryInvocationRepository();

if (process.env.NODE_ENV !== "production") {
  globalRepository.invocationRepository = invocationRepository;
}
