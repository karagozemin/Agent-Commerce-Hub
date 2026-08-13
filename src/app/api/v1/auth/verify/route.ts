import { NextResponse } from "next/server";
import { authService, sessionCookie } from "@/server/auth/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await authService.verify(body);
    const response = NextResponse.json({ data: { user: result.user, expiresAt: result.expiresAt } });
    response.cookies.set(sessionCookie.name, result.token, sessionCookie.options);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify wallet" }, { status: 401 });
  }
}
