import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { invocationService } from "@/server/invocation-service";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const body = await request.json();
    const idempotencyKey = request.headers.get("idempotency-key") ?? body.idempotencyKey;
    if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.length > 200) {
      return NextResponse.json({ error: "A valid idempotency key is required" }, { status: 400 });
    }
    if (typeof body.buyerWallet !== "string" || !isAddress(body.buyerWallet)) {
      return NextResponse.json({ error: "A valid buyer wallet is required" }, { status: 400 });
    }

    const invocation = await invocationService.start({
      slug,
      buyerWallet: body.buyerWallet,
      idempotencyKey,
      payload: body.input,
    });

    return NextResponse.json(
      {
        error: "Payment required",
        invocationId: invocation.id,
        status: invocation.status,
        payment: invocation.paymentOrder,
      },
      { status: 402, headers: { "X-Invocation-Id": invocation.id } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start invocation" },
      { status: 400 },
    );
  }
}
