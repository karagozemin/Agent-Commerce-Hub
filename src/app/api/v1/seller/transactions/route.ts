import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/current-session";
import { getSellerTransactions } from "@/server/seller/metrics";

export async function GET(request: Request) {
  try {
    const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 100), 100);
    return NextResponse.json({ data: await getSellerTransactions(await requireSession(), Number.isFinite(limit) && limit > 0 ? limit : 100) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load seller transactions";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 400 });
  }
}
