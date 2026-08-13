import { isAddress } from "viem";
import { z } from "zod/v4";
import { listPublishedServices, type RuntimeService } from "./catalog";
import { invocationRepository } from "./repository";
import { invocationService } from "./invocation-service";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const serviceSearchInput = {
  query: z.string().trim().max(120).optional().describe("Search name, description, category, or tags"),
  category: z.string().trim().max(80).optional(),
  maxPrice: z.number().nonnegative().optional().describe("Maximum per-call price in USDC"),
  maxLatencyMs: z.number().int().positive().optional(),
  verifiedOnly: z.boolean().default(false),
};

const slugInput = { slug: z.string().trim().min(1).max(120) };

function textResult(value: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

function publicService(service: RuntimeService) {
  return {
    id: service.id,
    slug: service.slug,
    name: service.name,
    description: service.description,
    category: service.category,
    sellerName: service.sellerName,
    sellerWallet: service.sellerWallet,
    identity: service.identity,
    network: service.network,
    pricing: service.pricing,
    inputSchema: service.inputSchema,
    outputSchema: service.outputSchema,
    availability: service.availability,
    expectedLatencyMs: service.expectedLatencyMs,
    successRate: service.successRate,
    invocationCount: service.invocationCount,
    repeatUsageRate: service.repeatUsageRate,
    paymentProtocol: service.paymentProtocol,
  };
}

function matchesSearch(service: RuntimeService, query?: string) {
  if (!query) return true;
  const haystack = [service.name, service.description, service.category, ...service.tags].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function createMarketplaceMcpServer() {
  const server = new McpServer({ name: "agent-commerce-hub", version: "0.1.0" });

  server.registerTool("search_services", {
    title: "Search services",
    description: "Find published paid agent services by capability, category, price, latency, and identity verification.",
    inputSchema: serviceSearchInput,
  }, async ({ query, category, maxPrice, maxLatencyMs, verifiedOnly }) => {
    const services = await listPublishedServices();
    const matches = services.filter((service) => matchesSearch(service, query))
      .filter((service) => !category || service.category.toLowerCase() === category.toLowerCase())
      .filter((service) => maxPrice === undefined || Number(service.pricing.amount) <= maxPrice)
      .filter((service) => maxLatencyMs === undefined || service.expectedLatencyMs <= maxLatencyMs)
      .filter((service) => !verifiedOnly || service.identity.verified)
      .map(publicService);
    return textResult({ data: matches, count: matches.length });
  });

  server.registerTool("get_service", {
    title: "Get service",
    description: "Get the complete public manifest, schemas, identity, pricing, and availability for one service.",
    inputSchema: slugInput,
  }, async ({ slug }) => {
    const service = await (await listPublishedServices()).find((entry) => entry.slug === slug);
    return service ? textResult({ data: publicService(service) }) : textResult({ error: "Service not found" }, true);
  });

  server.registerTool("get_service_price", {
    title: "Get service price",
    description: "Get authoritative payment terms for a published service before invoking it.",
    inputSchema: slugInput,
  }, async ({ slug }) => {
    const service = await (await listPublishedServices()).find((entry) => entry.slug === slug);
    return service ? textResult({ slug, pricing: service.pricing, network: service.network, paymentProtocol: service.paymentProtocol }) : textResult({ error: "Service not found" }, true);
  });

  server.registerTool("invoke_service", {
    title: "Invoke service",
    description: "Start a paid service invocation. A paymentRequired response contains the order terms; confirm the returned invocation after payment.",
    inputSchema: {
      slug: z.string().trim().min(1).max(120),
      buyerWallet: z.string().describe("EVM wallet that will pay for the invocation"),
      input: z.unknown(),
      idempotencyKey: z.string().trim().min(8).max(200),
    },
  }, async ({ slug, buyerWallet, input, idempotencyKey }) => {
    if (!isAddress(buyerWallet)) return textResult({ error: "A valid buyer wallet is required" }, true);
    try {
      const invocation = await invocationService.start({
        slug,
        buyerWallet: buyerWallet as `0x${string}`,
        idempotencyKey,
        payload: input,
      });
      if (invocation.status === "SUCCEEDED") return textResult({ data: invocation, idempotentReplay: true });
      if (!invocation.paymentOrder) return textResult({ error: "Invocation cannot be resumed", invocationId: invocation.id, status: invocation.status }, true);
      return textResult({ paymentRequired: true, invocationId: invocation.id, status: invocation.status, payment: invocation.paymentOrder });
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : "Unable to start invocation" }, true);
    }
  });

  server.registerTool("get_invocation_status", {
    title: "Get invocation status",
    description: "Read the current payment, execution, and result state for an invocation.",
    inputSchema: { invocationId: z.string().trim().min(1).max(120) },
  }, async ({ invocationId }) => {
    const invocation = await invocationService.get(invocationId);
    return invocation ? textResult({ data: invocation }) : textResult({ error: "Invocation not found" }, true);
  });

  server.registerTool("get_service_metrics", {
    title: "Get service metrics",
    description: "Get auditable invocation counts and latency metrics for one published service.",
    inputSchema: slugInput,
  }, async ({ slug }) => {
    const service = await (await listPublishedServices()).find((entry) => entry.slug === slug);
    if (!service) return textResult({ error: "Service not found" }, true);
    const records = (await invocationRepository.list()).filter((record) => record.serviceId === service.id);
    const succeeded = records.filter((record) => record.status === "SUCCEEDED");
    const external = succeeded.filter((record) => !record.isInternal && !record.paymentOrder?.simulation);
    return textResult({ data: {
      slug,
      invocationCount: succeeded.length,
      externalPaidInvocations: external.length,
      successRate: records.length ? Number(((succeeded.length / records.length) * 100).toFixed(2)) : 0,
      expectedLatencyMs: service.expectedLatencyMs,
      repeatUsageRate: service.repeatUsageRate,
    } });
  });

  server.registerTool("get_agent_identity", {
    title: "Get agent identity",
    description: "Find a published service by ERC-8004 agent ID and return its verified identity metadata.",
    inputSchema: { agentId: z.string().trim().min(1).max(120) },
  }, async ({ agentId }) => {
    const service = (await listPublishedServices()).find((entry) => entry.identity.agentId === agentId);
    return service ? textResult({ data: { ...service.identity, service: { slug: service.slug, name: service.name, sellerName: service.sellerName } } }) : textResult({ error: "Agent identity not found" }, true);
  });

  return server;
}
