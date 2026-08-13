import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authService, sessionCookie } from "@/server/auth/service";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie.name)?.value;
  await authService.revoke(token);
  const response = NextResponse.json({ data: { loggedOut: true } });
  response.cookies.set(sessionCookie.name, "", { ...sessionCookie.options, maxAge: 0 });
  return response;
}
