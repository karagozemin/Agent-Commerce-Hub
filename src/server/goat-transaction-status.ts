import { Contract, JsonRpcProvider } from "ethers";
import { env } from "@/config/env";

const goatMainnetChainId = 2345;
const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
const provider = new JsonRpcProvider(env.GOAT_TRACKING_RPC_URL, goatMainnetChainId, { staticNetwork: true });

export interface GoatTransactionStatus {
  state: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  confirmations?: number;
  tokenBalance?: string;
}

export async function getGoatAccountBalances(account: string, token: string) {
  const contract = new Contract(token, erc20Abi, provider);
  const [nativeBalance, tokenBalance] = await Promise.all([
    provider.getBalance(account),
    contract.balanceOf(account) as Promise<bigint>,
  ]);
  return { nativeBalance: nativeBalance.toString(), tokenBalance: tokenBalance.toString() };
}

export async function getGoatTransactionStatus(hash: string, token?: string, account?: string): Promise<GoatTransactionStatus> {
  const receipt = await provider.getTransactionReceipt(hash);
  if (!receipt) return { state: "pending" };

  const latestBlock = await provider.getBlockNumber();
  const result: GoatTransactionStatus = {
    state: receipt.status === 1 ? "confirmed" : "failed",
    blockNumber: receipt.blockNumber,
    confirmations: Math.max(1, latestBlock - receipt.blockNumber + 1),
  };
  if (receipt.status === 1 && token && account) {
    const contract = new Contract(token, erc20Abi, provider);
    result.tokenBalance = String(await contract.balanceOf(account));
  }
  return result;
}
