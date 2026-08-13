import { NextResponse } from "next/server";
import { getPublicActivity } from "@/server/public-metrics";

export async function GET() {
  return NextResponse.json({ data: await getPublicActivity() });
}
