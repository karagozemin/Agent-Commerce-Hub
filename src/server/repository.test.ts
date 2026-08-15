import { describe, expect, it } from "vitest";
import type { InvocationRecord } from "@/domain/types";
import { MemoryInvocationRepository } from "./repository";

const buyer = "0x12a000000000000000000000000000000000009a" as const;

function record(id: string): InvocationRecord {
  const now = new Date().toISOString();
  return {
    id,
    idempotencyKey: `key-${id}`,
    serviceId: "svc_wallet_lens",
    buyerWallet: buyer,
    status: "PAYMENT_REQUIRED",
    input: { address: buyer },
    inputHash: `0x${"a".repeat(64)}`,
    isInternal: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe("MemoryInvocationRepository payment sessions", () => {
  it("binds a QuickPay session to only one invocation", async () => {
    const repository = new MemoryInvocationRepository();
    await repository.create(record("inv_one"));
    await repository.create(record("inv_two"));
    await repository.bindPaymentSession("inv_one", "qps_shared");

    await expect(repository.bindPaymentSession("inv_two", "qps_shared"))
      .rejects.toThrow("another invocation");
    expect((await repository.findById("inv_one"))?.paymentSessionId).toBe("qps_shared");
  });
});
