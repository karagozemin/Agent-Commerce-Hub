import { cookies } from "next/headers";
import { authService, sessionCookie } from "./service";

export async function getCurrentSession() {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  return authService.getSession(token);
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) throw new Error("Authentication required");
  return session;
}
