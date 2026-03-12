"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  authenticateUserWithPassword,
  consumeOrgInviteWithPassword,
  countUsers,
  createOrgInvite,
  createUserWithPassword,
  revokeSessionFromCookie,
  updateUserPassword,
  updateUserProfile
} from "@/lib/auth-service";
import { db } from "@/lib/db";
import { ensurePersonalOrgForUser, getRequiredUserOrg, isOrgOwner } from "@/lib/org";
import { resolveAppBaseUrl } from "@/lib/magic-link-mail";
import { organizationMembers, organizations } from "@/lib/schema";
import { getServerSessionUser } from "@/lib/server-auth";

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one symbol");

const setupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: passwordSchema,
  organizationName: z.string().trim().min(2, "Organization name is required")
});

const passwordLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required")
});

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email")
});

const acceptInviteSchema = z.object({
  token: z.string().trim().min(10, "Invalid invite token"),
  name: z.string().trim().min(1, "Name is required"),
  password: passwordSchema
});

const accountProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  currentPassword: z.string().min(1, "Current password is required")
});

const accountPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema
});

export async function setupInitialAdminAction(
  input: z.infer<typeof setupSchema>
) {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input"
    };
  }

  const usersCount = await countUsers();
  if (usersCount > 0) {
    return {
      success: false,
      error: "Setup is already completed."
    };
  }

  const user = await createUserWithPassword(parsed.data.email, parsed.data.password);
  const [organization] = await db
    .insert(organizations)
    .values({
      name: parsed.data.organizationName
    })
    .returning({ id: organizations.id });

  await db.insert(organizationMembers).values({
    organizationId: organization.id,
    userId: user.id,
    role: "owner"
  });

  const authenticated = await authenticateUserWithPassword(
    parsed.data.email,
    parsed.data.password
  );
  if (!authenticated) {
    return {
      success: false,
      error: "Failed to create admin session."
    };
  }

  const cookieStore = await cookies();
  cookieStore.set("session_auth", authenticated.cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: authenticated.maxAgeSeconds
  });

  return { success: true };
}

export async function loginWithPasswordAction(
  input: z.infer<typeof passwordLoginSchema>
) {
  const parsed = passwordLoginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid credentials"
    };
  }

  const authenticated = await authenticateUserWithPassword(
    parsed.data.email,
    parsed.data.password
  );

  if (!authenticated) {
    return {
      success: false,
      error: "Invalid email or password"
    };
  }

  await ensurePersonalOrgForUser(authenticated.user);

  const cookieStore = await cookies();
  cookieStore.set("session_auth", authenticated.cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: authenticated.maxAgeSeconds
  });

  return { success: true };
}

export async function createInviteLinkAction(input: z.infer<typeof inviteSchema>) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const owner = await isOrgOwner(user.id);
  if (!owner) {
    return { success: false, error: "Only organization owners can invite users." };
  }

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid email"
    };
  }

  const org = await getRequiredUserOrg(user.id);
  const invite = await createOrgInvite(org.organizationId, user.id, parsed.data.email);
  const appBaseUrl = resolveAppBaseUrl();
  return {
    success: true,
    inviteUrl: `${appBaseUrl}/invite/accept?token=${encodeURIComponent(invite.token)}`
  };
}

export async function acceptInviteAction(input: z.infer<typeof acceptInviteSchema>) {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid invite"
    };
  }

  const accepted = await consumeOrgInviteWithPassword(
    parsed.data.token,
    parsed.data.password,
    parsed.data.name
  );
  if (!accepted) {
    return {
      success: false,
      error: "Invite is invalid or expired"
    };
  }

  const cookieStore = await cookies();
  cookieStore.set("session_auth", accepted.cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: accepted.maxAgeSeconds
  });

  return { success: true };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const existingCookie = cookieStore.get("session_auth")?.value;
  await revokeSessionFromCookie(existingCookie);
  cookieStore.delete("session_auth");
}

export async function updateAccountProfileAction(
  input: z.infer<typeof accountProfileSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = accountProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input"
    };
  }

  const authenticated = await authenticateUserWithPassword(
    user.email,
    parsed.data.currentPassword
  );
  if (!authenticated) {
    return { success: false, error: "Current password is invalid." };
  }

  await updateUserProfile(user.id, {
    email: parsed.data.email,
    name: parsed.data.name
  });

  revalidatePath("/app/settings");
  return { success: true };
}

export async function updateAccountPasswordAction(
  input: z.infer<typeof accountPasswordSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = accountPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input"
    };
  }

  const authenticated = await authenticateUserWithPassword(
    user.email,
    parsed.data.currentPassword
  );
  if (!authenticated) {
    return { success: false, error: "Current password is invalid." };
  }

  await updateUserPassword(user.id, parsed.data.newPassword);
  return { success: true };
}
