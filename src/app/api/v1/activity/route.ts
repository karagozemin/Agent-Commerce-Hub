import { NextResponse } from "next/server";
import { invocationRepository } from "@/server/repository";

export async function GET() {
  const invocations = await invocationRepository.list();
  return NextResponse.json({ data: invocations.slice(0, 50) });
}
