import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/current-session";
import { getSellerMetrics } from "@/server/seller/metrics";

export async function GET() {
  try {
    return NextResponse.json({ data: await getSellerMetrics(await requireSession()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load seller metrics";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 400 });
  }
}
