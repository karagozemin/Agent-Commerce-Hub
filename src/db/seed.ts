import { services } from "@/data/services";
import { getDatabase } from "./client";
import { agentIdentities, sellers, serviceRecords, users } from "./schema";

let seedPromise: Promise<void> | undefined;

export function ensureCatalogSeeded() {
  seedPromise ??= seedCatalog();
  return seedPromise;
}

async function seedCatalog() {
  const db = getDatabase();
  for (const service of services) {
    const wallet = service.sellerWallet.toLowerCase();
    const userId = `usr_seed_${service.id}`;
    const sellerId = `slr_seed_${service.id}`;

    await db.insert(users).values({ id: userId, walletAddress: wallet }).onConflictDoNothing();
    await db.insert(sellers).values({
      id: sellerId,
      userId,
      displayName: service.sellerName,
      status: "active",
    }).onConflictDoUpdate({
      target: sellers.userId,
      set: { displayName: service.sellerName },
    });
    await db.insert(serviceRecords).values({
      id: service.id,
      sellerId,
      slug: service.slug,
      name: service.name,
      description: service.description,
      category: service.category,
      endpoint: `internal://${service.slug}`,
      inputSchema: service.inputSchema,
      outputSchema: service.outputSchema,
      testInput: {},
      price: service.pricing.amount,
      amountWei: service.pricing.amountWei,
      asset: service.pricing.asset,
      network: service.network,
      status: "published",
      healthStatus: service.availability,
      endpointVerifiedAt: new Date(),
      receivingWallet: wallet,
      publishedAt: new Date(),
    }).onConflictDoUpdate({
      target: serviceRecords.slug,
      set: {
        name: service.name,
        description: service.description,
        inputSchema: service.inputSchema,
        outputSchema: service.outputSchema,
        price: service.pricing.amount,
        amountWei: service.pricing.amountWei,
        asset: service.pricing.asset,
        healthStatus: service.availability,
        network: service.network,
        receivingWallet: wallet,
      },
    });
    await db.insert(agentIdentities).values({
      id: `aid_seed_${service.id}`,
      sellerId,
      serviceId: service.id,
      network: service.network,
      registryAddress: service.identity.registryAddress,
      agentId: service.identity.agentId,
      agentUri: service.identity.agentUri,
      ownerWallet: service.identity.ownerWallet.toLowerCase(),
      verifiedAt: service.identity.verified ? new Date() : null,
    }).onConflictDoUpdate({
      target: agentIdentities.id,
      set: {
        serviceId: service.id,
        network: service.network,
        registryAddress: service.identity.registryAddress,
        agentId: service.identity.agentId,
        agentUri: service.identity.agentUri,
        ownerWallet: service.identity.ownerWallet.toLowerCase(),
        verifiedAt: service.identity.verified ? new Date() : null,
      },
    });
  }
}
