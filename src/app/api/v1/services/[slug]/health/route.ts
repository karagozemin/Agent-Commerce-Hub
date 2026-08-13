import { NextResponse } from "next/server";
import { findPublishedServiceBySlug } from "@/server/catalog";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const service = await findPublishedServiceBySlug(slug);
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });
  return NextResponse.json({ data: {
    slug: service.slug,
    availability: service.availability,
    healthStatus: service.availability === "online" ? "online" : service.availability,
    expectedLatencyMs: service.expectedLatencyMs,
    lastVerifiedAt: "endpointVerifiedAt" in service ? service.endpointVerifiedAt : null,
  } });
}
