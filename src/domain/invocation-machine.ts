import type { InvocationStatus } from "./types";

const transitions: Record<InvocationStatus, readonly InvocationStatus[]> = {
  CREATED: ["PAYMENT_REQUIRED"],
  PAYMENT_REQUIRED: ["PAYMENT_SUBMITTED", "PAYMENT_FAILED", "PAYMENT_EXPIRED"],
  PAYMENT_SUBMITTED: ["PAYMENT_CONFIRMED", "PAYMENT_FAILED", "PAYMENT_EXPIRED"],
  PAYMENT_CONFIRMED: ["EXECUTING"],
  EXECUTING: ["SUCCEEDED", "EXECUTION_FAILED"],
  SUCCEEDED: [],
  PAYMENT_FAILED: [],
  PAYMENT_EXPIRED: [],
  EXECUTION_FAILED: ["REFUND_REQUIRED"],
  REFUND_REQUIRED: ["REFUNDED"],
  REFUNDED: [],
};

export function canTransition(from: InvocationStatus, to: InvocationStatus) {
  return transitions[from].includes(to);
}

export function assertTransition(from: InvocationStatus, to: InvocationStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid invocation transition: ${from} -> ${to}`);
  }
}

export function isTerminalStatus(status: InvocationStatus) {
  return transitions[status].length === 0;
}
