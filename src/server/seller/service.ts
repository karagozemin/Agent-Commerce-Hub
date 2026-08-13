import { randomUUID } from "node:crypto";
import { isAddress, parseUnits } from "viem";
import { z } from "zod";
import { assertPublicEndpoint, validateSellerEndpoint } from "@/server/endpoint-security";
import type { AuthSession } from "@/server/auth/repository";
import { sellerRepository, type SellerRepository } from "./repository";
import { compileJsonSchema, assertMatchesSchema } from "@/server/schema-validation";
import { verifyServiceEndpoint, type EndpointVerificationResult } from "@/server/service-endpoint-verifier";
import { verifyErc8004Identity, type IdentityVerificationResult } from "@/server/erc8004-verifier";
import { encryptCredential } from "@/server/credential-crypto";
import { verifyMerchantConfiguration } from "@/server/merchant-verifier";

const categories = ["Developer Tools", "Research & Data", "Agent Operations", "GOAT Native"] as const;
const registryAddresses = {
  "goat-mainnet": "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  "goat-testnet": "0x556089008Fc0a60cD09390Eca93477ca254A5522",
};

const profileSchema = z.object({ displayName: z.string().trim().min(2).max(60) });
const merchantSchema = z.object({
  merchantId: z.string().trim().min(2).max(100),
  apiKey: z.string().min(1).max(500),
  apiSecret: z.string().min(1).max(1000),
  network: z.enum(["goat-mainnet", "goat-testnet"]),
});
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
  testInput: z.unknown(),
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
    private readonly endpointVerifier: (service: import("./repository").SellerServiceDraft) => Promise<EndpointVerificationResult> = verifyServiceEndpoint,
    private readonly identityVerifier: (identity: import("./repository").IdentityDraft, wallet: string) => Promise<IdentityVerificationResult> = verifyErc8004Identity,
  ) {}

  async getWorkspace(session: AuthSession) {
    const profile = await this.repository.findProfileByUser(session.userId);
    if (!profile) return { profile, services: [] };
    const services = await this.repository.listServices(profile.id);
    const identities = await Promise.all(services.map((service) => this.repository.findIdentityByService(service.id)));
    const merchant = await this.repository.findMerchantConfig(profile.id);
    return { profile, merchantConfigured: Boolean(merchant?.verifiedAt), services: services.map((service, index) => ({ ...service, identityVerified: Boolean(identities[index]?.verifiedAt), identityLinked: Boolean(identities[index]), merchantVerified: Boolean(merchant?.verifiedAt) })) };
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
    const inputValidator = compileJsonSchema(data.inputSchema, "Input");
    compileJsonSchema(data.outputSchema, "Output");
    assertMatchesSchema(inputValidator, data.testInput, "Test input");
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
      testInput: data.testInput,
      price: data.price,
      amountWei: parseUnits(data.price, 6).toString(),
      asset: "USDC",
      network: data.network,
      status: "draft",
      healthStatus: "unknown",
      endpointVerifiedAt: null,
      endpointLatencyMs: null,
      endpointLastError: null,
      receivingWallet: data.receivingWallet.toLowerCase(),
      publishedAt: null,
      createdAt: new Date(),
    };
    const identity = data.agentId && data.agentUri ? {
      id: `aid_${randomUUID().replaceAll("-", "")}`,
      sellerId: profile.id,
      serviceId: id,
      network: data.network,
      registryAddress: registryAddresses[data.network],
      agentId: data.agentId,
      agentUri: data.agentUri,
      ownerWallet: session.walletAddress,
    } : undefined;
    return this.repository.createService(draft, identity);
  }

  async verifyEndpoint(session: AuthSession, serviceId: string) {
    const service = await this.repository.findServiceOwnedByUser(serviceId, session.userId);
    if (!service) throw new Error("Service not found");
    try {
      const result = await this.endpointVerifier(service);
      return this.repository.recordEndpointVerification(service.id, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Endpoint verification failed";
      await this.repository.recordEndpointVerification(service.id, { error: message });
      throw new Error(message);
    }
  }

  async configureMerchant(session: AuthSession, input: unknown) {
    const data = merchantSchema.parse(input);
    const profile = await this.repository.findProfileByUser(session.userId);
    if (!profile) throw new Error("Create a seller profile first");
    const services = await this.repository.listServices(profile.id);
    const matchingService = services.find((service) => service.network === data.network);
    if (!matchingService) throw new Error("Create a service for this network before configuring merchant payment");
    const result = await verifyMerchantConfiguration({
      merchantId: data.merchantId,
      network: data.network,
      receivingWallet: matchingService.receivingWallet,
      asset: matchingService.asset,
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
    });
    const now = new Date();
    await this.repository.upsertMerchantConfig({
      id: `mrc_${randomUUID().replaceAll("-", "")}`,
      sellerId: profile.id,
      merchantId: data.merchantId,
      apiUrl: result.apiUrl,
      encryptedApiKey: encryptCredential(data.apiKey),
      encryptedApiSecret: encryptCredential(data.apiSecret),
      receivingWallet: matchingService.receivingWallet,
      network: data.network,
      receiveType: result.receiveType,
      supportedTokens: result.supportedTokens,
      verifiedAt: result.verifiedAt,
      createdAt: now,
      updatedAt: now,
    });
    return { merchantId: data.merchantId, network: data.network, receivingWallet: matchingService.receivingWallet, verifiedAt: result.verifiedAt };
  }

  async verifyIdentity(session: AuthSession, serviceId: string) {
    const service = await this.repository.findServiceOwnedByUser(serviceId, session.userId);
    if (!service) throw new Error("Service not found");
    const identity = await this.repository.findIdentityByService(service.id);
    if (!identity) throw new Error("Link an ERC-8004 identity before publishing");
    const result = await this.identityVerifier(identity, session.walletAddress);
    await this.repository.markIdentityVerified(identity.id, result.ownerWallet, result.verifiedAt);
    return result;
  }

  async publish(session: AuthSession, serviceId: string) {
    const service = await this.repository.findServiceOwnedByUser(serviceId, session.userId);
    if (!service) throw new Error("Service not found");
    if (service.status === "published") return service;
    const identity = await this.repository.findIdentityByService(service.id);
    if (!identity?.verifiedAt) throw new Error("ERC-8004 identity must be verified before publishing");
    const merchant = await this.repository.findMerchantConfig(service.sellerId);
    if (!merchant?.verifiedAt || merchant.network !== service.network || merchant.receivingWallet.toLowerCase() !== service.receivingWallet.toLowerCase()) {
      throw new Error("Matching GOAT Flow merchant configuration must be verified before publishing");
    }
    const freshness = service.endpointVerifiedAt?.getTime() ?? 0;
    if (service.healthStatus !== "online" || Date.now() - freshness > 24 * 60 * 60 * 1000) {
      throw new Error("Endpoint must pass verification within 24 hours before publishing");
    }
    return this.repository.publishService(service.id, new Date());
  }
}

export const sellerService = new SellerService();
