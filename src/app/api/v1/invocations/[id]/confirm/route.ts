import { NextResponse } from "next/server";
import { invocationService } from "@/server/invocation-service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const invocation = await invocationService.confirm(id);
    return NextResponse.json({ data: invocation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to confirm payment";
    const status = message.includes("not confirmed") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
