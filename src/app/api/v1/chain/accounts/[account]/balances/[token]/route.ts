import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getGoatAccountBalances } from "@/server/goat-transaction-status";

export async function GET(
  _request: Request,
  context: { params: Promise<{ account: string; token: string }> },
) {
  const { account, token } = await context.params;
  if (!isAddress(account) || !isAddress(token)) {
    return NextResponse.json({ error: "Invalid account or token address" }, { status: 400 });
  }

  try {
    const balances = await getGoatAccountBalances(account, token);
    return NextResponse.json({ data: balances }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "GOAT balance tracker is temporarily unavailable" }, { status: 502 });
  }
}
