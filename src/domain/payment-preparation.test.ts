import { describe, expect, it } from "vitest";
import { bufferedPaymentTarget, ceilDivide, proportionalSwapInput } from "./payment-preparation";

describe("payment preparation arithmetic", () => {
  it("rounds ratios up so the payment deficit is never underfunded", () => {
    expect(ceilDivide(10n, 3n)).toBe(4n);
    expect(proportionalSwapInput(10_000_000_000_000n, 629_959n, 102_000n)).toBe(1_619_152_992_497n);
  });

  it("adds a two-percent quote buffer with a small-payment floor", () => {
    expect(bufferedPaymentTarget(100_000n)).toBe(102_000n);
    expect(bufferedPaymentTarget(10_000n)).toBe(11_000n);
    expect(bufferedPaymentTarget(0n)).toBe(0n);
  });
});
