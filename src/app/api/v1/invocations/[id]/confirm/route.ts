import { NextResponse } from "next/server";
import { invocationService } from "@/server/invocation-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const text = await request.text();
    const body = text ? JSON.parse(text) as { sessionId?: unknown } : {};
    if (body.sessionId !== undefined && (typeof body.sessionId !== "string" || body.sessionId.length > 200)) {
      return NextResponse.json({ error: "A valid payment session ID is required" }, { status: 400 });
    }
    const invocation = await invocationService.confirm(id, {
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
    });
    return NextResponse.json({ data: invocation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to confirm payment";
    const status = message.includes("not confirmed") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
