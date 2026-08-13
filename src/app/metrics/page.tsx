import { Activity, CircleDollarSign, Radio, Users } from "lucide-react";

const metrics = [
  { label: "Mainnet paid invocations", value: "0", icon: Activity },
  { label: "Unique external payers", value: "0", icon: Users },
  { label: "External payment volume", value: "$0.00", icon: CircleDollarSign },
  { label: "Live services", value: "4", icon: Radio },
];

export default function MetricsPage() {
  return <main className="shell py-12"><p className="eyebrow mb-3">Auditable activity</p><h1 className="text-4xl font-bold">Public metrics</h1><p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">Headline values include only externally initiated, successfully fulfilled GOAT mainnet payments. Local simulations and known project wallets are excluded.</p><div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(({ label, value, icon: Icon }) => <div className="panel p-5" key={label}><Icon size={18} className="mb-5 text-[var(--green)]"/><strong className="block text-3xl">{value}</strong><span className="mt-1 block text-sm text-[var(--muted)]">{label}</span></div>)}</div><section className="mt-8 border-y border-[var(--line)] py-7"><h2 className="mb-3 text-xl font-bold">Methodology</h2><p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">A successful invocation requires a verified payment to the seller, completed service execution, delivered output, and a stored receipt. Every production row must expose its GOAT Explorer transaction hash.</p></section></main>;
}
