import { desc, eq } from "drizzle-orm";
import { env } from "@/config/env";
import { getDatabase } from "@/db/client";
import { agentIdentities, sellers, serviceRecords } from "@/db/schema";

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
  price: string;
  amountWei: string;
  asset: string;
  network: string;
  status: string;
  healthStatus: string;
  receivingWallet: string;
  createdAt: Date;
}

export interface IdentityDraft {
  id: string;
  sellerId: string;
  network: string;
  registryAddress: string;
  agentId: string;
  agentUri: string;
  ownerWallet: string;
}

export interface SellerRepository {
  findProfileByUser(userId: string): Promise<SellerProfile | undefined>;
  createProfile(profile: SellerProfile): Promise<SellerProfile>;
  createService(service: SellerServiceDraft, identity?: IdentityDraft): Promise<SellerServiceDraft>;
  listServices(sellerId: string): Promise<SellerServiceDraft[]>;
  slugExists(slug: string): Promise<boolean>;
}

function toServiceDraft(row: typeof serviceRecords.$inferSelect): SellerServiceDraft {
  return {
    ...row,
    inputSchema: row.inputSchema as Record<string, unknown>,
    outputSchema: row.outputSchema as Record<string, unknown>,
  };
}

export class MemorySellerRepository implements SellerRepository {
  private profiles = new Map<string, SellerProfile>();
  private serviceDrafts = new Map<string, SellerServiceDraft>();

  async findProfileByUser(userId: string) { return this.profiles.get(userId); }
  async createProfile(profile: SellerProfile) {
    const existing = this.profiles.get(profile.userId);
    if (existing) return existing;
    this.profiles.set(profile.userId, profile);
    return profile;
  }
  async createService(service: SellerServiceDraft) {
    if ([...this.serviceDrafts.values()].some((item) => item.slug === service.slug)) throw new Error("Service slug already exists");
    this.serviceDrafts.set(service.id, service);
    return service;
  }
  async listServices(sellerId: string) { return [...this.serviceDrafts.values()].filter((item) => item.sellerId === sellerId); }
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
