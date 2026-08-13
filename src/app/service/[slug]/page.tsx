import { notFound } from "next/navigation";
import { BadgeCheck, Clock3, ExternalLink, Radio, Repeat2, ShieldCheck } from "lucide-react";
import { services, getServiceBySlug } from "@/data/services";
import { InvokePanel } from "@/components/invoke-panel";

export function generateStaticParams() { return services.map((service) => ({ slug: service.slug })); }

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) notFound();

  return <main className="shell py-10">
    <div className="mb-8 border-b border-[var(--line)] pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-[4px] bg-[var(--green-soft)] px-2 py-1 font-bold text-[var(--green)]">{service.category}</span>{service.tags.map((tag) => <span key={tag} className="rounded-[4px] border border-[var(--line)] bg-white px-2 py-1 text-[var(--muted)]">{tag}</span>)}</div>
      <h1 className="text-4xl font-bold md:text-5xl">{service.name}</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--muted)]">{service.description}</p>
    </div>
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <section><h2 className="mb-3 text-xl font-bold">What it does</h2><p className="max-w-3xl leading-7 text-[var(--muted)]">{service.longDescription}</p></section>
        <section className="grid grid-cols-3 border border-[var(--line)] bg-white">
          <div className="border-r border-[var(--line)] p-4"><Radio size={16} className="mb-3 text-[var(--green)]"/><strong className="block">{service.successRate}%</strong><span className="text-xs text-[var(--muted)]">Success rate</span></div>
          <div className="border-r border-[var(--line)] p-4"><Clock3 size={16} className="mb-3 text-[var(--blue)]"/><strong className="block">{(service.expectedLatencyMs / 1000).toFixed(1)}s</strong><span className="text-xs text-[var(--muted)]">Expected latency</span></div>
          <div className="p-4"><Repeat2 size={16} className="mb-3 text-[var(--amber)]"/><strong className="block">{service.repeatUsageRate}%</strong><span className="text-xs text-[var(--muted)]">Repeat usage</span></div>
        </section>
        <section><h2 className="mb-3 text-xl font-bold">Input schema</h2><pre className="overflow-auto rounded-[5px] bg-[#151a17] p-5 text-xs leading-6 text-[#d9e7dd]">{JSON.stringify(service.inputSchema, null, 2)}</pre></section>
        <section className="panel p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow mb-2">Seller identity</p><h2 className="flex items-center gap-2 text-xl font-bold">{service.sellerName}<BadgeCheck size={19} className="text-[var(--green)]" /></h2></div><span className="flex items-center gap-2 text-xs text-[var(--muted)]"><ShieldCheck size={16} /> ERC-8004 verified</span></div><dl className="mt-5 grid gap-2 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-[150px_1fr]"><dt className="text-[var(--muted)]">Agent ID</dt><dd>#{service.identity.agentId}</dd><dt className="text-[var(--muted)]">Owner wallet</dt><dd className="truncate font-mono text-xs">{service.identity.ownerWallet}</dd><dt className="text-[var(--muted)]">Registry</dt><dd className="flex items-center gap-2 truncate font-mono text-xs">{service.identity.registryAddress}<ExternalLink size={13}/></dd></dl></section>
      </div>
      <InvokePanel service={service} />
    </div>
  </main>;
}
