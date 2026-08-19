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
        <label className="control-with-leading-icon">
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search capability, service, or seller" />
        </label>
        <label className="control-with-leading-icon">
          <SlidersHorizontal size={17} aria-hidden="true" />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
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
