"use client";

import { useState } from "react";
import { GoatCheckout, type CheckoutResult } from "goatflow-checkout";
import { CheckCircle2, CircleDollarSign, Copy, LoaderCircle, Play, ShieldCheck, Wallet } from "lucide-react";
import type { InvocationRecord, ServiceManifest } from "@/domain/types";

const goatChainId = 2345;
const goatChainHex = "0x929";

interface InjectedProvider {
  isMetaMask?: boolean;
  providers?: InjectedProvider[];
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
}

interface AnnouncedProvider {
  info: { name: string; rdns: string };
  provider: InjectedProvider;
}

async function findMetaMaskProvider() {
  const injected = (window as typeof window & { ethereum?: InjectedProvider }).ethereum;
  const legacyMetaMask = injected?.providers?.find((provider) => provider.isMetaMask);

  return new Promise<InjectedProvider>((resolve, reject) => {
    let settled = false;
    const finish = (provider?: InjectedProvider) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("eip6963:announceProvider", onAnnouncement);
      if (provider) resolve(provider);
      else reject(new Error("Install MetaMask to make a mainnet payment"));
    };
    const onAnnouncement = (event: Event) => {
      const detail = (event as CustomEvent<AnnouncedProvider>).detail;
      if (detail?.info.rdns === "io.metamask") finish(detail.provider);
    };

    window.addEventListener("eip6963:announceProvider", onAnnouncement);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => finish(legacyMetaMask ?? (injected?.isMetaMask ? injected : undefined)), 150);
  });
}

function inputFor(service: ServiceManifest, value: string) {
  const keys: Record<string, string> = {
    "wallet-lens": "address",
    "tx-explain": "transactionHash",
    "contract-lens": "contractAddress",
    "repo-brief": "repositoryUrl",
  };
  return { [keys[service.slug]]: value };
}

function placeholderFor(slug: string) {
  if (slug === "repo-brief") return "https://github.com/owner/repository";
  if (slug === "tx-explain") return `0x${"a".repeat(64)}`;
  return `0x${"a".repeat(40)}`;
}

export function InvokePanel({ service }: { service: ServiceManifest }) {
  const [wallet, setWallet] = useState("");
  const [value, setValue] = useState(placeholderFor(service.slug));
  const [invocation, setInvocation] = useState<InvocationRecord>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [paymentPhase, setPaymentPhase] = useState<string>();
  const [connectedWallet, setConnectedWallet] = useState<string>();

  async function connectWallet() {
    const ethereum = await findMetaMaskProvider();
    const { BrowserProvider } = await import("ethers");
    let provider = new BrowserProvider(ethereum as ConstructorParameters<typeof BrowserProvider>[0]);
    let network = await provider.getNetwork();
    if (Number(network.chainId) !== goatChainId) {
      try {
        await provider.send("wallet_switchEthereumChain", [{ chainId: goatChainHex }]);
      } catch (cause) {
        const code = (cause as { code?: number | string }).code;
        if (code !== 4902 && code !== "NETWORK_ERROR") {
          throw new Error("Switch your wallet to GOAT Network Mainnet (chain 2345)");
        }
        if (code === 4902) {
          await provider.send("wallet_addEthereumChain", [{
            chainId: goatChainHex,
            chainName: "GOAT Network",
            nativeCurrency: { name: "GOAT", symbol: "GOAT", decimals: 18 },
            rpcUrls: ["https://rpc.goat.network"],
            blockExplorerUrls: ["https://explorer.goat.network"],
          }]);
        }
      }
      // A chain switch invalidates the BrowserProvider's cached network.
      provider = new BrowserProvider(ethereum as ConstructorParameters<typeof BrowserProvider>[0]);
      network = await provider.getNetwork();
    }
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setWallet(address);
    setConnectedWallet(address);
    return { provider, signer, address, network };
  }

  async function handleConnectWallet() {
    setBusy(true);
    setError(undefined);
    try {
      await connectWallet();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function invoke() {
    setBusy(true);
    setError(undefined);
    try {
      const buyerWallet = (await connectWallet()).address;
      const response = await fetch(`/api/v1/services/${service.slug}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ buyerWallet, input: inputFor(service, value) }),
      });
      const data = await response.json();
      if (response.status !== 402) throw new Error(data.error ?? "Invocation could not be created");
      setInvocation({ id: data.invocationId, status: data.status, paymentOrder: data.payment } as InvocationRecord);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invocation failed");
    } finally {
      setBusy(false);
    }
  }

  function openQuickPay(order: NonNullable<InvocationRecord["paymentOrder"]>) {
    const config = order.quickPay;
    if (!config) throw new Error("QuickPay checkout configuration is missing");

    return new Promise<CheckoutResult>((resolve, reject) => {
      const checkout = GoatCheckout({ origin: config.origin });
      checkout.open({
        merchant: config.merchantId,
        productKey: config.productKey,
        token: order.tokenSymbol,
        chain: order.chainId,
        clientReferenceId: config.clientReferenceId,
        display: "tab",
        onSuccess: resolve,
        onCancel: () => reject(new Error("Payment was cancelled")),
        onError: (reason) => reject(new Error(
          reason === "popup_blocked"
            ? "Allow popups for this site and try again"
            : reason === "opener_unavailable"
              ? "Checkout opened, but the browser disconnected its secure result channel. Do not pay twice; return after checking the existing payment"
              : "QuickPay checkout could not be completed",
        )),
      });
    });
  }

  async function reconcile(sessionId: string | undefined, attempts: number) {
    let response: Response | undefined;
    let body: { data?: InvocationRecord; error?: string } | undefined;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      response = await fetch(`/api/v1/invocations/${invocation?.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionId ? { sessionId } : {}),
      });
      body = await response.json();
      if (response.ok || response.status !== 409) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!response?.ok || !body?.data) throw new Error(body?.error ?? "Payment confirmation failed");
    setInvocation(body.data);
  }

  async function confirm() {
    if (!invocation) return;
    setBusy(true);
    setError(undefined);
    try {
      const order = invocation.paymentOrder;
      if (!order) throw new Error("Payment order is missing");
      if (order.flow === "QUICKPAY_PRODUCT") {
        setPaymentPhase("Opening secure checkout");
        const result = await openQuickPay(order);
        if (!result.session_id) throw new Error("QuickPay did not return a payment session ID");
        if (result.client_reference_id && result.client_reference_id !== order.quickPay?.clientReferenceId) {
          throw new Error("QuickPay result does not match this invocation");
        }
        setPaymentPhase("Verifying payment");
        await reconcile(result.session_id, 12);
      } else if (!order.simulation) {
        setPaymentPhase("Connecting wallet");
        const { signer, address, network } = await connectWallet();
        if (Number(network.chainId) !== order.chainId) throw new Error(`Switch your wallet to chain ${order.chainId}`);
        if (address.toLowerCase() !== order.fromAddress.toLowerCase()) {
          throw new Error("MetaMask account changed after order creation. Connect the payer account and request a new invocation");
        }
        if (Math.floor(Date.now() / 1000) >= order.expiresAt) {
          throw new Error("Payment order expired; request a new invocation");
        }
        setPaymentPhase("Waiting for wallet approval");
        const { PaymentHelper } = await import("goatflow-sdk");
        const result = await new PaymentHelper(signer).pay({ ...order, flow: "ERC20_DIRECT" });
        if (!result.success || !result.txHash) {
          throw new Error(result.error ?? "Wallet payment failed");
        }
        setPaymentPhase("Reconciling payment");
        await reconcile(undefined, 8);
      } else {
        await reconcile(undefined, 1);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Confirmation failed");
    } finally {
      setBusy(false);
      setPaymentPhase(undefined);
    }
  }

  return (
    <aside className="panel p-5 lg:sticky lg:top-5">
      <div className="mb-5 flex items-center justify-between border-b border-(--line) pb-4">
        <div><span className="text-xs text-(--muted)">Price per call</span><strong className="block text-2xl">${service.pricing.amount} <small className="text-sm">{service.pricing.asset}</small></strong></div>
        <span className="rounded bg-(--green-soft) px-2 py-1 text-xs font-bold text-(--green)">x402 DIRECT</span>
      </div>

      {!invocation && <div className="space-y-4">
        <label className="block text-sm font-bold">Buyer wallet<input className="field mt-2 font-mono text-xs" readOnly value={wallet} placeholder="Connect MetaMask to select payer" /></label>
        <button className="button-secondary w-full" disabled={busy} onClick={handleConnectWallet}><Wallet size={16} />{connectedWallet ? `Connected: ${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}` : "Connect wallet"}</button>
        <label className="block text-sm font-bold">Service input<textarea className="field mt-2 min-h-24 resize-y font-mono text-xs" value={value} onChange={(event) => setValue(event.target.value)} /></label>
        <button className="button-primary w-full" disabled={busy} onClick={invoke}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Play size={17} />} Request invocation</button>
        <p className="flex gap-2 text-xs leading-5 text-(--muted)"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-(--green)" /> Fulfillment begins only after trusted backend payment confirmation.</p>
      </div>}

      {invocation?.status === "PAYMENT_REQUIRED" && <div>
        <div className="mb-4 rounded-[5px] border border-[#e8cfaa] bg-[#fff8eb] p-4">
          <div className="mb-2 flex items-center gap-2 font-bold text-(--amber)"><CircleDollarSign size={18} /> 402 Payment Required</div>
          <dl className="grid grid-cols-[90px_1fr] gap-y-2 text-xs">
            <dt className="text-(--muted)">Recipient</dt><dd className="truncate font-mono">{invocation.paymentOrder?.payToAddress}</dd>
            <dt className="text-(--muted)">Amount</dt><dd>{service.pricing.amount} {service.pricing.asset}</dd>
            <dt className="text-(--muted)">Network</dt><dd>{invocation.paymentOrder?.simulation ? "GOAT Testnet simulation" : `Chain ${invocation.paymentOrder?.chainId}`}</dd>
            {invocation.paymentOrder?.flow === "QUICKPAY_PRODUCT" && <><dt className="text-(--muted)">Checkout</dt><dd>GOAT QuickPay</dd></>}
          </dl>
        </div>
        <button className="button-primary w-full" disabled={busy} onClick={confirm}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <CircleDollarSign size={17} />} {paymentPhase ?? (invocation.paymentOrder?.simulation ? "Simulate payment" : invocation.paymentOrder?.flow === "QUICKPAY_PRODUCT" ? "Open QuickPay checkout" : "Pay and execute")}</button>
      </div>}

      {invocation?.status === "SUCCEEDED" && <div>
        <div className="mb-4 flex items-center gap-3 border-b border-(--line) pb-4 text-(--green)"><CheckCircle2 size={22} /><div><strong className="block">Invocation succeeded</strong><span className="text-xs">Payment verified, result delivered</span></div></div>
        <p className="mb-2 text-xs font-bold text-(--muted)">Result</p>
        <pre className="max-h-64 overflow-auto rounded-[5px] bg-[#151a17] p-4 text-xs leading-5 text-[#d9e7dd]">{JSON.stringify(invocation.output, null, 2)}</pre>
        <div className="mt-4 flex items-center justify-between text-xs"><span className="font-mono text-(--muted)">{invocation.id.slice(0, 18)}...</span><button className="icon-button size-8! min-h-8!" title="Copy receipt" onClick={() => navigator.clipboard.writeText(JSON.stringify(invocation.receipt))}><Copy size={14} /></button></div>
      </div>}
      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </aside>
  );
}
