import { and, desc, eq } from "drizzle-orm";
import { env } from "@/config/env";
import { getDatabase } from "@/db/client";
import { agentIdentities, merchantConfigs, sellers, serviceRecords } from "@/db/schema";

export interface SellerProfile {
  id: string;
  userId: string;
  displayName: string;
  status: string;
  createdAt: Date;
}

export interface SellerServiceDraft {
  id: string;
  sellerId: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  endpoint: string;
  method: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  testInput: unknown;
  price: string;
  amountWei: string;
  asset: string;
  network: string;
  status: string;
  healthStatus: string;
  endpointVerifiedAt: Date | null;
  endpointLatencyMs: number | null;
  endpointLastError: string | null;
  receivingWallet: string;
  publishedAt: Date | null;
  createdAt: Date;
}

export interface IdentityDraft {
  id: string;
  sellerId: string;
  serviceId: string;
  network: string;
  registryAddress: string;
  agentId: string;
  agentUri: string;
  ownerWallet: string;
}

export interface MerchantConfigRecord {
  id: string;
  sellerId: string;
  merchantId: string;
  apiUrl: string;
  encryptedApiKey: string;
  encryptedApiSecret: string;
  receivingWallet: string;
  network: string;
  receiveType: string | null;
  supportedTokens: unknown;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerRepository {
  findProfileByUser(userId: string): Promise<SellerProfile | undefined>;
  createProfile(profile: SellerProfile): Promise<SellerProfile>;
  createService(service: SellerServiceDraft, identity?: IdentityDraft): Promise<SellerServiceDraft>;
  listServices(sellerId: string): Promise<SellerServiceDraft[]>;
  findServiceOwnedByUser(serviceId: string, userId: string): Promise<SellerServiceDraft | undefined>;
  findIdentityByService(serviceId: string): Promise<(IdentityDraft & { verifiedAt: Date | null }) | undefined>;
  recordEndpointVerification(serviceId: string, result: { verifiedAt?: Date; latencyMs?: number; error?: string }): Promise<SellerServiceDraft>;
  markIdentityVerified(identityId: string, ownerWallet: string, verifiedAt: Date): Promise<void>;
  publishService(serviceId: string, publishedAt: Date): Promise<SellerServiceDraft>;
  upsertMerchantConfig(config: MerchantConfigRecord): Promise<MerchantConfigRecord>;
  findMerchantConfig(sellerId: string): Promise<MerchantConfigRecord | undefined>;
  slugExists(slug: string): Promise<boolean>;
}

function toServiceDraft(row: typeof serviceRecords.$inferSelect): SellerServiceDraft {
  return {
    ...row,
    inputSchema: row.inputSchema as Record<string, unknown>,
    outputSchema: row.outputSchema as Record<string, unknown>,
    testInput: row.testInput,
  };
}

export class MemorySellerRepository implements SellerRepository {
  private profiles = new Map<string, SellerProfile>();
  private serviceDrafts = new Map<string, SellerServiceDraft>();
  private identities = new Map<string, IdentityDraft & { verifiedAt: Date | null }>();
  private merchants = new Map<string, MerchantConfigRecord>();

  async findProfileByUser(userId: string) { return this.profiles.get(userId); }
  async createProfile(profile: SellerProfile) {
    const existing = this.profiles.get(profile.userId);
    if (existing) return existing;
    this.profiles.set(profile.userId, profile);
    return profile;
  }
  async createService(service: SellerServiceDraft, identity?: IdentityDraft) {
    if ([...this.serviceDrafts.values()].some((item) => item.slug === service.slug)) throw new Error("Service slug already exists");
    this.serviceDrafts.set(service.id, service);
    if (identity) this.identities.set(identity.serviceId, { ...identity, verifiedAt: null });
    return service;
  }
  async listServices(sellerId: string) { return [...this.serviceDrafts.values()].filter((item) => item.sellerId === sellerId); }
  async findServiceOwnedByUser(serviceId: string, userId: string) {
    const service = this.serviceDrafts.get(serviceId);
    const profile = service ? this.profiles.get(userId) : undefined;
    return service && profile?.id === service.sellerId ? service : undefined;
  }
  async findIdentityByService(serviceId: string) { return this.identities.get(serviceId); }
  async recordEndpointVerification(serviceId: string, result: { verifiedAt?: Date; latencyMs?: number; error?: string }) {
    const service = this.serviceDrafts.get(serviceId);
    if (!service) throw new Error("Service not found");
    const updated = { ...service, healthStatus: result.verifiedAt ? "online" : "offline", endpointVerifiedAt: result.verifiedAt ?? null, endpointLatencyMs: result.latencyMs ?? null, endpointLastError: result.error ?? null };
    this.serviceDrafts.set(serviceId, updated);
    return updated;
  }
  async markIdentityVerified(identityId: string, ownerWallet: string, verifiedAt: Date) {
    const item = [...this.identities.entries()].find(([, identity]) => identity.id === identityId);
    if (item) this.identities.set(item[0], { ...item[1], ownerWallet, verifiedAt });
  }
  async publishService(serviceId: string, publishedAt: Date) {
    const service = this.serviceDrafts.get(serviceId);
    if (!service) throw new Error("Service not found");
    const updated = { ...service, status: "published", publishedAt };
    this.serviceDrafts.set(serviceId, updated);
    return updated;
  }
  async upsertMerchantConfig(config: MerchantConfigRecord) { this.merchants.set(config.sellerId, config); return config; }
  async findMerchantConfig(sellerId: string) { return this.merchants.get(sellerId); }
  async slugExists(slug: string) { return [...this.serviceDrafts.values()].some((item) => item.slug === slug); }
}

class PostgresSellerRepository implements SellerRepository {
  async findProfileByUser(userId: string) {
    const [row] = await getDatabase().select().from(sellers).where(eq(sellers.userId, userId)).limit(1);
    return row;
  }
  async createProfile(profile: SellerProfile) {
    const [row] = await getDatabase().insert(sellers).values(profile).onConflictDoNothing({ target: sellers.userId }).returning();
    return row ?? (await this.findProfileByUser(profile.userId))!;
  }
  async createService(service: SellerServiceDraft, identity?: IdentityDraft) {
    return getDatabase().transaction(async (tx) => {
      const [row] = await tx.insert(serviceRecords).values(service).returning();
      if (identity) await tx.insert(agentIdentities).values(identity);
      return toServiceDraft(row);
    });
  }
  async listServices(sellerId: string) {
    const rows = await getDatabase().select().from(serviceRecords).where(eq(serviceRecords.sellerId, sellerId)).orderBy(desc(serviceRecords.createdAt));
    return rows.map(toServiceDraft);
  }
  async findServiceOwnedByUser(serviceId: string, userId: string) {
    const [row] = await getDatabase().select({ service: serviceRecords }).from(serviceRecords)
      .innerJoin(sellers, eq(serviceRecords.sellerId, sellers.id))
      .where(and(eq(serviceRecords.id, serviceId), eq(sellers.userId, userId))).limit(1);
    return row ? toServiceDraft(row.service) : undefined;
  }
  async findIdentityByService(serviceId: string) {
    const [row] = await getDatabase().select().from(agentIdentities).where(eq(agentIdentities.serviceId, serviceId)).limit(1);
    return row ? { ...row, serviceId, verifiedAt: row.verifiedAt } : undefined;
  }
  async recordEndpointVerification(serviceId: string, result: { verifiedAt?: Date; latencyMs?: number; error?: string }) {
    const [row] = await getDatabase().update(serviceRecords).set({
      healthStatus: result.verifiedAt ? "online" : "offline",
      endpointVerifiedAt: result.verifiedAt ?? null,
      endpointLatencyMs: result.latencyMs ?? null,
      endpointLastError: result.error ?? null,
    }).where(eq(serviceRecords.id, serviceId)).returning();
    if (!row) throw new Error("Service not found");
    return toServiceDraft(row);
  }
  async markIdentityVerified(identityId: string, ownerWallet: string, verifiedAt: Date) {
    await getDatabase().update(agentIdentities).set({ ownerWallet, verifiedAt }).where(eq(agentIdentities.id, identityId));
  }
  async publishService(serviceId: string, publishedAt: Date) {
    const [row] = await getDatabase().update(serviceRecords).set({ status: "published", publishedAt }).where(eq(serviceRecords.id, serviceId)).returning();
    if (!row) throw new Error("Service not found");
    return toServiceDraft(row);
  }
  async upsertMerchantConfig(config: MerchantConfigRecord) {
    const [row] = await getDatabase().insert(merchantConfigs).values(config).onConflictDoUpdate({
      target: merchantConfigs.sellerId,
      set: {
        merchantId: config.merchantId,
        apiUrl: config.apiUrl,
        encryptedApiKey: config.encryptedApiKey,
        encryptedApiSecret: config.encryptedApiSecret,
        receivingWallet: config.receivingWallet,
        network: config.network,
        receiveType: config.receiveType,
        supportedTokens: config.supportedTokens,
        verifiedAt: config.verifiedAt,
        updatedAt: config.updatedAt,
      },
    }).returning();
    return row;
  }
  async findMerchantConfig(sellerId: string) {
    const [row] = await getDatabase().select().from(merchantConfigs).where(eq(merchantConfigs.sellerId, sellerId)).limit(1);
    return row;
  }
  async slugExists(slug: string) {
    const [row] = await getDatabase().select({ id: serviceRecords.id }).from(serviceRecords).where(eq(serviceRecords.slug, slug)).limit(1);
    return Boolean(row);
  }
}

const globalSeller = globalThis as typeof globalThis & { sellerRepository?: SellerRepository };
export const sellerRepository = globalSeller.sellerRepository ?? (
  env.DATA_STORE === "postgres" ? new PostgresSellerRepository() : new MemorySellerRepository()
);
if (process.env.NODE_ENV !== "production") globalSeller.sellerRepository = sellerRepository;
