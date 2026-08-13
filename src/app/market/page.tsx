import { Marketplace } from "@/components/marketplace";
import { services } from "@/data/services";

export default function MarketPage() {
  return <main className="shell py-12"><p className="eyebrow mb-3">Service registry</p><h1 className="mb-3 text-4xl font-bold">Marketplace</h1><p className="mb-8 text-[var(--muted)]">Pay only when a service is invoked successfully.</p><Marketplace services={services} /></main>;
}
