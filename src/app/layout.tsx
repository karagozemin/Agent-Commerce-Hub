import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Box, CircleDollarSign } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Commerce Hub",
  description: "Paid AI services on GOAT Network",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-[var(--line)] bg-white/95">
          <div className="shell flex min-h-16 items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-3 font-bold">
              <span className="grid size-9 place-items-center rounded-[5px] bg-[var(--ink)] text-white"><Box size={18} /></span>
              <span>Agent Commerce Hub</span>
            </Link>
            <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--muted)] md:flex">
              <Link href="/market" className="hover:text-[var(--ink)]">Marketplace</Link>
              <Link href="/activity" className="hover:text-[var(--ink)]">Activity</Link>
              <Link href="/metrics" className="hover:text-[var(--ink)]">Metrics</Link>
              <Link href="/dashboard" className="hover:text-[var(--ink)]">Dashboard</Link>
              <Link href="/docs" className="hover:text-[var(--ink)]">Docs</Link>
            </nav>
            <Link href="/sell" className="button-secondary hidden sm:inline-flex"><CircleDollarSign size={17} /> List a service</Link>
          </div>
        </header>
        {children}
        <footer className="mt-20 border-t border-[var(--line)] bg-white py-8 text-sm text-[var(--muted)]">
          <div className="shell flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-2"><Activity size={15} /> Built for auditable agent commerce on GOAT.</span>
            <span>GOAT Flow / x402 · ERC-8004</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
