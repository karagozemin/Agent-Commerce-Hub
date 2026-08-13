import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import { getDatabase } from "@/db/client";
import { internalWallets } from "@/db/schema";

const configuredWallets = new Set(env.INTERNAL_WALLETS.split(",").map((wallet) => wallet.trim().toLowerCase()).filter(Boolean));

export async function isInternalWallet(wallet: string) {
  const normalized = wallet.toLowerCase();
  if (configuredWallets.has(normalized)) return true;
  if (env.DATA_STORE !== "postgres" || !env.DATABASE_URL) return false;
  const [row] = await getDatabase().select({ walletAddress: internalWallets.walletAddress }).from(internalWallets).where(eq(internalWallets.walletAddress, normalized)).limit(1);
  return Boolean(row);
}
