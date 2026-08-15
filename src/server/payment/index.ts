import { env } from "@/config/env";
import { GoatFlowPaymentProvider } from "./goat-flow-provider";
import { MockPaymentProvider } from "./mock-provider";
import { QuickPayProductPaymentProvider } from "./quickpay-product-provider";
import { RoutingPaymentProvider } from "./routing-provider";
import type { PaymentProvider } from "./provider";

let provider: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    if (env.PAYMENT_PROVIDER === "goat-flow") {
      const direct = new GoatFlowPaymentProvider();
      provider = new RoutingPaymentProvider(direct, new QuickPayProductPaymentProvider(direct));
    } else {
      provider = new MockPaymentProvider();
    }
  }
  return provider;
}
