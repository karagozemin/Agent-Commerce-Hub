import type { ServiceManifest } from "@/domain/types";

const registryAddress = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

export const services: ServiceManifest[] = [
  {
    id: "svc_wallet_lens",
    slug: "wallet-lens",
    name: "WalletLens",
    description: "Turns raw GOAT wallet history into a concise activity and risk summary.",
    longDescription:
      "WalletLens inspects account activity, counterparties, token movements, and contract interactions. It returns a structured summary suitable for both human review and downstream agent workflows.",
    category: "GOAT Native",
    tags: ["wallet", "activity", "risk"],
    sellerName: "Hub Labs",
    sellerWallet: "0x84A00000000000000000000000000000000000EF",
    identity: {
      agentId: "184",
      ownerWallet: "0x84A00000000000000000000000000000000000EF",
      registryAddress,
      agentUri: "https://agentcommerce.dev/agents/wallet-lens.json",
      verified: true,
    },
    network: "goat-mainnet",
    pricing: { model: "per_call", amount: "0.08", amountWei: "80000", asset: "USDC" },
    inputSchema: {
      type: "object",
      required: ["address"],
      properties: { address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } },
    },
    outputSchema: {
      type: "object",
      properties: { summary: { type: "string" }, riskSignals: { type: "array" } },
    },
    availability: "online",
    expectedLatencyMs: 4200,
    successRate: 99.2,
    invocationCount: 0,
    repeatUsageRate: 0,
    paymentProtocol: "x402",
  },
  {
    id: "svc_tx_explain",
    slug: "tx-explain",
    name: "TxExplain",
    description: "Decodes GOAT transactions into structured, readable execution narratives.",
    longDescription:
      "TxExplain resolves transfers, contract calls, decoded methods, emitted events, and net balance changes into a precise explanation with machine-readable evidence.",
    category: "Developer Tools",
    tags: ["transaction", "decoder", "debugging"],
    sellerName: "BlockScope",
    sellerWallet: "0x21B00000000000000000000000000000000000A4",
    identity: {
      agentId: "208",
      ownerWallet: "0x21B00000000000000000000000000000000000A4",
      registryAddress,
      agentUri: "https://agentcommerce.dev/agents/tx-explain.json",
      verified: true,
    },
    network: "goat-mainnet",
    pricing: { model: "per_call", amount: "0.05", amountWei: "50000", asset: "USDC" },
    inputSchema: {
      type: "object",
      required: ["transactionHash"],
      properties: { transactionHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" } },
    },
    outputSchema: { type: "object", properties: { explanation: { type: "string" }, events: { type: "array" } } },
    availability: "online",
    expectedLatencyMs: 2800,
    successRate: 98.7,
    invocationCount: 0,
    repeatUsageRate: 0,
    paymentProtocol: "x402",
  },
  {
    id: "svc_contract_lens",
    slug: "contract-lens",
    name: "ContractLens",
    description: "Explains contract behavior and surfaces practical risk signals before interaction.",
    longDescription:
      "ContractLens combines verified source, bytecode inspection, permissions, proxy detection, and common behavioral signals into an actionable contract report.",
    category: "Developer Tools",
    tags: ["contract", "security", "analysis"],
    sellerName: "OpenAudit",
    sellerWallet: "0x73C00000000000000000000000000000000000D2",
    identity: {
      agentId: "231",
      ownerWallet: "0x73C00000000000000000000000000000000000D2",
      registryAddress,
      agentUri: "https://agentcommerce.dev/agents/contract-lens.json",
      verified: true,
    },
    network: "goat-mainnet",
    pricing: { model: "per_call", amount: "0.15", amountWei: "150000", asset: "USDC" },
    inputSchema: {
      type: "object",
      required: ["contractAddress"],
      properties: { contractAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } },
    },
    outputSchema: { type: "object", properties: { riskLevel: { type: "string" }, findings: { type: "array" } } },
    availability: "online",
    expectedLatencyMs: 7800,
    successRate: 97.9,
    invocationCount: 0,
    repeatUsageRate: 0,
    paymentProtocol: "x402",
  },
  {
    id: "svc_repo_brief",
    slug: "repo-brief",
    name: "RepoBrief",
    description: "Maps a public repository into an architecture brief with risks and entry points.",
    longDescription:
      "RepoBrief reads a repository's structure and key files, then produces a technical system map, dependency summary, hotspots, and recommended starting points for contributors.",
    category: "Research & Data",
    tags: ["repository", "architecture", "research"],
    sellerName: "CodeAtlas",
    sellerWallet: "0x46D000000000000000000000000000000000007B",
    identity: {
      agentId: "246",
      ownerWallet: "0x46D000000000000000000000000000000000007B",
      registryAddress,
      agentUri: "https://agentcommerce.dev/agents/repo-brief.json",
      verified: true,
    },
    network: "goat-mainnet",
    pricing: { model: "per_call", amount: "0.20", amountWei: "200000", asset: "USDC" },
    inputSchema: {
      type: "object",
      required: ["repositoryUrl"],
      properties: { repositoryUrl: { type: "string", format: "uri" } },
    },
    outputSchema: { type: "object", properties: { architecture: { type: "string" }, hotspots: { type: "array" } } },
    availability: "online",
    expectedLatencyMs: 12500,
    successRate: 96.8,
    invocationCount: 0,
    repeatUsageRate: 0,
    paymentProtocol: "x402",
  },
];

export function getServiceBySlug(slug: string) {
  return services.find((service) => service.slug === slug);
}

export function getServiceById(id: string) {
  return services.find((service) => service.id === id);
}
