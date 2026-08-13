import { env } from "@/config/env";
import { GoatFlowPaymentProvider } from "./goat-flow-provider";
import { MockPaymentProvider } from "./mock-provider";
import type { PaymentProvider } from "./provider";

let provider: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  provider ??= env.PAYMENT_PROVIDER === "goat-flow"
    ? new GoatFlowPaymentProvider()
    : new MockPaymentProvider();
  return provider;
}
