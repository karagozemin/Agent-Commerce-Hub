import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, CircleDollarSign, Network, Radio, ShieldCheck } from "lucide-react";
import { listPublishedServices } from "@/server/catalog";
import { Marketplace } from "@/components/marketplace";
import { connection } from "next/server";

export default async function Home() {
  await connection();
  const services = await listPublishedServices();
  return (
    <main>
      <section className="border-b border-[var(--line)] bg-white/70 py-12 md:py-20">
        <div className="shell grid gap-10 md:grid-cols-[1fr_300px] md:items-center">
          <div>
            <p className="eyebrow mb-4">The premium agent economy</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.04] md:text-6xl">Intelligence, exchanged with intent.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">Discover agent capabilities, pay per request through x402, and receive verifiable results from identified sellers.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/market" className="button-primary"><ShieldCheck size={17} /> Explore marketplace</Link>
              <Link href="/docs" className="button-secondary">Read the protocol <ArrowRight size={16} /></Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[260px]">
            <div className="absolute inset-5 rounded-full bg-[var(--green)]/10 blur-3xl" />
            <Image src="/ach-logo.png" alt="Agent Commerce Hub emblem" width={320} height={320} className="relative w-full object-contain drop-shadow-[0_20px_40px_rgba(233,185,73,0.16)]" priority />
          </div>
          <div className="grid grid-cols-2 overflow-hidden rounded-[8px] border border-[var(--line)] bg-white md:col-span-2 md:grid-cols-4">
            <div className="border-b border-r border-[var(--line)] p-4 md:border-b-0"><Radio size={16} className="mb-3 text-[var(--green)]" /><strong className="block text-2xl">{services.length}</strong><span className="text-xs text-[var(--muted)]">Live services</span></div>
            <div className="border-b border-[var(--line)] p-4 md:border-b-0 md:border-r"><Network size={16} className="mb-3 text-[var(--blue)]" /><strong className="block text-2xl">2345</strong><span className="text-xs text-[var(--muted)]">Mainnet chain ID</span></div>
            <div className="border-r border-[var(--line)] p-4"><BadgeCheck size={16} className="mb-3 text-[var(--green)]" /><strong className="block text-2xl">100%</strong><span className="text-xs text-[var(--muted)]">Identified sellers</span></div>
            <div className="p-4"><CircleDollarSign size={16} className="mb-3 text-[var(--amber)]" /><strong className="block text-2xl">0%</strong><span className="text-xs text-[var(--muted)]">Marketplace fee</span></div>
          </div>
        </div>
      </section>
      <section className="shell py-10 md:py-14">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow mb-2">Marketplace</p><h2 className="text-3xl font-bold">Capabilities agents can buy</h2></div>
          <Link href="/docs" className="flex items-center gap-2 text-sm font-bold text-[var(--green)]">Machine access <ArrowRight size={16} /></Link>
        </div>
        <Marketplace services={services} />
      </section>
    </main>
  );
}
