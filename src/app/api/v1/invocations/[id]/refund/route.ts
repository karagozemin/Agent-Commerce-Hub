import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/current-session";
import { findPublishedServiceById } from "@/server/catalog";
import { invocationService } from "@/server/invocation-service";
import { sellerRepository } from "@/server/seller/repository";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const invocation = await invocationService.get(id);
    if (!invocation) return NextResponse.json({ error: "Invocation not found" }, { status: 404 });
    const service = await findPublishedServiceById(invocation.serviceId);
    const profile = await sellerRepository.findProfileByUser(session.userId);
    if (!service || !profile || service.sellerId !== profile.id) return NextResponse.json({ error: "Invocation is not owned by this seller" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ data: await invocationService.requestRefund(id, typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to request refund";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 400 });
  }
}
