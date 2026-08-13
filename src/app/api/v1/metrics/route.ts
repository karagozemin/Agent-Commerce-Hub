import { NextResponse } from "next/server";
import { services } from "@/data/services";
import { invocationRepository } from "@/server/repository";

export async function GET() {
  const invocations = await invocationRepository.list();
  const externalMainnet = invocations.filter(
    (item) => item.status === "SUCCEEDED" && !item.isInternal && !item.paymentOrder?.simulation,
  );
  const uniquePayers = new Set(externalMainnet.map((item) => item.buyerWallet.toLowerCase()));
  const volume = externalMainnet.reduce((total, item) => {
    const service = services.find((entry) => entry.id === item.serviceId);
    return total + Number(service?.pricing.amount ?? 0);
  }, 0);

  return NextResponse.json({
    data: {
      mainnetPaidInvocations: externalMainnet.length,
      uniqueExternalPayers: uniquePayers.size,
      externalPaymentVolume: volume.toFixed(2),
      activeSellers: new Set(services.map((service) => service.sellerWallet)).size,
      liveServices: services.filter((service) => service.availability === "online").length,
      sellerRevenue: volume.toFixed(2),
      repeatUsageRate: 0,
      methodology: "Mock and known internal-wallet activity is excluded from headline metrics.",
    },
  });
}
