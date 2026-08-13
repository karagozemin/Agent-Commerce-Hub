import { listPublishedServices } from "@/server/catalog";
import { invocationRepository } from "@/server/repository";
import type { AuthSession } from "@/server/auth/repository";
import { sellerRepository } from "./repository";

export async function getSellerMetrics(session: AuthSession) {
  const profile = await sellerRepository.findProfileByUser(session.userId);
  if (!profile) throw new Error("Create a seller profile first");
  const [services, records, catalog] = await Promise.all([
    sellerRepository.listServices(profile.id),
    invocationRepository.list(),
    listPublishedServices(),
  ]);
  const serviceIds = new Set(services.map((service) => service.id));
  const ownRecords = records.filter((record) => serviceIds.has(record.serviceId));
  const successful = ownRecords.filter((record) => record.status === "SUCCEEDED");
  const paid = successful.filter((record) => !record.paymentOrder?.simulation);
  const external = paid.filter((record) => !record.isInternal);
  const buyers = new Set(external.map((record) => record.buyerWallet.toLowerCase()));
  const repeatBuyers = new Set([...buyers].filter((buyer) => external.filter((record) => record.buyerWallet.toLowerCase() === buyer).length > 1));
  const serviceById = new Map(catalog.map((service) => [service.id, service]));
  const revenue = external.reduce((total, record) => total + Number(serviceById.get(record.serviceId)?.pricing.amount ?? record.receipt?.amount ?? 0), 0);

  return {
    seller: { id: profile.id, displayName: profile.displayName, walletAddress: session.walletAddress },
    overview: {
      revenue: revenue.toFixed(2),
      successfulCalls: successful.length,
      externalPaidCalls: external.length,
      uniqueBuyers: buyers.size,
      repeatBuyers: repeatBuyers.size,
      activeServices: services.filter((service) => service.status === "published").length,
    },
    services: services.map((service) => {
      const calls = ownRecords.filter((record) => record.serviceId === service.id);
      const serviceSuccessful = calls.filter((record) => record.status === "SUCCEEDED");
      const serviceExternal = serviceSuccessful.filter((record) => !record.isInternal && !record.paymentOrder?.simulation);
      const serviceBuyers = new Set(serviceExternal.map((record) => record.buyerWallet.toLowerCase()));
      return {
        id: service.id,
        slug: service.slug,
        name: service.name,
        status: service.status,
        healthStatus: service.healthStatus,
        endpointLatencyMs: service.endpointLatencyMs,
        calls: serviceSuccessful.length,
        externalPaidCalls: serviceExternal.length,
        uniqueBuyers: serviceBuyers.size,
        revenue: (serviceExternal.length * Number(service.price)).toFixed(2),
        successRate: calls.length ? Number(((serviceSuccessful.length / calls.length) * 100).toFixed(2)) : 0,
        endpointLastError: service.endpointLastError,
      };
    }),
  };
}

export async function getSellerTransactions(session: AuthSession, limit = 100) {
  const profile = await sellerRepository.findProfileByUser(session.userId);
  if (!profile) throw new Error("Create a seller profile first");
  const services = await sellerRepository.listServices(profile.id);
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const records = (await invocationRepository.list()).filter((record) => serviceById.has(record.serviceId)).slice(0, limit);
  return records.map((record) => ({
    id: record.id,
    service: { slug: serviceById.get(record.serviceId)!.slug, name: serviceById.get(record.serviceId)!.name },
    buyerWallet: record.buyerWallet,
    amount: serviceById.get(record.serviceId)!.price,
    asset: serviceById.get(record.serviceId)!.asset,
    status: record.status,
    txHash: record.paymentProof?.txHash ?? record.receipt?.txHash ?? null,
    isInternal: record.isInternal,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    failureReason: record.failureReason ?? null,
  }));
}
