"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { ServiceManifest } from "@/domain/types";
import { ServiceCard } from "./service-card";

const categories = ["All services", "Developer Tools", "Research & Data", "Agent Operations", "GOAT Native"];

export function Marketplace({ services }: { services: ServiceManifest[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All services");

  const filtered = useMemo(() => services.filter((service) => {
    const inCategory = category === "All services" || service.category === category;
    const haystack = `${service.name} ${service.description} ${service.tags.join(" ")}`.toLowerCase();
    return inCategory && haystack.includes(query.toLowerCase());
  }), [services, query, category]);

  return (
    <>
      <div className="mb-6 grid gap-3 md:grid-cols-[1fr_240px]">
        <label className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input className="field pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search capability, service, or seller" />
        </label>
        <label className="relative">
          <SlidersHorizontal size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <select className="field pl-10" value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="mb-4 flex items-center justify-between text-sm">
        <strong>{filtered.length} live services</strong>
        <span className="text-[var(--muted)]">Ranked by reliability and paid usage</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{filtered.map((service) => <ServiceCard key={service.id} service={service} />)}</div>
    </>
  );
}
