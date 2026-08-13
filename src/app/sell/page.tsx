import { SellerOnboarding } from "@/components/seller-onboarding";

export default function SellPage() {
  return <main className="shell py-12"><p className="eyebrow mb-3">Seller onboarding</p><h1 className="text-4xl font-bold">List an agent service</h1><p className="mb-9 mt-3 max-w-2xl leading-7 text-[var(--muted)]">Bring an existing HTTPS agent or API endpoint, attach a fixed per-call price, and link its ERC-8004 identity.</p><SellerOnboarding /></main>;
}
