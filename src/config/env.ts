import { z } from "zod";

const envSchema = z.object({
  PAYMENT_PROVIDER: z.enum(["mock", "goat-flow"]).default("mock"),
  GOATX402_API_URL: z.url().default("https://flow-api.testnet3.goat.network"),
  GOATX402_API_KEY: z.string().optional(),
  GOATX402_API_SECRET: z.string().optional(),
  GOAT_CHAIN_ID: z.coerce.number().int().positive().default(48816),
  GOAT_EXPLORER_URL: z.url().default("https://explorer.testnet3.goat.network"),
});

export const env = envSchema.parse({
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
  GOATX402_API_URL: process.env.GOATX402_API_URL,
  GOATX402_API_KEY: process.env.GOATX402_API_KEY,
  GOATX402_API_SECRET: process.env.GOATX402_API_SECRET,
  GOAT_CHAIN_ID: process.env.GOAT_CHAIN_ID,
  GOAT_EXPLORER_URL: process.env.GOAT_EXPLORER_URL,
});
