import { NextResponse } from "next/server";
import { getServiceBySlug } from "@/data/services";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const service = getServiceBySlug(slug);
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });
  return NextResponse.json({ data: service });
}
