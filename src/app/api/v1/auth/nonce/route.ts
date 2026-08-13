import { NextResponse } from "next/server";
import { authService } from "@/server/auth/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    const challenge = await authService.createChallenge({
      walletAddress: body.walletAddress,
      chainId: Number(body.chainId),
      domain: url.host,
      uri: url.origin,
    });
    return NextResponse.json({ data: challenge });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create challenge" }, { status: 400 });
  }
}
