import { env } from "@/config/env";
import type { InvocationRecord } from "@/domain/types";
import { listPublishedServices } from "./catalog";
import { invocationRepository } from "./repository";

function isEligible(record: InvocationRecord, network: string | undefined) {
  return record.status === "SUCCEEDED"
    && !record.isInternal
    && !record.paymentOrder?.simulation
    && Boolean(record.paymentProof?.txHash || record.receipt?.txHash)
    && network === "goat-mainnet";
}

function maskAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export interface PublicActivityItem {
  invocationId: string;
  service: { slug: string; name: string };
  seller: { name: string; wallet: string };
  buyer: string;
  amount: string;
  asset: string;
  status: "Successful";
  txHash: string;
  timestamp: string;
  explorerUrl: string;
}

export async function getPublicMetrics() {
  const [records, services] = await Promise.all([invocationRepository.list(), listPublishedServices()]);
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const eligible = records.filter((record) => isEligible(record, serviceById.get(record.serviceId)?.network));
  const internal = records.filter((record) => record.status === "SUCCEEDED" && (record.isInternal || record.paymentOrder?.simulation));
  const payers = new Map<string, number>();
  for (const record of eligible) payers.set(record.buyerWallet.toLowerCase(), (payers.get(record.buyerWallet.toLowerCase()) ?? 0) + 1);
  const repeatPayers = [...payers.values()].filter((count) => count > 1).length;
  const volume = eligible.reduce((total, record) => total + Number(serviceById.get(record.serviceId)?.pricing.amount ?? 0), 0);
  const byService = new Map<string, { slug: string; name: string; invocations: number; volume: number }>();
  for (const record of eligible) {
    const service = serviceById.get(record.serviceId);
    if (!service) continue;
    const current = byService.get(service.id) ?? { slug: service.slug, name: service.name, invocations: 0, volume: 0 };
    current.invocations += 1;
    current.volume += Number(service.pricing.amount);
    byService.set(service.id, current);
  }

  return {
    mainnetPaidInvocations: eligible.length,
    internalSuccessfulInvocations: internal.length,
    uniqueExternalPayers: payers.size,
    externalPaymentVolume: volume.toFixed(2),
    activeSellers: new Set(services.map((service) => service.sellerWallet.toLowerCase())).size,
    liveServices: services.filter((service) => service.availability === "online").length,
    sellerRevenue: volume.toFixed(2),
    repeatUsageRate: payers.size ? Number(((repeatPayers / payers.size) * 100).toFixed(2)) : 0,
    topServices: [...byService.values()].sort((a, b) => b.invocations - a.invocations).map((item) => ({ ...item, volume: item.volume.toFixed(2) })),
    methodology: "Only successful, externally initiated GOAT mainnet invocations with a verified transaction hash are included. Simulations and known internal activity are excluded.",
  };
}

export async function getPublicActivity(limit = 50) {
  const [records, services] = await Promise.all([invocationRepository.list(), listPublishedServices()]);
  const serviceById = new Map(services.map((service) => [service.id, service]));
  return records.filter((record) => isEligible(record, serviceById.get(record.serviceId)?.network)).slice(0, limit).map((record): PublicActivityItem | null => {
    const service = serviceById.get(record.serviceId);
    const txHash = record.paymentProof?.txHash ?? record.receipt?.txHash;
    if (!service || !txHash) return null;
    return {
      invocationId: record.id,
      service: { slug: service.slug, name: service.name },
      seller: { name: service.sellerName, wallet: service.sellerWallet },
      buyer: maskAddress(record.buyerWallet),
      amount: service.pricing.amount,
      asset: service.pricing.asset,
      status: "Successful",
      txHash,
      timestamp: record.updatedAt,
      explorerUrl: `${env.GOAT_EXPLORER_URL.replace(/\/$/, "")}/tx/${txHash}`,
    };
  }).filter((item): item is PublicActivityItem => Boolean(item));
}

export async function getPublicServiceMetrics(slug: string) {
  const [metrics, activity, records] = await Promise.all([getPublicMetrics(), getPublicActivity(1000), invocationRepository.list()]);
  const serviceActivity = activity.filter((item) => item.service.slug === slug);
  const service = (await listPublishedServices()).find((item) => item.slug === slug);
  if (!service) return undefined;
  const serviceRecords = records.filter((record) => record.serviceId === service.id);
  const succeededRecords = serviceRecords.filter((record) => record.status === "SUCCEEDED");
  return {
    slug: service.slug,
    name: service.name,
    invocationCount: serviceActivity.length,
    externalPaidInvocations: serviceActivity.length,
    successRate: serviceRecords.length ? Number(((succeededRecords.length / serviceRecords.length) * 100).toFixed(2)) : 0,
    expectedLatencyMs: service.expectedLatencyMs,
    repeatUsageRate: service.repeatUsageRate,
    volume: serviceActivity.reduce((total, item) => total + Number(item.amount), 0).toFixed(2),
    rank: metrics.topServices.findIndex((item) => item.slug === slug) + 1 || null,
  };
}
