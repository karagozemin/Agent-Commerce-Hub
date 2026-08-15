import { Contract, formatUnits, type BrowserProvider, type JsonRpcSigner } from "ethers";
import { bufferedPaymentTarget, proportionalSwapInput } from "@/domain/payment-preparation";
import type { PaymentOrder } from "@/domain/types";

const goatMainnetChainId = 2345;
const wgbtcAddress = "0xbC10000000000000000000000000000000000000";
const usdcAddress = "0x3022b87ac063DE95b1570F46f5e470F8B53112D8";
const okuRouterAddress = "0xaa52bB8110fE38D0d2d2AF0B85C3A3eE622CA455";
const okuQuoterAddress = "0x5911cB3633e764939edc2d92b7e1ad375Bb57649";
const poolFee = 500;
const quoteSampleInput = 10_000_000_000_000n;

const quoterAbi = [
  "function quoteExactInputSingle((address,address,uint256,uint24,uint160)) returns (uint256,uint160,uint32,uint256)",
];
const routerAbi = [
  "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) payable returns (uint256)",
];

interface TrackedBalanceResponse {
  data?: { nativeBalance?: string; tokenBalance?: string };
  error?: string;
}

export interface BtcPreparationQuote {
  amountIn: bigint;
  currentUsdcBalance: bigint;
  deficit: bigint;
  estimatedGasLimit: bigint;
  expectedAmountOut: bigint;
  estimatedGasCost: bigint;
  gasPrice: bigint;
  nativeBalance: bigint;
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function swapParameters(recipient: string, amountIn: bigint, amountOutMinimum: bigint) {
  return [wgbtcAddress, usdcAddress, poolFee, recipient, amountIn, amountOutMinimum, 0] as const;
}

function assertSupportedOrder(order: PaymentOrder, walletAddress: string) {
  if (order.flow !== "QUICKPAY_PRODUCT" || order.chainId !== goatMainnetChainId) {
    throw new Error("BTC payment preparation is available only for GOAT Mainnet QuickPay");
  }
  if (!sameAddress(order.tokenContract, usdcAddress)) {
    throw new Error("BTC payment preparation supports the canonical GOAT USDC.e token only");
  }
  if (!sameAddress(order.fromAddress, walletAddress)) {
    throw new Error("Connected wallet does not match the payment order payer");
  }
}

async function quoteOutput(provider: BrowserProvider, amountIn: bigint) {
  const quoter = new Contract(okuQuoterAddress, quoterAbi, provider);
  const result = await quoter.quoteExactInputSingle.staticCall([
    wgbtcAddress,
    usdcAddress,
    amountIn,
    poolFee,
    0,
  ]) as [bigint, bigint, number, bigint];
  return result[0];
}

async function trackedBalances(walletAddress: string) {
  const response = await fetch(
    `/api/v1/chain/accounts/${encodeURIComponent(walletAddress)}/balances/${encodeURIComponent(usdcAddress)}`,
    { cache: "no-store", signal: AbortSignal.timeout(8_000) },
  );
  const body = await response.json() as TrackedBalanceResponse;
  if (!response.ok || !body.data?.nativeBalance || body.data.tokenBalance === undefined) {
    throw new Error(body.error ?? "Could not read current GOAT balances");
  }
  return {
    nativeBalance: BigInt(body.data.nativeBalance),
    tokenBalance: BigInt(body.data.tokenBalance),
  };
}

export async function quoteBtcPreparation(
  provider: BrowserProvider,
  signer: JsonRpcSigner,
  order: PaymentOrder,
): Promise<BtcPreparationQuote | null> {
  const walletAddress = await signer.getAddress();
  assertSupportedOrder(order, walletAddress);

  const balances = await trackedBalances(walletAddress);
  const currentUsdcBalance = balances.tokenBalance;
  const nativeBalance = balances.nativeBalance;
  const requiredAmount = BigInt(order.amountWei);
  if (currentUsdcBalance >= requiredAmount) return null;

  const deficit = requiredAmount - currentUsdcBalance;
  const targetOutput = bufferedPaymentTarget(deficit);
  const sampleOutput = await quoteOutput(provider, quoteSampleInput);
  let amountIn = proportionalSwapInput(quoteSampleInput, sampleOutput, targetOutput);
  let expectedAmountOut = await quoteOutput(provider, amountIn);

  for (let attempt = 0; expectedAmountOut < targetOutput && attempt < 3; attempt += 1) {
    amountIn = proportionalSwapInput(amountIn, expectedAmountOut, targetOutput) * 1_001n / 1_000n + 1n;
    expectedAmountOut = await quoteOutput(provider, amountIn);
  }
  if (expectedAmountOut < targetOutput) throw new Error("Could not quote enough USDC for this payment");

  const gasPriceValue = await provider.send("eth_gasPrice", []);
  if (typeof gasPriceValue !== "string") throw new Error("GOAT Mainnet returned an invalid gas price");
  const gasPrice = BigInt(gasPriceValue);
  if (gasPrice <= 0n) throw new Error("Could not estimate GOAT Mainnet gas price");

  // eth_estimateGas may reject an underfunded sender, so check a conservative ceiling first.
  const preliminaryGasCost = gasPrice * 400_000n;
  if (nativeBalance < amountIn + preliminaryGasCost) {
    throw new Error(
      `Insufficient native BTC: have ${formatUnits(nativeBalance, 18)}, need about ${formatUnits(amountIn + preliminaryGasCost, 18)} including gas`,
    );
  }

  const router = new Contract(okuRouterAddress, routerAbi, signer);
  const estimatedGas = await router.exactInputSingle.estimateGas(
    swapParameters(walletAddress, amountIn, deficit),
    { value: amountIn, gasPrice },
  ) as bigint;
  const estimatedGasLimit = estimatedGas * 125n / 100n;
  const estimatedGasCost = estimatedGasLimit * gasPrice;
  if (nativeBalance < amountIn + estimatedGasCost) {
    throw new Error(
      `Insufficient native BTC: have ${formatUnits(nativeBalance, 18)}, need about ${formatUnits(amountIn + estimatedGasCost, 18)} including gas`,
    );
  }

  return {
    amountIn,
    currentUsdcBalance,
    deficit,
    estimatedGasLimit,
    expectedAmountOut,
    estimatedGasCost,
    gasPrice,
    nativeBalance,
  };
}

export async function submitBtcPreparation(
  signer: JsonRpcSigner,
  order: PaymentOrder,
  quote: BtcPreparationQuote,
) {
  const walletAddress = await signer.getAddress();
  assertSupportedOrder(order, walletAddress);

  const router = new Contract(okuRouterAddress, routerAbi, signer);
  const transaction = await router.exactInputSingle(
    swapParameters(walletAddress, quote.amountIn, quote.deficit),
    {
      value: quote.amountIn,
      gasLimit: quote.estimatedGasLimit,
      gasPrice: quote.gasPrice,
    },
  );
  return transaction.hash as `0x${string}`;
}

interface TrackedTransactionResponse {
  data?: {
    state?: "pending" | "confirmed" | "failed";
    tokenBalance?: string;
  };
  error?: string;
}

export async function waitForBtcPreparation(hash: string, order: PaymentOrder, walletAddress: string) {
  assertSupportedOrder(order, walletAddress);
  const search = new URLSearchParams({ token: order.tokenContract, account: walletAddress });
  const deadline = Date.now() + 180_000;

  while (Date.now() < deadline) {
    const response = await fetch(`/api/v1/chain/transactions/${encodeURIComponent(hash)}?${search}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const body = await response.json() as TrackedTransactionResponse;
    if (response.ok && body.data?.state === "failed") throw new Error("BTC to USDC swap failed on-chain");
    if (response.ok && body.data?.state === "confirmed") {
      if (!body.data.tokenBalance || BigInt(body.data.tokenBalance) < BigInt(order.amountWei)) {
        throw new Error("Swap confirmed, but the USDC balance is still below the QuickPay amount");
      }
      return;
    }
    if (!response.ok && response.status < 500) throw new Error(body.error ?? "Could not track BTC swap");
    await new Promise((resolve) => window.setTimeout(resolve, 1_500));
  }
  throw new Error("The swap is still confirming. Check its existing transaction status; do not submit another swap");
}
