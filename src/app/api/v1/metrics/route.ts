import { NextResponse } from "next/server";
import { getPublicMetrics } from "@/server/public-metrics";

export async function GET() {
  return NextResponse.json({ data: await getPublicMetrics() });
}
