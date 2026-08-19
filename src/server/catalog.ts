import { and, desc, eq, sql } from "drizzle-orm";
import { env } from "@/config/env";
import { getDatabase } from "@/db/client";
import { ensureCatalogSeeded } from "@/db/seed";
import { agentIdentities, invocations, sellers, serviceRecords } from "@/db/schema";
import { services as seedServices } from "@/data/services";
import type { ServiceCategory, ServiceManifest } from "@/domain/types";

export interface RuntimeService extends ServiceManifest { endpoint: string; method: string; testInput: unknown; endpointVerifiedAt: Date | null }

function seedRuntime(service: ServiceManifest): RuntimeService {
  return { ...service, endpoint: `internal://${service.slug}`, method: "POST", testInput: {}, endpointVerifiedAt: null };
}

function isPurchasable(service: RuntimeService) {
  if (env.PAYMENT_PROVIDER !== "goat-flow") return true;
  const liveQuickPayProduct = !service.sellerId
    && service.slug === "wallet-lens"
    && service.network === "goat-mainnet";
  const verifiedExternalService = Boolean(service.sellerId)
    && service.endpoint.startsWith("https://")
    && service.identity.verified;
  return liveQuickPayProduct || verifiedExternalService;
}

export async function listPublishedServices(): Promise<RuntimeService[]> {
  if (env.DATA_STORE === "memory") return seedServices.map(seedRuntime).filter(isPurchasable);
  await ensureCatalogSeeded();
  const rows = await getDatabase().select({
    service: serviceRecords,
    sellerName: sellers.displayName,
    identity: agentIdentities,
    invocationCount: sql<number>`count(${invocations.id})::int`,
  }).from(serviceRecords)
    .innerJoin(sellers, eq(serviceRecords.sellerId, sellers.id))
    .leftJoin(agentIdentities, eq(agentIdentities.serviceId, serviceRecords.id))
    .leftJoin(invocations, and(eq(invocations.serviceId, serviceRecords.id), eq(invocations.status, "SUCCEEDED")))
    .where(eq(serviceRecords.status, "published"))
    .groupBy(serviceRecords.id, sellers.id, agentIdentities.id)
    .orderBy(desc(serviceRecords.publishedAt), desc(serviceRecords.createdAt));

  return rows.map(({ service, sellerName, identity, invocationCount }): RuntimeService => ({
    id: service.id,
    slug: service.slug,
    name: service.name,
    description: service.description,
    longDescription: service.description,
    category: service.category as ServiceCategory,
    tags: [],
    sellerName,
    sellerWallet: service.receivingWallet as `0x${string}`,
    identity: {
      agentId: identity?.agentId ?? "",
      ownerWallet: (identity?.ownerWallet ?? service.receivingWallet) as `0x${string}`,
      registryAddress: (identity?.registryAddress ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      agentUri: identity?.agentUri ?? "",
      verified: Boolean(identity?.verifiedAt),
    },
    network: service.network as RuntimeService["network"],
    pricing: { model: "per_call" as const, amount: service.price, amountWei: service.amountWei, asset: service.asset },
    inputSchema: service.inputSchema as Record<string, unknown>,
    outputSchema: service.outputSchema as Record<string, unknown>,
    availability: service.healthStatus === "online" ? "online" : service.healthStatus === "offline" ? "offline" : "degraded",
    expectedLatencyMs: service.endpointLatencyMs ?? 0,
    successRate: 0,
    invocationCount,
    repeatUsageRate: 0,
    paymentProtocol: "x402",
    sellerId: service.endpoint.startsWith("internal://") ? undefined : service.sellerId,
    endpoint: service.endpoint,
    method: service.method,
    testInput: service.testInput,
    endpointVerifiedAt: service.endpointVerifiedAt,
  })).filter(isPurchasable);
}

export async function findPublishedServiceBySlug(slug: string) {
  return (await listPublishedServices()).find((service) => service.slug === slug);
}

export async function findPublishedServiceById(id: string) {
  return (await listPublishedServices()).find((service) => service.id === id);
}
