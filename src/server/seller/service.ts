import { randomUUID } from "node:crypto";
import { isAddress, parseUnits } from "viem";
import { z } from "zod";
import { assertPublicEndpoint, validateSellerEndpoint } from "@/server/endpoint-security";
import type { AuthSession } from "@/server/auth/repository";
import { sellerRepository, type SellerRepository } from "./repository";

const categories = ["Developer Tools", "Research & Data", "Agent Operations", "GOAT Native"] as const;
const registryAddresses = {
  "goat-mainnet": "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  "goat-testnet": "0x556089008Fc0a60cD09390Eca93477ca254A5522",
};

const profileSchema = z.object({ displayName: z.string().trim().min(2).max(60) });
const serviceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(20).max(500),
  category: z.enum(categories),
  endpoint: z.string().trim(),
  price: z.string().regex(/^\d+(\.\d{1,6})?$/),
  receivingWallet: z.string(),
  network: z.enum(["goat-mainnet", "goat-testnet"]),
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()),
  agentId: z.string().trim().max(100).optional(),
  agentUri: z.string().trim().optional(),
});

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export class SellerService {
  constructor(
    private readonly repository: SellerRepository = sellerRepository,
    private readonly endpointValidator: (value: string) => Promise<string> = assertPublicEndpoint,
  ) {}

  async getWorkspace(session: AuthSession) {
    const profile = await this.repository.findProfileByUser(session.userId);
    return { profile, services: profile ? await this.repository.listServices(profile.id) : [] };
  }

  async createProfile(session: AuthSession, input: unknown) {
    const data = profileSchema.parse(input);
    return this.repository.createProfile({
      id: `slr_${randomUUID().replaceAll("-", "")}`,
      userId: session.userId,
      displayName: data.displayName,
      status: "active",
      createdAt: new Date(),
    });
  }

  async createService(session: AuthSession, input: unknown) {
    const data = serviceSchema.parse(input);
    const profile = await this.repository.findProfileByUser(session.userId);
    if (!profile) throw new Error("Create a seller profile first");
    if (!isAddress(data.receivingWallet)) throw new Error("A valid receiving wallet is required");
    const numericPrice = Number(data.price);
    if (numericPrice < 0.01 || numericPrice > 1) throw new Error("Pilot price must be between 0.01 and 1.00 USDC");
    const endpoint = await this.endpointValidator(data.endpoint);
    const baseSlug = slugify(data.name);
    if (!baseSlug) throw new Error("Service name must contain letters or numbers");
    const slug = await this.repository.slugExists(baseSlug) ? `${baseSlug}-${randomUUID().slice(0, 6)}` : baseSlug;
    if ((data.agentId && !data.agentUri) || (!data.agentId && data.agentUri)) {
      throw new Error("Agent ID and agent URI must be provided together");
    }
    if (data.agentUri) validateSellerEndpoint(data.agentUri);
    const id = `svc_${randomUUID().replaceAll("-", "")}`;
    const draft = {
      id,
      sellerId: profile.id,
      slug,
      name: data.name,
      description: data.description,
      category: data.category,
      endpoint,
      method: "POST",
      inputSchema: data.inputSchema,
      outputSchema: data.outputSchema,
      price: data.price,
      amountWei: parseUnits(data.price, 6).toString(),
      asset: "USDC",
      network: data.network,
      status: "draft",
      healthStatus: "unknown",
      receivingWallet: data.receivingWallet.toLowerCase(),
      createdAt: new Date(),
    };
    const identity = data.agentId && data.agentUri ? {
      id: `aid_${randomUUID().replaceAll("-", "")}`,
      sellerId: profile.id,
      network: data.network,
      registryAddress: registryAddresses[data.network],
      agentId: data.agentId,
      agentUri: data.agentUri,
      ownerWallet: session.walletAddress,
    } : undefined;
    return this.repository.createService(draft, identity);
  }
}

export const sellerService = new SellerService();
