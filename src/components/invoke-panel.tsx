"use client";

import { useState } from "react";
import { CheckCircle2, CircleDollarSign, Copy, LoaderCircle, Play, ShieldCheck } from "lucide-react";
import type { InvocationRecord, ServiceManifest } from "@/domain/types";

const demoWallet = "0x12a000000000000000000000000000000000009a";

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
  const [wallet, setWallet] = useState(demoWallet);
  const [value, setValue] = useState(placeholderFor(service.slug));
  const [invocation, setInvocation] = useState<InvocationRecord>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [paymentPhase, setPaymentPhase] = useState<string>();

  async function connectWallet() {
    const ethereum = (window as typeof window & { ethereum?: unknown }).ethereum;
    if (!ethereum) throw new Error("Install an EVM wallet to make a mainnet payment");
    const { BrowserProvider } = await import("ethers");
    const provider = new BrowserProvider(ethereum as ConstructorParameters<typeof BrowserProvider>[0]);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setWallet(address);
    return { provider, signer, address };
  }

  async function invoke() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/v1/services/${service.slug}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ buyerWallet: wallet, input: inputFor(service, value) }),
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

  async function confirm() {
    if (!invocation) return;
    setBusy(true);
    setError(undefined);
    try {
      const order = invocation.paymentOrder;
      if (!order) throw new Error("Payment order is missing");
      if (!order.simulation) {
        setPaymentPhase("Connecting wallet");
        const { provider, signer, address } = await connectWallet();
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== order.chainId) {
          throw new Error(`Switch your wallet to chain ${order.chainId}`);
        }
        if (address.toLowerCase() !== order.fromAddress.toLowerCase()) {
          throw new Error("Connected wallet does not match the payment order payer");
        }
        if (Math.floor(Date.now() / 1000) >= order.expiresAt) {
          throw new Error("Payment order expired; request a new invocation");
        }
        setPaymentPhase("Waiting for wallet approval");
        const { PaymentHelper } = await import("goatflow-sdk");
        const result = await new PaymentHelper(signer).pay(order);
        if (!result.success || !result.txHash) {
          throw new Error(result.error ?? "Wallet payment failed");
        }
        setPaymentPhase("Reconciling payment");
      }

      let response: Response | undefined;
      let body: { data?: InvocationRecord; error?: string } | undefined;
      const attempts = order.simulation ? 1 : 8;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        response = await fetch(`/api/v1/invocations/${invocation.id}/confirm`, { method: "POST" });
        body = await response.json();
        if (response.ok || response.status !== 409) break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!response?.ok || !body?.data) throw new Error(body?.error ?? "Payment confirmation failed");
      setInvocation(body.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Confirmation failed");
    } finally {
      setBusy(false);
      setPaymentPhase(undefined);
    }
  }

  return (
    <aside className="panel p-5 lg:sticky lg:top-5">
      <div className="mb-5 flex items-center justify-between border-b border-[var(--line)] pb-4">
        <div><span className="text-xs text-[var(--muted)]">Price per call</span><strong className="block text-2xl">${service.pricing.amount} <small className="text-sm">{service.pricing.asset}</small></strong></div>
        <span className="rounded-[4px] bg-[var(--green-soft)] px-2 py-1 text-xs font-bold text-[var(--green)]">x402 DIRECT</span>
      </div>

      {!invocation && <div className="space-y-4">
        <label className="block text-sm font-bold">Buyer wallet<input className="field mt-2 font-mono text-xs" value={wallet} onChange={(event) => setWallet(event.target.value)} /></label>
        <label className="block text-sm font-bold">Service input<textarea className="field mt-2 min-h-24 resize-y font-mono text-xs" value={value} onChange={(event) => setValue(event.target.value)} /></label>
        <button className="button-primary w-full" disabled={busy} onClick={invoke}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Play size={17} />} Request invocation</button>
        <p className="flex gap-2 text-xs leading-5 text-[var(--muted)]"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--green)]" /> Fulfillment begins only after trusted backend payment confirmation.</p>
      </div>}

      {invocation?.status === "PAYMENT_REQUIRED" && <div>
        <div className="mb-4 rounded-[5px] border border-[#e8cfaa] bg-[#fff8eb] p-4">
          <div className="mb-2 flex items-center gap-2 font-bold text-[var(--amber)]"><CircleDollarSign size={18} /> 402 Payment Required</div>
          <dl className="grid grid-cols-[90px_1fr] gap-y-2 text-xs">
            <dt className="text-[var(--muted)]">Recipient</dt><dd className="truncate font-mono">{invocation.paymentOrder?.payToAddress}</dd>
            <dt className="text-[var(--muted)]">Amount</dt><dd>{service.pricing.amount} {service.pricing.asset}</dd>
            <dt className="text-[var(--muted)]">Network</dt><dd>{invocation.paymentOrder?.simulation ? "GOAT Testnet simulation" : `Chain ${invocation.paymentOrder?.chainId}`}</dd>
          </dl>
        </div>
        <button className="button-primary w-full" disabled={busy} onClick={confirm}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <CircleDollarSign size={17} />} {paymentPhase ?? (invocation.paymentOrder?.simulation ? "Simulate payment" : "Pay and execute")}</button>
      </div>}

      {invocation?.status === "SUCCEEDED" && <div>
        <div className="mb-4 flex items-center gap-3 border-b border-[var(--line)] pb-4 text-[var(--green)]"><CheckCircle2 size={22} /><div><strong className="block">Invocation succeeded</strong><span className="text-xs">Payment verified, result delivered</span></div></div>
        <p className="mb-2 text-xs font-bold text-[var(--muted)]">Result</p>
        <pre className="max-h-64 overflow-auto rounded-[5px] bg-[#151a17] p-4 text-xs leading-5 text-[#d9e7dd]">{JSON.stringify(invocation.output, null, 2)}</pre>
        <div className="mt-4 flex items-center justify-between text-xs"><span className="font-mono text-[var(--muted)]">{invocation.id.slice(0, 18)}...</span><button className="icon-button !size-8 !min-h-8" title="Copy receipt" onClick={() => navigator.clipboard.writeText(JSON.stringify(invocation.receipt))}><Copy size={14} /></button></div>
      </div>}
      {error && <p className="mt-4 rounded-[4px] bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </aside>
  );
}
