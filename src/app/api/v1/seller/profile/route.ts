import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/current-session";
import { sellerService } from "@/server/seller/service";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const profile = await sellerService.createProfile(session, await request.json());
    return NextResponse.json({ data: profile }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create seller profile";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 400 });
  }
}
