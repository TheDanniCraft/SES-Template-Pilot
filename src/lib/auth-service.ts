import { and, count, eq, gt, isNull } from "drizzle-orm";
import { createSessionCookie, parseSessionCookie } from "@/lib/auth-cookie";
import { createRandomToken, sha256Base64Url } from "@/lib/auth-tokens";
import { db } from "@/lib/db";
import { authMagicLinks, authSessions, nowSql, users } from "@/lib/schema";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const MAGIC_LINK_WINDOW_MS = 10 * 60 * 1000;
const MAGIC_LINK_MAX_PER_WINDOW = 5;
const MAGIC_LINK_GLOBAL_MAX_PER_WINDOW = 100;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findOrCreateUserByEmail(rawEmail: string) {
  const email = normalizeEmail(rawEmail);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      email
    })
    .returning();

  return created;
}

export async function createMagicLinkForEmail(
  email: string,
  appBaseUrl: string,
  nonce: string
) {
  const user = await findOrCreateUserByEmail(email);
  const windowStart = new Date(Date.now() - MAGIC_LINK_WINDOW_MS);
  const [globalRecentCount] = await db
    .select({ value: count() })
    .from(authMagicLinks)
    .where(gt(authMagicLinks.createdAt, windowStart));

  if ((globalRecentCount?.value ?? 0) >= MAGIC_LINK_GLOBAL_MAX_PER_WINDOW) {
    throw new Error("Too many login links are being requested right now. Try again later.");
  }

  const [recentCount] = await db
    .select({ value: count() })
    .from(authMagicLinks)
    .where(and(eq(authMagicLinks.userId, user.id), gt(authMagicLinks.createdAt, windowStart)));

  if ((recentCount?.value ?? 0) >= MAGIC_LINK_MAX_PER_WINDOW) {
    throw new Error("Too many login links requested. Please wait a few minutes.");
  }

  const token = createRandomToken(32);
  const tokenHash = await sha256Base64Url(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await db.insert(authMagicLinks).values({
    userId: user.id,
    tokenHash,
    expiresAt
  });

  return {
    user,
    token,
    magicLink: `${appBaseUrl}/login/verify?token=${encodeURIComponent(token)}&nonce=${encodeURIComponent(nonce)}`,
    expiresAt
  };
}

export async function consumeMagicLinkToken(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return null;
  }

  const tokenHash = await sha256Base64Url(normalizedToken);
  const [magicLinkRow] = await db
    .select({
      id: authMagicLinks.id,
      userId: authMagicLinks.userId,
      userEmail: users.email
    })
    .from(authMagicLinks)
    .innerJoin(users, eq(users.id, authMagicLinks.userId))
    .where(
      and(
        eq(authMagicLinks.tokenHash, tokenHash),
        isNull(authMagicLinks.usedAt),
        gt(authMagicLinks.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!magicLinkRow) {
    return null;
  }

  await db
    .update(authMagicLinks)
    .set({
      usedAt: nowSql
    })
    .where(eq(authMagicLinks.id, magicLinkRow.id));

  const sessionToken = createRandomToken(32);
  const sessionHash = await sha256Base64Url(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.insert(authSessions).values({
    userId: magicLinkRow.userId,
    tokenHash: sessionHash,
    expiresAt
  });

  const cookieValue = await createSessionCookie(sessionToken, SESSION_MAX_AGE_SECONDS);

  return {
    cookieValue,
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    user: {
      id: magicLinkRow.userId,
      email: magicLinkRow.userEmail
    }
  };
}

export async function revokeSessionFromCookie(cookieValue: string | null | undefined) {
  if (!cookieValue) {
    return;
  }

  const parsedCookie = await parseSessionCookie(cookieValue);
  if (!parsedCookie) {
    return;
  }

  const tokenHash = await sha256Base64Url(parsedCookie.s);
  await db
    .update(authSessions)
    .set({
      revokedAt: nowSql
    })
    .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)));
}
