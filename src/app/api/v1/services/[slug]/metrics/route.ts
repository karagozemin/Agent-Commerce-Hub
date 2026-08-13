import { NextResponse } from "next/server";
import { getPublicServiceMetrics } from "@/server/public-metrics";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const metrics = await getPublicServiceMetrics(slug);
  if (!metrics) return NextResponse.json({ error: "Service not found" }, { status: 404 });
  return NextResponse.json({ data: metrics });
}
