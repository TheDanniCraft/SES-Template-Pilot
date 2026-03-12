import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, count, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { createSessionCookie, parseSessionCookie } from "@/lib/auth-cookie";
import { createRandomToken, sha256Base64Url } from "@/lib/auth-tokens";
import { db } from "@/lib/db";
import {
  authSessions,
  nowSql,
  organizationInvites,
  users
} from "@/lib/schema";
import { addUserToOrganization } from "@/lib/org";
import { encryptToken } from "@/lib/token-crypto";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const INVITE_TTL_MS = 1000 * 60 * 60 * 48;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string) {
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const [, salt, expectedHex] = parts;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

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

export async function countUsers() {
  const [result] = await db.select({ value: count() }).from(users);
  return result?.value ?? 0;
}

export async function countUsersWithPassword() {
  const [result] = await db
    .select({ value: count() })
    .from(users)
    .where(isNotNull(users.passwordHash));
  return result?.value ?? 0;
}

export async function getUserByEmail(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function createUserWithPassword(rawEmail: string, password: string) {
  const email = normalizeEmail(rawEmail);
  const defaultName = email.split("@")[0]?.trim() || null;
  const [created] = await db
    .insert(users)
    .values({
      email,
      name: defaultName,
      passwordHash: hashPassword(password)
    })
    .returning();
  return created;
}

export async function createOrUpgradeUserWithPassword(rawEmail: string, password: string) {
  const email = normalizeEmail(rawEmail);
  const existing = await getUserByEmail(email);
  if (!existing) {
    return createUserWithPassword(email, password);
  }

  const [updated] = await db
    .update(users)
    .set({
      passwordHash: hashPassword(password),
      updatedAt: nowSql
    })
    .where(eq(users.id, existing.id))
    .returning();

  return updated;
}

async function createSessionForUser(userId: string) {
  const sessionToken = createRandomToken(32);
  const sessionHash = await sha256Base64Url(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.insert(authSessions).values({
    userId,
    tokenHash: sessionHash,
    expiresAt
  });

  const cookieValue = await createSessionCookie(sessionToken, SESSION_MAX_AGE_SECONDS);
  return {
    cookieValue,
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS
  };
}

export async function authenticateUserWithPassword(rawEmail: string, password: string) {
  const user = await getUserByEmail(rawEmail);
  if (!user || !user.passwordHash) {
    return null;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return null;
  }

  const session = await createSessionForUser(user.id);
  return {
    ...session,
    user: {
      id: user.id,
      email: user.email
    }
  };
}

export async function updateUserPassword(userId: string, password: string) {
  await db
    .update(users)
    .set({
      passwordHash: hashPassword(password),
      updatedAt: nowSql
    })
    .where(eq(users.id, userId));
}

export async function updateUserProfile(
  userId: string,
  input: { email: string; name: string | null }
) {
  await db
    .update(users)
    .set({
      email: normalizeEmail(input.email),
      name: input.name?.trim() || null,
      updatedAt: nowSql
    })
    .where(eq(users.id, userId));
}

export async function createOrgInvite(
  organizationId: string,
  invitedByUserId: string,
  rawEmail: string
) {
  const email = normalizeEmail(rawEmail);
  await findOrCreateUserByEmail(email);
  const token = createRandomToken(32);
  const tokenHash = await sha256Base64Url(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db.insert(organizationInvites).values({
    organizationId,
    invitedByUserId,
    email,
    tokenHash,
    tokenEncrypted: encryptToken(token, `org-invite:${organizationId}:${email}`),
    expiresAt
  });

  return {
    token,
    email,
    expiresAt
  };
}

export async function getInviteEmailForToken(token: string) {
  const tokenHash = await sha256Base64Url(token.trim());
  const [invite] = await db
    .select({
      email: organizationInvites.email
    })
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.tokenHash, tokenHash),
        isNull(organizationInvites.usedAt),
        gt(organizationInvites.expiresAt, new Date())
      )
    )
    .limit(1);

  return invite?.email ?? null;
}

export async function consumeOrgInviteWithPassword(
  token: string,
  password: string,
  name: string
) {
  const tokenHash = await sha256Base64Url(token.trim());
  const [invite] = await db
    .select()
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.tokenHash, tokenHash),
        isNull(organizationInvites.usedAt),
        gt(organizationInvites.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!invite) {
    return null;
  }

  let user = await getUserByEmail(invite.email);
  if (!user) {
    const [created] = await db
      .insert(users)
      .values({
        email: invite.email,
        name: name.trim() || invite.email.split("@")[0]?.trim() || null,
        passwordHash: hashPassword(password)
      })
      .returning();
    user = created;
  } else {
    await db
      .update(users)
      .set({
        name: name.trim() || user.name,
        passwordHash: hashPassword(password),
        updatedAt: nowSql
      })
      .where(eq(users.id, user.id));
  }

  await addUserToOrganization(invite.organizationId, user.id, "member");

  await db
    .update(organizationInvites)
    .set({
      usedAt: nowSql
    })
    .where(eq(organizationInvites.id, invite.id));

  const session = await createSessionForUser(user.id);
  return {
    ...session,
    user: {
      id: user.id,
      email: user.email
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
