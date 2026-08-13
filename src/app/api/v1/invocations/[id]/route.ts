import { NextResponse } from "next/server";
import { invocationService } from "@/server/invocation-service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const invocation = await invocationService.get(id);
  if (!invocation) return NextResponse.json({ error: "Invocation not found" }, { status: 404 });
  return NextResponse.json({ data: invocation });
}
