import { Activity } from "lucide-react";
import { connection } from "next/server";
import { getPublicActivity } from "@/server/public-metrics";

export default async function ActivityPage() {
  await connection();
  const activity = await getPublicActivity();
  return <main className="shell py-12"><p className="eyebrow mb-3">Transaction feed</p><h1 className="text-4xl font-bold">Activity</h1>{activity.length === 0 ? <div className="mt-8 panel grid min-h-64 place-items-center p-8 text-center"><div><Activity size={28} className="mx-auto mb-4 text-[var(--muted)]"/><h2 className="font-bold">No verified mainnet activity yet</h2><p className="mt-2 text-sm text-[var(--muted)]">Test simulations do not appear in the public feed.</p></div></div> : <div className="mt-8 overflow-x-auto border border-[var(--line)] bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"><tr><th className="p-4">Service</th><th className="p-4">Buyer</th><th className="p-4">Seller</th><th className="p-4">Amount</th><th className="p-4">Transaction</th></tr></thead><tbody>{activity.map((item) => <tr className="border-b border-[var(--line)] last:border-0" key={item.invocationId}><td className="p-4"><strong className="block">{item.service.name}</strong><span className="text-xs text-[var(--muted)]">{item.service.slug}</span></td><td className="p-4 font-mono text-xs">{item.buyer}</td><td className="p-4">{item.seller.name}</td><td className="p-4">{item.amount} {item.asset}</td><td className="p-4"><a className="font-mono text-xs text-[var(--green)] underline" href={item.explorerUrl} target="_blank" rel="noreferrer">{item.txHash.slice(0, 10)}...</a></td></tr>)}</tbody></table></div>}</main>;
}
