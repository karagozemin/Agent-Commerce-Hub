export type InvocationStatus =
  | "CREATED"
  | "PAYMENT_REQUIRED"
  | "PAYMENT_SUBMITTED"
  | "PAYMENT_CONFIRMED"
  | "EXECUTING"
  | "SUCCEEDED"
  | "PAYMENT_FAILED"
  | "PAYMENT_EXPIRED"
  | "EXECUTION_FAILED"
  | "REFUND_REQUIRED"
  | "REFUNDED";

export type ServiceCategory =
  | "Developer Tools"
  | "Research & Data"
  | "Agent Operations"
  | "GOAT Native";

export interface AgentIdentity {
  agentId: string;
  ownerWallet: `0x${string}`;
  registryAddress: `0x${string}`;
  agentUri: string;
  verified: boolean;
}

export interface ServiceManifest {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  category: ServiceCategory;
  tags: string[];
  sellerName: string;
  sellerWallet: `0x${string}`;
  identity: AgentIdentity;
  network: "goat-mainnet" | "goat-testnet";
  pricing: {
    model: "per_call";
    amount: string;
    amountWei: string;
    asset: string;
  };
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  availability: "online" | "degraded" | "offline";
  expectedLatencyMs: number;
  successRate: number;
  invocationCount: number;
  repeatUsageRate: number;
  paymentProtocol: "x402";
}

export interface PaymentOrder {
  orderId: string;
  flow: "ERC20_DIRECT";
  tokenSymbol: string;
  tokenContract: `0x${string}`;
  fromAddress: `0x${string}`;
  payToAddress: `0x${string}`;
  chainId: number;
  amountWei: string;
  expiresAt: number;
  simulation?: boolean;
}

export interface PaymentProof {
  orderId: string;
  txHash: `0x${string}`;
  fromAddress: `0x${string}`;
  toAddress: `0x${string}`;
  tokenContract: `0x${string}`;
  amountWei: string;
  chainId: number;
  confirmedAt: string;
}

export interface InvocationReceipt {
  invocationId: string;
  serviceId: string;
  buyer: `0x${string}`;
  seller: `0x${string}`;
  amount: string;
  asset: string;
  txHash: `0x${string}`;
  inputHash: `0x${string}`;
  outputHash: `0x${string}`;
  status: "succeeded";
  timestamp: string;
}

export interface InvocationRecord {
  id: string;
  idempotencyKey: string;
  serviceId: string;
  buyerWallet: `0x${string}`;
  status: InvocationStatus;
  input: unknown;
  inputHash: `0x${string}`;
  output?: unknown;
  outputHash?: `0x${string}`;
  paymentOrder?: PaymentOrder;
  paymentProof?: PaymentProof;
  receipt?: InvocationReceipt;
  failureReason?: string;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
}
