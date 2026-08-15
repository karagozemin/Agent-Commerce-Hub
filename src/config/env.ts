import { z } from "zod";

const envSchema = z.object({
  DATA_STORE: z.enum(["memory", "postgres"]).default("memory"),
  DATABASE_URL: z.string().min(1).optional(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(["mock", "goat-flow"]).default("mock"),
  GOATX402_API_URL: z.url().default("https://flow-api.testnet3.goat.network"),
  GOATX402_API_KEY: z.string().optional(),
  GOATX402_API_SECRET: z.string().optional(),
  GOATX402_RECEIVING_WALLET: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  GOAT_QUICKPAY_ORIGIN: z.url().default("https://flow-quickpay.goat.network"),
  GOAT_QUICKPAY_MERCHANT_ID: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).default("agentcommercehub"),
  GOAT_QUICKPAY_PRODUCT_KEY: z.string().regex(/^[A-Za-z0-9._:~-]{1,64}$/).default("wallet-analysis"),
  GOAT_CHAIN_ID: z.coerce.number().int().positive().default(48816),
  GOAT_RPC_URL: z.url().default("https://rpc.testnet3.goat.network"),
  GOAT_TRACKING_RPC_URL: z.url().default("https://rpc.ankr.com/goat_mainnet"),
  GOAT_EXPLORER_URL: z.url().default("https://explorer.testnet3.goat.network"),
  INTERNAL_WALLETS: z.string().default(""),
});

export const env = envSchema.parse({
  DATA_STORE: process.env.DATA_STORE,
  DATABASE_URL: process.env.DATABASE_URL,
  CREDENTIAL_ENCRYPTION_KEY: process.env.CREDENTIAL_ENCRYPTION_KEY,
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
  GOATX402_API_URL: process.env.GOATX402_API_URL,
  GOATX402_API_KEY: process.env.GOATX402_API_KEY,
  GOATX402_API_SECRET: process.env.GOATX402_API_SECRET,
  GOATX402_RECEIVING_WALLET: process.env.GOATX402_RECEIVING_WALLET,
  GOAT_QUICKPAY_ORIGIN: process.env.GOAT_QUICKPAY_ORIGIN,
  GOAT_QUICKPAY_MERCHANT_ID: process.env.GOAT_QUICKPAY_MERCHANT_ID,
  GOAT_QUICKPAY_PRODUCT_KEY: process.env.GOAT_QUICKPAY_PRODUCT_KEY,
  GOAT_CHAIN_ID: process.env.GOAT_CHAIN_ID,
  GOAT_RPC_URL: process.env.GOAT_RPC_URL,
  GOAT_TRACKING_RPC_URL: process.env.GOAT_TRACKING_RPC_URL,
  GOAT_EXPLORER_URL: process.env.GOAT_EXPLORER_URL,
  INTERNAL_WALLETS: process.env.INTERNAL_WALLETS,
});

if (env.DATA_STORE === "postgres" && !env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required when DATA_STORE=postgres");
}
