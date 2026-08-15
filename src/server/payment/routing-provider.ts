import type { PaymentOrder, ServiceManifest } from "@/domain/types";
import type { CreatePaymentInput, PaymentConfirmation, PaymentProvider } from "./provider";
import { isQuickPayProductService } from "./quickpay-product-provider";

export class RoutingPaymentProvider implements PaymentProvider {
  constructor(
    private readonly direct: PaymentProvider,
    private readonly quickPay: PaymentProvider,
  ) {}

  createOrder(input: CreatePaymentInput) {
    return isQuickPayProductService(input.service)
      ? this.quickPay.createOrder(input)
      : this.direct.createOrder(input);
  }

  confirmOrder(order: PaymentOrder, service: ServiceManifest, confirmation?: PaymentConfirmation) {
    return order.flow === "QUICKPAY_PRODUCT"
      ? this.quickPay.confirmOrder(order, service, confirmation)
      : this.direct.confirmOrder(order, service, confirmation);
  }
}
