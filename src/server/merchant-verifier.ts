import { isAddress } from "viem";
import { GoatFlowClient } from "goatflow-sdk-server";
import { randomUUID } from "node:crypto";

const apiOrigins = {
  "goat-mainnet": "https://flow-api.goat.network",
  "goat-testnet": "https://flow-api.testnet3.goat.network",
} as const;

interface MerchantWallet {
  address: string;
  chain_id: number;
  token_symbol: string;
  token_contract: string;
}

interface MerchantResponse {
  merchant_id: string;
  receive_type: string;
  wallets?: MerchantWallet[];
}

export interface MerchantVerificationInput {
  merchantId: string;
  network: keyof typeof apiOrigins;
  receivingWallet: string;
  asset: string;
  apiKey: string;
  apiSecret: string;
}

export async function verifyMerchantConfiguration(
  input: MerchantVerificationInput,
  request: typeof fetch = fetch,
  createClient: (config: ConstructorParameters<typeof GoatFlowClient>[0]) => Pick<GoatFlowClient, "createOrder" | "cancelOrder"> = (config) => new GoatFlowClient(config),
) {
  if (!/^[a-zA-Z0-9_-]{2,100}$/.test(input.merchantId)) throw new Error("Merchant ID is invalid");
  if (!isAddress(input.receivingWallet)) throw new Error("Receiving wallet is invalid");
  const apiUrl = apiOrigins[input.network];
  const chainId = input.network === "goat-mainnet" ? 2345 : 48816;
  const response = await request(`${apiUrl}/merchants/${encodeURIComponent(input.merchantId)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Merchant configuration returned HTTP ${response.status}`);
  const merchant = await response.json() as MerchantResponse;
  if (merchant.merchant_id !== input.merchantId) throw new Error("Merchant response ID does not match");
  if (merchant.receive_type !== "DIRECT") throw new Error("Merchant must use DIRECT receive mode");
  const route = merchant.wallets?.find((wallet) =>
    wallet.chain_id === chainId &&
    wallet.token_symbol.toUpperCase() === input.asset.toUpperCase() &&
    wallet.address?.toLowerCase() === input.receivingWallet.toLowerCase() &&
    isAddress(wallet.token_contract),
  );
  if (!route) throw new Error("Merchant has no matching GOAT chain, token, and receiving wallet route");
  const client = createClient({ baseUrl: apiUrl, apiKey: input.apiKey, apiSecret: input.apiSecret });
  let testOrderId: string | undefined;
  try {
    const order = await client.createOrder({
      dappOrderId: `merchant_verify_${randomUUID().replaceAll("-", "")}`,
      chainId,
      tokenSymbol: route.token_symbol,
      tokenContract: route.token_contract,
      fromAddress: input.receivingWallet,
      amountWei: "1",
    });
    testOrderId = order.orderId;
    if (order.flow !== "ERC20_DIRECT") throw new Error("Authenticated merchant order is not DIRECT");
    if (order.payToAddress.toLowerCase() !== input.receivingWallet.toLowerCase()) {
      throw new Error("Authenticated merchant order settles to a different wallet");
    }
  } catch (error) {
    throw new Error(`Merchant credentials could not create a test order: ${error instanceof Error ? error.message : "authentication failed"}`);
  } finally {
    if (testOrderId) {
      try { await client.cancelOrder(testOrderId); } catch { /* Reconciliation can cancel an already-terminal test order. */ }
    }
  }
  return { apiUrl, receiveType: merchant.receive_type, supportedTokens: merchant.wallets ?? [], verifiedAt: new Date() };
}
