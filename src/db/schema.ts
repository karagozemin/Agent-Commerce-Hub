import { boolean, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const invocationStatus = pgEnum("invocation_status", [
  "CREATED", "PAYMENT_REQUIRED", "PAYMENT_SUBMITTED", "PAYMENT_CONFIRMED", "EXECUTING", "SUCCEEDED",
  "PAYMENT_FAILED", "PAYMENT_EXPIRED", "EXECUTION_FAILED", "REFUND_REQUIRED", "REFUNDED",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authChallenges = pgTable("auth_challenges", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  message: text("message").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  walletAddress: text("wallet_address").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sellers = pgTable("sellers", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("sellers_user_idx").on(table.userId)]);

export const merchantConfigs = pgTable("merchant_configs", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id").references(() => sellers.id).notNull().unique(),
  merchantId: text("merchant_id").notNull(),
  apiUrl: text("api_url").notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  encryptedApiSecret: text("encrypted_api_secret").notNull(),
  receivingWallet: text("receiving_wallet").notNull(),
  network: text("network").notNull(),
  receiveType: text("receive_type"),
  supportedTokens: jsonb("supported_tokens"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const serviceRecords = pgTable("services", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id").references(() => sellers.id).notNull(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  endpoint: text("endpoint").notNull(),
  method: text("method").default("POST").notNull(),
  inputSchema: jsonb("input_schema").notNull(),
  outputSchema: jsonb("output_schema").notNull(),
  testInput: jsonb("test_input").notNull(),
  price: numeric("price").notNull(),
  amountWei: text("amount_wei").notNull(),
  asset: text("asset").notNull(),
  network: text("network").notNull(),
  status: text("status").default("draft").notNull(),
  healthStatus: text("health_status").default("unknown").notNull(),
  endpointVerifiedAt: timestamp("endpoint_verified_at", { withTimezone: true }),
  endpointLatencyMs: integer("endpoint_latency_ms"),
  endpointLastError: text("endpoint_last_error"),
  receivingWallet: text("receiving_wallet").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentIdentities = pgTable("agent_identities", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id").references(() => sellers.id).notNull(),
  serviceId: text("service_id").references(() => serviceRecords.id).unique(),
  network: text("network").notNull(),
  registryAddress: text("registry_address").notNull(),
  agentId: text("agent_id").notNull(),
  agentUri: text("agent_uri").notNull(),
  ownerWallet: text("owner_wallet").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

export const invocations = pgTable("invocations", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  serviceId: text("service_id").references(() => serviceRecords.id).notNull(),
  buyerWallet: text("buyer_wallet").notNull(),
  orderId: text("order_id"),
  txHash: text("tx_hash"),
  paymentOrder: jsonb("payment_order"),
  paymentProof: jsonb("payment_proof"),
  amount: numeric("amount").notNull(),
  amountWei: text("amount_wei").notNull(),
  asset: text("asset").notNull(),
  status: invocationStatus("status").default("CREATED").notNull(),
  input: jsonb("input").notNull(),
  inputHash: text("input_hash").notNull(),
  output: jsonb("output"),
  outputHash: text("output_hash"),
  receipt: jsonb("receipt"),
  paymentConfirmedAt: timestamp("payment_confirmed_at", { withTimezone: true }),
  executionStartedAt: timestamp("execution_started_at", { withTimezone: true }),
  executionCompletedAt: timestamp("execution_completed_at", { withTimezone: true }),
  latencyMs: integer("latency_ms"),
  isInternal: boolean("is_internal").default(false).notNull(),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("invocations_idempotency_idx").on(table.idempotencyKey, table.buyerWallet)]);

export const internalWallets = pgTable("internal_wallets", {
  walletAddress: text("wallet_address").primaryKey(),
  label: text("label").notNull(),
  reason: text("reason").notNull(),
});
