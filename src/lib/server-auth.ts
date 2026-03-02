import { cookies } from "next/headers";
import { validateSessionCookie } from "@/lib/auth-cookie";
import { getAppPassword } from "@/lib/app-password";

export async function isServerSessionAuthenticated() {
  const expectedPassword = getAppPassword();
  if (!expectedPassword) {
    return false;
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("session_auth")?.value;
  if (!cookieValue) {
    return false;
  }

  return validateSessionCookie(cookieValue, expectedPassword);
}

