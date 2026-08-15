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

const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
const quoterAbi = [
  "function quoteExactInputSingle((address,address,uint256,uint24,uint160)) returns (uint256,uint160,uint32,uint256)",
];
const routerAbi = [
  "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) payable returns (uint256)",
];

export interface BtcPreparationQuote {
  amountIn: bigint;
  currentUsdcBalance: bigint;
  deficit: bigint;
  expectedAmountOut: bigint;
  estimatedGasCost: bigint;
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

export async function quoteBtcPreparation(
  provider: BrowserProvider,
  signer: JsonRpcSigner,
  order: PaymentOrder,
): Promise<BtcPreparationQuote | null> {
  const walletAddress = await signer.getAddress();
  assertSupportedOrder(order, walletAddress);

  const usdc = new Contract(usdcAddress, erc20Abi, provider);
  const [currentUsdcBalance, nativeBalance] = await Promise.all([
    usdc.balanceOf(walletAddress) as Promise<bigint>,
    provider.getBalance(walletAddress),
  ]);
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

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
  if (!gasPrice || gasPrice <= 0n) throw new Error("Could not estimate GOAT Mainnet gas price");

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
    { value: amountIn },
  ) as bigint;
  const estimatedGasCost = estimatedGas * gasPrice * 125n / 100n;
  if (nativeBalance < amountIn + estimatedGasCost) {
    throw new Error(
      `Insufficient native BTC: have ${formatUnits(nativeBalance, 18)}, need about ${formatUnits(amountIn + estimatedGasCost, 18)} including gas`,
    );
  }

  return { amountIn, currentUsdcBalance, deficit, expectedAmountOut, estimatedGasCost, nativeBalance };
}

export async function executeBtcPreparation(
  provider: BrowserProvider,
  signer: JsonRpcSigner,
  order: PaymentOrder,
  quote: BtcPreparationQuote,
) {
  const walletAddress = await signer.getAddress();
  assertSupportedOrder(order, walletAddress);

  const router = new Contract(okuRouterAddress, routerAbi, signer);
  const transaction = await router.exactInputSingle(
    swapParameters(walletAddress, quote.amountIn, quote.deficit),
    { value: quote.amountIn },
  );
  const receipt = await transaction.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error("BTC to USDC swap failed");

  const usdc = new Contract(usdcAddress, erc20Abi, provider);
  const balance = await usdc.balanceOf(walletAddress) as bigint;
  if (balance < BigInt(order.amountWei)) {
    throw new Error("Swap confirmed, but the USDC balance is still below the QuickPay amount");
  }
  return receipt.hash as `0x${string}`;
}
