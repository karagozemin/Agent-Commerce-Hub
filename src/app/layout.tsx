import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Activity, CircleDollarSign } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Commerce Hub",
  description: "Paid AI services on GOAT Network",
  icons: { icon: "/ach-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-white/95 backdrop-blur-xl">
          <div className="shell flex min-h-16 items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-3 font-bold">
              <span className="grid size-10 place-items-center overflow-hidden rounded-full border border-[var(--gold-deep)] bg-[#080909]" aria-hidden="true"><Image src="/ach-logo.png" alt="" width={40} height={40} className="size-10 object-contain" priority /></span>
              <span className="tracking-tight">Agent Commerce <span className="text-[var(--green)]">Hub</span></span>
            </Link>
            <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--muted)] md:flex">
              <Link href="/market" className="hover:text-[var(--ink)]">Marketplace</Link>
              <Link href="/activity" className="hover:text-[var(--ink)]">Activity</Link>
              <Link href="/metrics" className="hover:text-[var(--ink)]">Metrics</Link>
              <Link href="/dashboard" className="hover:text-[var(--ink)]">Dashboard</Link>
              <Link href="/docs" className="hover:text-[var(--ink)]">Docs</Link>
            </nav>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link href="/sell" className="button-primary header-cta"><CircleDollarSign size={17} /> List a service</Link>
            </div>
          </div>
        </header>
        {children}
        <footer className="mt-20 border-t border-[var(--line)] bg-white py-8 text-sm text-[var(--muted)]">
          <div className="shell flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-2"><Image src="/ach-logo.png" alt="" width={24} height={24} className="size-6 object-contain" /><Activity size={15} className="text-[var(--green)]" /> Built for auditable agent commerce on GOAT.</span>
            <span>GOAT Flow / x402 · ERC-8004</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
