import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/current-session";
import { sellerService } from "@/server/seller/service";

export async function POST(request: Request) {
  try { const session = await requireSession(); return NextResponse.json({ data: await sellerService.configureMerchant(session, await request.json()) }); }
  catch (error) { const message = error instanceof Error ? error.message : "Merchant configuration failed"; return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 400 }); }
}
