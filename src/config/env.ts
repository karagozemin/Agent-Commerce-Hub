import { z } from "zod";

const envSchema = z.object({
  DATA_STORE: z.enum(["memory", "postgres"]).default("memory"),
  DATABASE_URL: z.string().min(1).optional(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(["mock", "goat-flow"]).default("mock"),
  GOATX402_API_URL: z.url().default("https://flow-api.testnet3.goat.network"),
  GOATX402_API_KEY: z.string().optional(),
  GOATX402_API_SECRET: z.string().optional(),
  GOAT_CHAIN_ID: z.coerce.number().int().positive().default(48816),
  GOAT_RPC_URL: z.url().default("https://rpc.testnet3.goat.network"),
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
  GOAT_CHAIN_ID: process.env.GOAT_CHAIN_ID,
  GOAT_RPC_URL: process.env.GOAT_RPC_URL,
  GOAT_EXPLORER_URL: process.env.GOAT_EXPLORER_URL,
  INTERNAL_WALLETS: process.env.INTERNAL_WALLETS,
});

if (env.DATA_STORE === "postgres" && !env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required when DATA_STORE=postgres");
}
