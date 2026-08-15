import { NextResponse } from "next/server";
import { isAddress, isHash } from "viem";
import { getGoatTransactionStatus } from "@/server/goat-transaction-status";

export async function GET(request: Request, context: { params: Promise<{ hash: string }> }) {
  const { hash } = await context.params;
  if (!isHash(hash)) return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? undefined;
  const account = url.searchParams.get("account") ?? undefined;
  if ((token && !isAddress(token)) || (account && !isAddress(account)) || Boolean(token) !== Boolean(account)) {
    return NextResponse.json({ error: "Token and account must be valid addresses supplied together" }, { status: 400 });
  }

  try {
    const status = await getGoatTransactionStatus(hash, token, account);
    return NextResponse.json({ data: { hash, ...status } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "GOAT transaction tracker is temporarily unavailable" }, { status: 502 });
  }
}
