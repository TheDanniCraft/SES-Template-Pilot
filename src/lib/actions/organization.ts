"use server";

import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { NO_ACTIVATION_ID } from "@/lib/license-constants";
import { deactivateLicenseOnServer } from "@/lib/license-server";
import { getRequiredUserOrg, isInitialOwner, isOrgOwner } from "@/lib/org";
import { getServerSessionUser } from "@/lib/server-auth";
import {
  nowSql,
  organizationInvites,
  organizationLicenses,
  organizationMembers,
  organizations
} from "@/lib/schema";
import { resolveAppBaseUrl } from "@/lib/magic-link-mail";
import { decryptToken } from "@/lib/token-crypto";

const switchOrgSchema = z.object({
  organizationId: z.string().uuid("Invalid organization")
});

const createOrgSchema = z.object({
  name: z.string().trim().min(2, "Organization name is required")
});

const updateOrgNameSchema = z.object({
  name: z.string().trim().min(2, "Organization name is required")
});

const removeMemberSchema = z.object({
  userId: z.string().uuid("Invalid user")
});

const pendingInviteSchema = z.object({
  inviteId: z.string().uuid("Invalid invite")
});

export async function switchActiveOrganizationAction(
  input: z.infer<typeof switchOrgSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = switchOrgSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [membership] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, parsed.data.organizationId),
        eq(organizationMembers.userId, user.id)
      )
    )
    .limit(1);
  if (!membership) {
    return { success: false, error: "Organization not found for this user." };
  }

  const cookieStore = await cookies();
  cookieStore.set("active_org_id", parsed.data.organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  revalidatePath("/app");
  return { success: true };
}

export async function createOrganizationAction(
  input: z.infer<typeof createOrgSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const canCreateOrganizations = await isInitialOwner(user.id);
  if (!canCreateOrganizations) {
    return {
      success: false,
      error: "Only the initial owner account can create new organizations."
    };
  }

  const parsed = createOrgSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [created] = await db
    .insert(organizations)
    .values({
      name: parsed.data.name
    })
    .returning({ id: organizations.id });

  await db.insert(organizationMembers).values({
    organizationId: created.id,
    userId: user.id,
    role: "owner",
    updatedAt: nowSql
  });

  const cookieStore = await cookies();
  cookieStore.set("active_org_id", created.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  revalidatePath("/app");
  revalidatePath("/app/organization");
  return { success: true, organizationId: created.id };
}

export async function updateOrganizationNameAction(
  input: z.infer<typeof updateOrgNameSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const owner = await isOrgOwner(user.id);
  if (!owner) {
    return { success: false, error: "Only organization owners can update org settings." };
  }

  const parsed = updateOrgNameSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const org = await getRequiredUserOrg(user.id);
  await db
    .update(organizations)
    .set({
      name: parsed.data.name,
      updatedAt: nowSql
    })
    .where(eq(organizations.id, org.organizationId));

  revalidatePath("/app/organization");
  revalidatePath("/app");
  return { success: true };
}

export async function removeOrganizationMemberAction(
  input: z.infer<typeof removeMemberSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }
  if (input.userId === user.id) {
    return { success: false, error: "You cannot remove yourself." };
  }

  const owner = await isOrgOwner(user.id);
  if (!owner) {
    return { success: false, error: "Only organization owners can remove members." };
  }

  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const org = await getRequiredUserOrg(user.id);
  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, org.organizationId),
        eq(organizationMembers.userId, parsed.data.userId)
      )
    );

  revalidatePath("/app/organization");
  return { success: true };
}

export async function deactivateOrganizationLicenseAction() {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const owner = await isOrgOwner(user.id);
  if (!owner) {
    return { success: false, error: "Only organization owners can deactivate a license." };
  }

  const org = await getRequiredUserOrg(user.id);
  const [license] = await db
    .select({
      activationId: organizationLicenses.activationId,
      licenseKeyEncrypted: organizationLicenses.licenseKeyEncrypted
    })
    .from(organizationLicenses)
    .where(eq(organizationLicenses.organizationId, org.organizationId))
    .limit(1);

  if (!license) {
    return { success: false, error: "No license found for this organization." };
  }

  if (license.activationId !== NO_ACTIVATION_ID) {
    const key = decryptToken(
      license.licenseKeyEncrypted,
      `org-license:${org.organizationId}`
    );
    const deactivationResult = await deactivateLicenseOnServer({
      key,
      activationId: license.activationId
    });
    if (!deactivationResult.success) {
      return { success: false, error: deactivationResult.error };
    }
  }

  await db
    .update(organizationLicenses)
    .set({
      status: "revoked",
      updatedAt: nowSql
    })
    .where(eq(organizationLicenses.organizationId, org.organizationId));

  revalidatePath("/app/organization");
  revalidatePath("/app");
  revalidatePath("/activate");
  return { success: true };
}

export async function getPendingInviteLinkAction(
  input: z.infer<typeof pendingInviteSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const owner = await isOrgOwner(user.id);
  if (!owner) {
    return { success: false, error: "Only organization owners can view invite links." };
  }

  const parsed = pendingInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const org = await getRequiredUserOrg(user.id);
  const [invite] = await db
    .select({
      id: organizationInvites.id,
      email: organizationInvites.email,
      tokenEncrypted: organizationInvites.tokenEncrypted
    })
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.id, parsed.data.inviteId),
        eq(organizationInvites.organizationId, org.organizationId),
        isNull(organizationInvites.usedAt)
      )
    )
    .limit(1);

  if (!invite || !invite.tokenEncrypted) {
    return { success: false, error: "Pending invite not found." };
  }

  const token = decryptToken(
    invite.tokenEncrypted,
    `org-invite:${org.organizationId}:${invite.email}`
  );
  const appBaseUrl = resolveAppBaseUrl();
  return {
    success: true,
    inviteUrl: `${appBaseUrl}/invite/accept?token=${encodeURIComponent(token)}`
  };
}

export async function deletePendingInviteAction(
  input: z.infer<typeof pendingInviteSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const owner = await isOrgOwner(user.id);
  if (!owner) {
    return { success: false, error: "Only organization owners can delete invites." };
  }

  const parsed = pendingInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const org = await getRequiredUserOrg(user.id);
  await db
    .delete(organizationInvites)
    .where(
      and(
        eq(organizationInvites.id, parsed.data.inviteId),
        eq(organizationInvites.organizationId, org.organizationId),
        isNull(organizationInvites.usedAt)
      )
    );

  revalidatePath("/app/organization");
  return { success: true };
}
