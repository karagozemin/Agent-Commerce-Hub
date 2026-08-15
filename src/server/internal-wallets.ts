import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import { getDatabase } from "@/db/client";
import { internalWallets } from "@/db/schema";
import { services } from "@/data/services";

const configuredWallets = new Set(env.INTERNAL_WALLETS.split(",").map((wallet) => wallet.trim().toLowerCase()).filter(Boolean));
const firstPartyWallets = new Set(services
  .filter((service) => service.sellerName === "Agent Commerce Hub")
  .flatMap((service) => [service.sellerWallet, service.identity.ownerWallet])
  .map((wallet) => wallet.toLowerCase()));

export async function isInternalWallet(wallet: string) {
  const normalized = wallet.toLowerCase();
  if (configuredWallets.has(normalized) || firstPartyWallets.has(normalized)) return true;
  if (env.DATA_STORE !== "postgres" || !env.DATABASE_URL) return false;
  const [row] = await getDatabase().select({ walletAddress: internalWallets.walletAddress }).from(internalWallets).where(eq(internalWallets.walletAddress, normalized)).limit(1);
  return Boolean(row);
}
