import { parseUnits } from "ethers";
import { isAddress, isHash } from "viem";
import { env } from "@/config/env";
import type { PaymentOrder, PaymentProof, ServiceManifest } from "@/domain/types";
import type { CreatePaymentInput, PaymentConfirmation, PaymentProvider } from "./provider";

interface QuickPayManifest {
  merchant?: { merchant_id?: unknown };
  rails?: {
    x402?: {
      enabled?: unknown;
      tokens?: unknown;
      products?: unknown;
    };
  };
}

interface QuickPaySessionSnapshot {
  session_id?: unknown;
  order_id?: unknown;
  status?: unknown;
  tx_hash?: unknown;
  merchant_id?: unknown;
  payer_addr?: unknown;
  chain_id?: unknown;
  token_contract?: unknown;
  amount_wei?: unknown;
  product_key?: unknown;
  client_reference_id?: unknown;
  idempotency_key?: unknown;
}

interface ManifestToken {
  chain_id: number;
  token_symbol: string;
  token_contract: string;
  decimals: number;
}

interface ManifestProduct {
  product_key: string;
  price: string;
}

const sessionIdPattern = /^[A-Za-z0-9._:-]{1,200}$/;

function normalizedOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("GOAT QuickPay origin must be a bare HTTPS origin");
  }
  return url.origin;
}

async function getJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.url && new URL(response.url).origin !== new URL(url).origin) {
    throw new Error("GOAT QuickPay request redirected off the trusted origin");
  }
  if (!response.ok) throw new Error(`GOAT QuickPay request failed with HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function manifestToken(value: unknown): value is ManifestToken {
  if (!value || typeof value !== "object") return false;
  const token = value as Record<string, unknown>;
  return Number.isInteger(token.chain_id)
    && typeof token.token_symbol === "string"
    && typeof token.token_contract === "string"
    && isAddress(token.token_contract)
    && Number.isInteger(token.decimals)
    && Number(token.decimals) >= 0;
}

function manifestProduct(value: unknown): value is ManifestProduct {
  if (!value || typeof value !== "object") return false;
  const product = value as Record<string, unknown>;
  return typeof product.product_key === "string" && typeof product.price === "string";
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

export function isQuickPayProductService(service: ServiceManifest) {
  return !service.sellerId && service.slug === "wallet-lens" && service.network === "goat-mainnet";
}

export class QuickPayProductPaymentProvider implements PaymentProvider {
  private readonly origin = normalizedOrigin(env.GOAT_QUICKPAY_ORIGIN);

  constructor(
    private readonly orderVerifier: PaymentProvider,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async createOrder({ invocationId, buyerWallet, service }: CreatePaymentInput): Promise<PaymentOrder> {
    if (!isQuickPayProductService(service)) throw new Error("Service is not configured as a QuickPay product");

    const manifest = await getJson<QuickPayManifest>(
      `${this.origin}/quickpay/${encodeURIComponent(env.GOAT_QUICKPAY_MERCHANT_ID)}/manifest.json`,
      this.fetchImpl,
    );
    if (manifest.merchant?.merchant_id !== env.GOAT_QUICKPAY_MERCHANT_ID) {
      throw new Error("GOAT QuickPay manifest merchant does not match configuration");
    }
    if (manifest.rails?.x402?.enabled !== true) throw new Error("GOAT QuickPay x402 is not enabled");

    const products = Array.isArray(manifest.rails.x402.products) ? manifest.rails.x402.products.filter(manifestProduct) : [];
    const product = products.find((entry) => entry.product_key === env.GOAT_QUICKPAY_PRODUCT_KEY);
    if (!product) throw new Error("Wallet Analysis QuickPay product is not live");

    const chainId = 2345;
    const tokens = Array.isArray(manifest.rails.x402.tokens) ? manifest.rails.x402.tokens.filter(manifestToken) : [];
    const token = tokens.find((entry) => entry.chain_id === chainId && entry.token_symbol.toUpperCase() === service.pricing.asset.toUpperCase());
    if (!token) throw new Error("Wallet Analysis QuickPay token route is not live");

    let manifestAmountWei: string;
    try {
      manifestAmountWei = parseUnits(product.price, token.decimals).toString();
    } catch {
      throw new Error("Wallet Analysis QuickPay product price is invalid");
    }
    if (manifestAmountWei !== service.pricing.amountWei) {
      throw new Error("Wallet Analysis price does not match the live QuickPay product");
    }

    return {
      orderId: `quickpay_intent_${invocationId}`,
      flow: "QUICKPAY_PRODUCT",
      tokenSymbol: token.token_symbol,
      tokenContract: token.token_contract as `0x${string}`,
      fromAddress: buyerWallet,
      payToAddress: service.sellerWallet,
      chainId,
      amountWei: manifestAmountWei,
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
      quickPay: {
        origin: this.origin,
        merchantId: env.GOAT_QUICKPAY_MERCHANT_ID,
        productKey: env.GOAT_QUICKPAY_PRODUCT_KEY,
        clientReferenceId: invocationId,
        idempotencyKey: invocationId,
      },
    };
  }

  async confirmOrder(order: PaymentOrder, service: ServiceManifest, confirmation?: PaymentConfirmation): Promise<PaymentProof> {
    if (order.flow !== "QUICKPAY_PRODUCT" || !order.quickPay) throw new Error("QuickPay product order is invalid");
    const sessionId = confirmation?.sessionId;
    if (!sessionId || !sessionIdPattern.test(sessionId)) throw new Error("A valid QuickPay session ID is required");

    const snapshot = await getJson<QuickPaySessionSnapshot>(
      `${this.origin}/quickpay/v1/x402/sessions/${encodeURIComponent(sessionId)}`,
      this.fetchImpl,
    );
    const snapshotSessionId = optionalString(snapshot.session_id);
    if (snapshotSessionId && snapshotSessionId !== sessionId) throw new Error("QuickPay session response does not match the requested session");
    if (snapshot.status !== "PAYMENT_CONFIRMED") {
      throw new Error(`Payment is not confirmed: ${optionalString(snapshot.status) ?? "UNKNOWN"}`);
    }

    const orderId = optionalString(snapshot.order_id);
    const txHash = optionalString(snapshot.tx_hash);
    if (!orderId) throw new Error("Confirmed QuickPay session is missing its order ID");
    if (!txHash || !isHash(txHash)) throw new Error("Confirmed QuickPay session is missing a valid transaction hash");
    const snapshotProductKey = optionalString(snapshot.product_key);
    if (snapshotProductKey && snapshotProductKey !== order.quickPay.productKey) {
      throw new Error("QuickPay product does not match the invocation");
    }
    if (snapshot.merchant_id !== undefined && snapshot.merchant_id !== order.quickPay.merchantId) {
      throw new Error("QuickPay merchant does not match the invocation");
    }
    const snapshotReference = optionalString(snapshot.client_reference_id);
    const snapshotIdempotencyKey = optionalString(snapshot.idempotency_key);
    if (snapshotReference && snapshotReference !== order.quickPay.clientReferenceId) {
      throw new Error("QuickPay session is not correlated to this invocation");
    }
    if (snapshotIdempotencyKey && snapshotIdempotencyKey !== order.quickPay.idempotencyKey) {
      throw new Error("QuickPay session is not correlated to this invocation");
    }
    if (optionalString(snapshot.amount_wei) && snapshot.amount_wei !== order.amountWei) {
      throw new Error("QuickPay amount does not match the invocation");
    }
    if (snapshot.chain_id !== undefined && Number(snapshot.chain_id) !== order.chainId) {
      throw new Error("QuickPay chain does not match the invocation");
    }
    if (optionalString(snapshot.token_contract) && !sameAddress(String(snapshot.token_contract), order.tokenContract)) {
      throw new Error("QuickPay token does not match the invocation");
    }

    const proof = await this.orderVerifier.confirmOrder({ ...order, orderId, flow: "ERC20_DIRECT" }, service);
    if (proof.txHash.toLowerCase() !== txHash.toLowerCase()) throw new Error("QuickPay transaction hash does not match the merchant order proof");
    if (proof.dappOrderId !== `quickpay:${sessionId}`) {
      throw new Error("Merchant order proof does not match the QuickPay session");
    }
    if (optionalString(snapshot.amount_wei) && snapshot.amount_wei !== proof.amountWei) {
      throw new Error("QuickPay amount does not match the merchant order proof");
    }
    if (optionalString(snapshot.payer_addr) && !sameAddress(String(snapshot.payer_addr), proof.fromAddress)) {
      throw new Error("QuickPay payer does not match the merchant order proof");
    }
    if (snapshot.chain_id !== undefined && Number(snapshot.chain_id) !== proof.chainId) {
      throw new Error("QuickPay chain does not match the merchant order proof");
    }
    if (optionalString(snapshot.token_contract) && !sameAddress(String(snapshot.token_contract), proof.tokenContract)) {
      throw new Error("QuickPay token does not match the merchant order proof");
    }

    return {
      ...proof,
      paymentSessionId: sessionId,
      clientReferenceId: snapshotReference,
      idempotencyKey: snapshotIdempotencyKey,
      productKey: order.quickPay.productKey,
    };
  }
}
