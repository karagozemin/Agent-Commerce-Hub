import Link from "next/link";
import { Activity, CircleDollarSign, Gauge, Users } from "lucide-react";
import { connection } from "next/server";
import { requireSession } from "@/server/auth/current-session";
import { getSellerMetrics } from "@/server/seller/metrics";

export default async function DashboardPage() {
  await connection();
  let data: Awaited<ReturnType<typeof getSellerMetrics>> | undefined;
  let errorMessage: string | undefined;
  try { data = await getSellerMetrics(await requireSession()); }
  catch (error) { errorMessage = error instanceof Error ? error.message : "Authentication required"; }

  if (!data) {
    const message = errorMessage ?? "Authentication required";
    return <main className="shell py-16"><p className="eyebrow mb-3">Seller workspace</p><h1 className="text-4xl font-bold">Connect your seller wallet</h1><p className="mt-3 max-w-xl leading-7 text-[var(--muted)]">{message === "Authentication required" ? "Authenticate at the seller onboarding page to view revenue, buyers, service health, and transactions." : message}</p><Link href="/sell" className="button-primary mt-7">Open seller onboarding</Link></main>;
  }

    const cards = [
      ["Revenue", `$${data.overview.revenue}`, CircleDollarSign],
      ["Successful calls", data.overview.successfulCalls, Activity],
      ["Unique buyers", data.overview.uniqueBuyers, Users],
      ["Active services", data.overview.activeServices, Gauge],
    ] as const;
    return <main className="shell py-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-3">Seller workspace</p><h1 className="text-4xl font-bold">Dashboard</h1><p className="mt-3 text-[var(--muted)]">{data.seller.displayName} · {data.seller.walletAddress}</p></div><Link href="/sell" className="button-secondary">Manage services</Link></div><div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value, Icon]) => <div className="panel p-5" key={label}><Icon size={18} className="mb-5 text-[var(--green)]"/><strong className="block text-3xl">{value}</strong><span className="mt-1 block text-sm text-[var(--muted)]">{label}</span></div>)}</div><section className="mt-10"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Services</h2><Link href="/api/v1/seller/transactions" className="text-sm font-bold text-[var(--green)]">Transactions API</Link></div><div className="overflow-x-auto border border-[var(--line)] bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"><tr><th className="p-4">Service</th><th className="p-4">Status</th><th className="p-4">Calls</th><th className="p-4">Buyers</th><th className="p-4">Revenue</th><th className="p-4">Health</th></tr></thead><tbody>{data.services.map((service) => <tr className="border-b border-[var(--line)] last:border-0" key={service.id}><td className="p-4"><strong>{service.name}</strong><span className="mt-1 block text-xs text-[var(--muted)]">/{service.slug}</span></td><td className="p-4">{service.status}</td><td className="p-4">{service.calls}</td><td className="p-4">{service.uniqueBuyers}</td><td className="p-4">${service.revenue}</td><td className="p-4"><span className={service.healthStatus === "online" ? "text-[var(--green)]" : "text-[var(--amber)]"}>{service.healthStatus}</span>{service.endpointLatencyMs ? <span className="ml-2 text-xs text-[var(--muted)]">{service.endpointLatencyMs}ms</span> : null}</td></tr>)}</tbody></table></div></section></main>;
}
