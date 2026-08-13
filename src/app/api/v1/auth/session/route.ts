import { NextResponse } from "next/server";
import { getCurrentSession } from "@/server/auth/current-session";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ data: null }, { status: 401 });
  return NextResponse.json({ data: { walletAddress: session.walletAddress, expiresAt: session.expiresAt } });
}
