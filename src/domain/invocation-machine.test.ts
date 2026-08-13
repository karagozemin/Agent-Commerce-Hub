import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, isTerminalStatus } from "./invocation-machine";

describe("invocation state machine", () => {
  it("allows the verified payment and fulfillment path", () => {
    expect(canTransition("CREATED", "PAYMENT_REQUIRED")).toBe(true);
    expect(canTransition("PAYMENT_REQUIRED", "PAYMENT_SUBMITTED")).toBe(true);
    expect(canTransition("PAYMENT_SUBMITTED", "PAYMENT_CONFIRMED")).toBe(true);
    expect(canTransition("PAYMENT_CONFIRMED", "EXECUTING")).toBe(true);
    expect(canTransition("EXECUTING", "SUCCEEDED")).toBe(true);
  });

  it("rejects execution before confirmed payment", () => {
    expect(() => assertTransition("PAYMENT_REQUIRED", "EXECUTING")).toThrow(
      "Invalid invocation transition",
    );
  });

  it("treats successful invocations as terminal", () => {
    expect(isTerminalStatus("SUCCEEDED")).toBe(true);
  });
});
