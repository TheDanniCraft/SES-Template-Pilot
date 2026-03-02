import { cookies } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { parseSessionCookie } from "@/lib/auth-cookie";
import { sha256Base64Url } from "@/lib/auth-tokens";
import { db } from "@/lib/db";
import { authSessions, users } from "@/lib/schema";

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export async function getServerSessionUser() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("session_auth")?.value;
  if (!cookieValue) {
    return null;
  }

  const parsedCookie = await parseSessionCookie(cookieValue);
  if (!parsedCookie) {
    return null;
  }

  const tokenHash = await sha256Base64Url(parsedCookie.s);
  const [session] = await db
    .select({
      userId: users.id,
      userEmail: users.email
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!session) {
    return null;
  }

  return {
    id: session.userId,
    email: session.userEmail
  } satisfies AuthenticatedUser;
}

export async function isServerSessionAuthenticated() {
  return Boolean(await getServerSessionUser());
}

export async function requireServerSessionUser() {
  const user = await getServerSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

