import { createPublicClient, getAddress, http, isAddress, zeroAddress } from "viem";
import { env } from "@/config/env";
import type { IdentityDraft } from "./seller/repository";

const identityAbi = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "getAgentWallet", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

const rpcByNetwork = {
  "goat-mainnet": "https://rpc.goat.network",
  "goat-testnet": "https://rpc.testnet3.goat.network",
};

export interface IdentityVerificationResult { ownerWallet: `0x${string}`; agentWallet?: `0x${string}`; verifiedAt: Date }

export async function verifyErc8004Identity(identity: IdentityDraft, sessionWallet: string): Promise<IdentityVerificationResult> {
  if (!/^\d+$/.test(identity.agentId)) throw new Error("ERC-8004 agent ID must be an unsigned integer");
  if (!isAddress(identity.registryAddress) || !isAddress(sessionWallet)) throw new Error("Identity address is invalid");
  const client = createPublicClient({ transport: http(rpcByNetwork[identity.network as keyof typeof rpcByNetwork] ?? env.GOAT_RPC_URL) });
  const address = getAddress(identity.registryAddress);
  const agentId = BigInt(identity.agentId);
  try {
    const [owner, onchainUri, agentWallet] = await Promise.all([
      client.readContract({ address, abi: identityAbi, functionName: "ownerOf", args: [agentId] }),
      client.readContract({ address, abi: identityAbi, functionName: "tokenURI", args: [agentId] }),
      client.readContract({ address, abi: identityAbi, functionName: "getAgentWallet", args: [agentId] }),
    ]);
    if (onchainUri !== identity.agentUri) throw new Error("On-chain agent URI does not match the submitted URI");
    const wallet = sessionWallet.toLowerCase();
    const authorized = owner.toLowerCase() === wallet || (agentWallet !== zeroAddress && agentWallet.toLowerCase() === wallet);
    if (!authorized) throw new Error("Signed-in wallet does not own or control this ERC-8004 agent");
    return { ownerWallet: owner, agentWallet: agentWallet === zeroAddress ? undefined : agentWallet, verifiedAt: new Date() };
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("On-chain") || error.message.startsWith("Signed-in"))) throw error;
    throw new Error(`ERC-8004 identity could not be verified: ${error instanceof Error ? error.message : "RPC error"}`);
  }
}
