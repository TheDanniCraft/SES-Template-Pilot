import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { nowSql, organizationMembers, organizations, users } from "@/lib/schema";

export type UserOrg = {
  organizationId: string;
  organizationName: string;
  role: string;
};

export async function getUserOrganizations(userId: string): Promise<UserOrg[]> {
  const rows = await db
    .select({
      organizationId: organizationMembers.organizationId,
      organizationName: organizations.name,
      role: organizationMembers.role
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId));

  return rows;
}

async function getActiveOrgIdFromCookie() {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("active_org_id")?.value?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function getUserOrg(userId: string): Promise<UserOrg | null> {
  const memberships = await getUserOrganizations(userId);
  if (memberships.length === 0) {
    return null;
  }

  const activeOrgId = await getActiveOrgIdFromCookie();
  if (activeOrgId) {
    const active = memberships.find((item) => item.organizationId === activeOrgId);
    if (active) {
      return active;
    }
  }

  return memberships[0] ?? null;
}

export async function ensurePersonalOrgForUser(user: { id: string; email: string }) {
  const existing = await getUserOrg(user.id);
  if (existing) {
    return existing;
  }

  const name = user.email.split("@")[0]?.trim() || "Workspace";
  const [createdOrg] = await db
    .insert(organizations)
    .values({
      name
    })
    .returning({ id: organizations.id });

  await db.insert(organizationMembers).values({
    organizationId: createdOrg.id,
    userId: user.id,
    role: "owner",
    updatedAt: nowSql
  });

  return {
    organizationId: createdOrg.id,
    organizationName: name,
    role: "owner"
  };
}

export async function getRequiredUserOrg(userId: string) {
  const org = await getUserOrg(userId);
  if (!org) {
    throw new Error("Organization membership not found");
  }
  return org;
}

export async function isOrgOwner(userId: string) {
  const [row] = await db
    .select({
      role: organizationMembers.role
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  return (row?.role ?? "").toLowerCase() === "owner";
}

export async function isInitialOwner(userId: string) {
  const [firstUser] = await db
    .select({ id: users.id })
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.id))
    .limit(1);
  return firstUser?.id === userId;
}

export async function addUserToOrganization(
  organizationId: string,
  userId: string,
  role: "owner" | "member" = "member"
) {
  const [existing] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(organizationMembers).values({
    organizationId,
    userId,
    role,
    updatedAt: nowSql
  });
}
