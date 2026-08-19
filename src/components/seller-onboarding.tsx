"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, CheckCircle2, ChevronDown, CircleDollarSign, CloudUpload, LoaderCircle, LogOut, Plug, RefreshCw, ServerCog, ShieldCheck, Wallet } from "lucide-react";

interface Workspace {
  profile?: { id: string; displayName: string };
  merchantConfigured?: boolean;
  services: Array<{ id: string; name: string; slug: string; status: string; price: string; asset: string; healthStatus: string; identityVerified: boolean; identityLinked: boolean; merchantVerified: boolean; endpointLatencyMs?: number | null; endpointLastError?: string | null }>;
}

interface EthereumWindow extends Window { ethereum?: unknown }

const defaultInputSchema = JSON.stringify({
  type: "object",
  required: ["query"],
  properties: { query: { type: "string" } },
}, null, 2);

const defaultOutputSchema = JSON.stringify({
  type: "object",
  properties: { result: { type: "string" } },
}, null, 2);

export function SellerOnboarding() {
  const [walletAddress, setWalletAddress] = useState<string>();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Developer Tools",
    endpoint: "https://",
    price: "0.10",
    receivingWallet: "",
    network: "goat-testnet",
    inputSchema: defaultInputSchema,
    outputSchema: defaultOutputSchema,
    testInput: JSON.stringify({ query: "Summarize GOAT agent commerce" }, null, 2),
    agentId: "",
    agentUri: "",
  });
  const [merchant, setMerchant] = useState({ merchantId: "", apiKey: "", apiSecret: "", network: "goat-testnet" });

  useEffect(() => {
    void (async () => {
      const sessionResponse = await fetch("/api/v1/auth/session");
      if (!sessionResponse.ok) return;
      const sessionBody = await sessionResponse.json();
      const address = sessionBody.data.walletAddress;
      setWalletAddress(address);
      setForm((current) => ({ ...current, receivingWallet: address }));
      const workspaceResponse = await fetch("/api/v1/seller/services");
      if (workspaceResponse.ok) setWorkspace((await workspaceResponse.json()).data);
    })();
  }, []);

  async function loadWorkspace() {
    const response = await fetch("/api/v1/seller/services");
    if (response.ok) setWorkspace((await response.json()).data);
  }

  async function signIn() {
    setBusy(true); setError(undefined); setNotice(undefined);
    try {
      const ethereum = (window as EthereumWindow).ethereum;
      if (!ethereum) throw new Error("Install an EVM wallet to continue");
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(ethereum as ConstructorParameters<typeof BrowserProvider>[0]);
      const signer = await provider.getSigner();
      const wallet = await signer.getAddress();
      const chainId = Number((await provider.getNetwork()).chainId);
      const nonceResponse = await fetch("/api/v1/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: wallet, chainId }),
      });
      const nonceBody = await nonceResponse.json();
      if (!nonceResponse.ok) throw new Error(nonceBody.error);
      const signature = await signer.signMessage(nonceBody.data.message);
      const verifyResponse = await fetch("/api/v1/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: nonceBody.data.challengeId,
          walletAddress: wallet,
          message: nonceBody.data.message,
          signature,
        }),
      });
      const verifyBody = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(verifyBody.error);
      setWalletAddress(wallet.toLowerCase());
      setForm((current) => ({ ...current, receivingWallet: wallet.toLowerCase() }));
      await loadWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Wallet sign-in failed"); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    setWalletAddress(undefined); setWorkspace(undefined); setNotice(undefined);
  }

  async function createProfile(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(undefined);
    try {
      const response = await fetch("/api/v1/seller/profile", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await loadWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Profile creation failed"); }
    finally { setBusy(false); }
  }

  async function createService(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(undefined); setNotice(undefined);
    try {
      const response = await fetch("/api/v1/seller/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          receivingWallet: walletAddress,
          inputSchema: JSON.parse(form.inputSchema),
          outputSchema: JSON.parse(form.outputSchema),
          testInput: JSON.parse(form.testInput),
          agentId: form.agentId || undefined,
          agentUri: form.agentUri || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setNotice(`${body.data.name} saved as a draft. Endpoint and identity verification are required before publishing.`);
      setForm((current) => ({ ...current, name: "", description: "" }));
      await loadWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Service creation failed"); }
    finally { setBusy(false); }
  }

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function runServiceAction(serviceId: string, action: "verify-endpoint" | "verify-identity" | "publish") {
    setBusy(true); setError(undefined); setNotice(undefined);
    try {
      const response = await fetch(`/api/v1/seller/services/${serviceId}/${action}`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setNotice(action === "publish" ? "Service published to the marketplace." : "Verification completed successfully.");
      await loadWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Service action failed"); }
    finally { setBusy(false); }
  }

  async function configureMerchant(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(undefined); setNotice(undefined);
    try {
      const response = await fetch("/api/v1/seller/merchant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(merchant) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMerchant((current) => ({ ...current, apiKey: "", apiSecret: "" }));
      setNotice("GOAT Flow DIRECT merchant route verified. Credentials are encrypted at rest.");
      await loadWorkspace();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Merchant configuration failed"); }
    finally { setBusy(false); }
  }

  if (!walletAddress) return <section className="panel max-w-2xl p-6 md:p-8"><Wallet size={28} className="mb-5 text-[var(--green)]"/><h2 className="text-2xl font-bold">Authenticate with your wallet</h2><p className="mt-3 max-w-xl leading-7 text-[var(--muted)]">Sign a short-lived nonce to create a secure seller session. This does not submit a transaction or request token approval.</p><button className="button-primary mt-6" disabled={busy} onClick={signIn}>{busy ? <LoaderCircle className="animate-spin" size={17}/> : <Wallet size={17}/>} Connect and sign in</button>{error && <ErrorBox message={error}/>}</section>;

  if (!workspace?.profile) return <section className="panel max-w-2xl p-6 md:p-8"><div className="mb-6 flex items-start justify-between gap-4"><div><p className="eyebrow mb-2">Authenticated wallet</p><p className="font-mono text-xs text-[var(--muted)]">{walletAddress}</p></div><button className="icon-button" title="Sign out" onClick={logout}><LogOut size={16}/></button></div><h2 className="text-2xl font-bold">Create seller profile</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">This public name appears beside every service you publish.</p><form className="mt-6" onSubmit={createProfile}><label className="block text-sm font-bold">Display name<input className="field mt-2" required minLength={2} maxLength={60} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Example Labs"/></label><button className="button-primary mt-5" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={17}/> : <BadgeCheck size={17}/>} Create profile</button></form>{error && <ErrorBox message={error}/>}</section>;

  return <div className="grid items-start gap-7 lg:grid-cols-[1fr_330px]">
    <form className="panel p-6" onSubmit={createService}>
      <div className="mb-6 border-b border-[var(--line)] pb-5"><p className="eyebrow mb-2">Seller: {workspace.profile.displayName}</p><h2 className="text-2xl font-bold">New service draft</h2></div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Service name"><input className="field" required minLength={2} maxLength={80} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Contract Risk Analyzer"/></Field>
        <Field label="Category"><select className="field" value={form.category} onChange={(e) => update("category", e.target.value)}><option>Developer Tools</option><option>Research & Data</option><option>Agent Operations</option><option>GOAT Native</option></select></Field>
        <div className="md:col-span-2"><Field label="Description"><textarea className="field min-h-24 resize-y" required minLength={20} maxLength={500} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Describe the useful outcome a buyer receives."/></Field></div>
        <div className="md:col-span-2"><Field label="HTTPS endpoint"><input className="field font-mono text-xs" required value={form.endpoint} onChange={(e) => update("endpoint", e.target.value)} placeholder="https://api.example.com/v1/analyze"/></Field></div>
        <Field label="Price per invocation"><div className="control-with-leading-icon"><CircleDollarSign size={16} aria-hidden="true"/><input required value={form.price} onChange={(e) => update("price", e.target.value)} inputMode="decimal" aria-label="Price per invocation in USDC"/></div></Field>
        <Field label="Network"><select className="field" value={form.network} onChange={(e) => update("network", e.target.value)}><option value="goat-testnet">GOAT Testnet3</option><option value="goat-mainnet">GOAT Mainnet</option></select></Field>
        <div className="md:col-span-2"><Field label="Receiving wallet"><input className="field font-mono text-xs" readOnly value={walletAddress}/><span className="mt-2 block text-xs font-normal leading-5 text-[var(--muted)]">Payments are locked to the wallet that signed this seller session.</span></Field></div>
        <Field label="ERC-8004 agent ID"><input className="field" required inputMode="numeric" pattern="[0-9]+" value={form.agentId} onChange={(e) => update("agentId", e.target.value)} placeholder="184"/></Field>
        <Field label="Agent URI"><input className="field" required type="url" value={form.agentUri} onChange={(e) => update("agentUri", e.target.value)} placeholder="https://example.com/agent.json"/></Field>
        <p className="md:col-span-2 -mt-2 text-xs leading-5 text-[var(--muted)]">Both values are checked against the ERC-8004 registry before the service can be published.</p>
        <details className="advanced-settings md:col-span-2">
          <summary><span>Advanced request configuration <small className="ml-2 font-normal text-[var(--muted)]">JSON Schema</small></span><ChevronDown size={17}/></summary>
          <div className="grid gap-5 border-t border-[var(--line)] p-4 md:grid-cols-2">
            <p className="md:col-span-2 text-xs leading-5 text-[var(--muted)]">These contracts define what the service accepts and returns. Invalid JSON, incompatible test data, or a mismatched endpoint response blocks verification.</p>
            <Field label="Input schema"><textarea className="field min-h-44 resize-y font-mono text-xs" required spellCheck={false} value={form.inputSchema} onChange={(e) => update("inputSchema", e.target.value)}/></Field>
            <Field label="Output schema"><textarea className="field min-h-44 resize-y font-mono text-xs" required spellCheck={false} value={form.outputSchema} onChange={(e) => update("outputSchema", e.target.value)}/></Field>
            <div className="md:col-span-2"><Field label="Endpoint test input"><textarea className="field min-h-28 resize-y font-mono text-xs" required spellCheck={false} value={form.testInput} onChange={(e) => update("testInput", e.target.value)}/></Field></div>
          </div>
        </details>
      </div>
      <button className="button-primary mt-6" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={17}/> : <ServerCog size={17}/>} Save draft</button>
      {notice && <p className="mt-5 flex gap-2 rounded-[5px] bg-[var(--green-soft)] p-4 text-sm leading-6 text-[var(--green)]"><CheckCircle2 className="mt-0.5 shrink-0" size={17}/>{notice}</p>}
      {error && <ErrorBox message={error}/>} 
    </form>
    <aside className="space-y-4 lg:sticky lg:top-5"><div className="panel p-5"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow mb-1">Workspace</p><strong>{workspace.profile.displayName}</strong></div><button className="icon-button" title="Sign out" onClick={logout}><LogOut size={16}/></button></div><p className="truncate font-mono text-xs text-[var(--muted)]">{walletAddress}</p></div><form className="panel p-5" onSubmit={configureMerchant}><h3 className="mb-4 flex items-center gap-2 font-bold"><CircleDollarSign size={17}/> GOAT Flow</h3>{workspace.merchantConfigured ? <p className="flex items-center gap-2 text-sm font-bold text-[var(--green)]"><CheckCircle2 size={16}/> DIRECT merchant verified</p> : <div className="space-y-3"><input className="field" required value={merchant.merchantId} onChange={(e) => setMerchant((current) => ({ ...current, merchantId: e.target.value }))} placeholder="Merchant ID"/><input className="field" required type="password" autoComplete="off" value={merchant.apiKey} onChange={(e) => setMerchant((current) => ({ ...current, apiKey: e.target.value }))} placeholder="API key"/><input className="field" required type="password" autoComplete="off" value={merchant.apiSecret} onChange={(e) => setMerchant((current) => ({ ...current, apiSecret: e.target.value }))} placeholder="API secret"/><select className="field" value={merchant.network} onChange={(e) => setMerchant((current) => ({ ...current, network: e.target.value }))}><option value="goat-testnet">GOAT Testnet3</option><option value="goat-mainnet">GOAT Mainnet</option></select><button className="button-secondary w-full" disabled={busy}><ShieldCheck size={15}/> Verify payment route</button></div>}</form><div className="panel p-5"><h3 className="mb-4 flex items-center gap-2 font-bold"><Plug size={17}/> Services</h3>{workspace.services.length === 0 ? <p className="text-sm leading-6 text-[var(--muted)]">No drafts yet.</p> : <div className="space-y-5">{workspace.services.map((service) => <div key={service.id} className="border-t border-[var(--line)] pt-4 first:border-0 first:pt-0"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{service.name}</strong><span className={`rounded-[4px] px-2 py-1 text-xs font-bold ${service.status === "published" ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[#fff8eb] text-[var(--amber)]"}`}>{service.status}</span></div><p className="mt-1 text-xs text-[var(--muted)]">${service.price} {service.asset} · /{service.slug}</p><div className="mt-3 grid gap-2"><button className="button-secondary !min-h-9 !justify-start text-xs" disabled={busy || service.status === "published"} onClick={() => runServiceAction(service.id, "verify-endpoint")}><RefreshCw size={14}/> {service.healthStatus === "online" ? `Endpoint verified${service.endpointLatencyMs ? ` · ${service.endpointLatencyMs}ms` : ""}` : "Verify endpoint"}</button><button className="button-secondary !min-h-9 !justify-start text-xs" disabled={busy || !service.identityLinked || service.status === "published"} onClick={() => runServiceAction(service.id, "verify-identity")}><ShieldCheck size={14}/> {service.identityVerified ? "Identity verified" : service.identityLinked ? "Verify ERC-8004" : "Identity not linked"}</button><button className="button-primary !min-h-9 text-xs" disabled={busy || service.status === "published" || service.healthStatus !== "online" || !service.identityVerified || !service.merchantVerified} onClick={() => runServiceAction(service.id, "publish")}><CloudUpload size={14}/> Publish</button></div>{service.endpointLastError && <p className="mt-2 text-xs leading-5 text-red-700">{service.endpointLastError}</p>}</div>)}</div>}</div></aside>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold"><span className="mb-2 block">{label}</span>{children}</label>; }
function ErrorBox({ message }: { message: string }) { return <p className="mt-5 rounded-[5px] bg-red-50 p-4 text-sm text-red-700">{message}</p>; }
