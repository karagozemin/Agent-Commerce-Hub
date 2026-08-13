import { Activity } from "lucide-react";

export default function ActivityPage() {
  return <main className="shell py-12"><p className="eyebrow mb-3">Transaction feed</p><h1 className="text-4xl font-bold">Activity</h1><div className="mt-8 panel grid min-h-64 place-items-center p-8 text-center"><div><Activity size={28} className="mx-auto mb-4 text-[var(--muted)]"/><h2 className="font-bold">No verified mainnet activity yet</h2><p className="mt-2 text-sm text-[var(--muted)]">Test simulations do not appear in the public feed.</p></div></div></main>;
}
