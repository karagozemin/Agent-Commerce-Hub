import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Clock3, Radio, Repeat2 } from "lucide-react";
import type { ServiceManifest } from "@/domain/types";

export function ServiceCard({ service }: { service: ServiceManifest }) {
  return (
    <Link href={`/service/${service.slug}`} className="panel group flex min-h-64 flex-col p-5 transition hover:-translate-y-0.5 hover:border-[#aeb8b1] hover:shadow-[0_12px_24px_rgba(18,22,20,.06)]">
      <div className="mb-5 flex items-start justify-between">
        <span className="rounded-[4px] bg-[var(--green-soft)] px-2 py-1 text-xs font-bold text-[var(--green)]">{service.category}</span>
        <ArrowUpRight size={19} className="text-[var(--muted)] transition group-hover:text-[var(--green)]" />
      </div>
      <h2 className="mb-2 text-xl font-bold">{service.name}</h2>
      <p className="mb-5 flex-1 text-sm leading-6 text-[var(--muted)]">{service.description}</p>
      <div className="mb-4 flex items-center gap-2 border-y border-[var(--line)] py-3 text-xs text-[var(--muted)]">
        <BadgeCheck size={15} className="text-[var(--green)]" />
        <span className="font-semibold text-[var(--ink)]">{service.sellerName}</span>
        <span>ERC-8004 #{service.identity.agentId}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="block text-xs text-[var(--muted)]">Per invocation</span>
          <strong className="text-lg">${service.pricing.amount} {service.pricing.asset}</strong>
        </div>
        <div className="flex gap-3 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1"><Radio size={13} className="text-[var(--green)]" /> Live</span>
          <span className="flex items-center gap-1"><Clock3 size={13} /> {(service.expectedLatencyMs / 1000).toFixed(1)}s</span>
          <span className="flex items-center gap-1"><Repeat2 size={13} /> {service.repeatUsageRate}%</span>
        </div>
      </div>
    </Link>
  );
}
