import { NextResponse } from "next/server";
import { listPublishedServices } from "@/server/catalog";

export async function GET() {
  const services = await listPublishedServices();
  return NextResponse.json({ data: services, count: services.length });
}
