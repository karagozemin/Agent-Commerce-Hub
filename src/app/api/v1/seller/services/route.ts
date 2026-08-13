import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/current-session";
import { sellerService } from "@/server/seller/service";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({ data: await sellerService.getWorkspace(session) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load seller workspace";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const service = await sellerService.createService(session, await request.json());
    return NextResponse.json({ data: service }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create service";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 400 });
  }
}
