import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/current-session";
import { sellerService } from "@/server/seller/service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const session = await requireSession(); return NextResponse.json({ data: await sellerService.verifyEndpoint(session, (await context.params).id) }); }
  catch (error) { const message = error instanceof Error ? error.message : "Verification failed"; return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 400 }); }
}
