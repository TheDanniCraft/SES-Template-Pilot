"use server";

import { cookies } from "next/headers";
import { createMagicLinkForEmail, revokeSessionFromCookie } from "@/lib/auth-service";
import { createRandomToken } from "@/lib/auth-tokens";
import { resolveAppBaseUrl, sendMagicLinkEmail } from "@/lib/magic-link-mail";
import { loginSchema, type LoginInput } from "@/lib/validators";

export async function requestMagicLinkAction(input: LoginInput) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input"
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const appBaseUrl = resolveAppBaseUrl();
  const nonce = createRandomToken(18);
  const cookieStore = await cookies();
  cookieStore.set("magic_link_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/login/verify",
    maxAge: 60 * 15
  });

  let magicLinkResult: Awaited<ReturnType<typeof createMagicLinkForEmail>>;
  try {
    magicLinkResult = await createMagicLinkForEmail(email, appBaseUrl, nonce);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create magic link"
    };
  }

  const emailResult = await sendMagicLinkEmail({
    email,
    magicLink: magicLinkResult.magicLink
  });

  if (!emailResult.success) {
    return {
      success: false,
      error: emailResult.error ?? "Failed to send magic link"
    };
  }

  return {
    success: true,
    previewUrl: emailResult.delivered ? null : emailResult.previewUrl ?? null
  };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const existingCookie = cookieStore.get("session_auth")?.value;
  await revokeSessionFromCookie(existingCookie);
  cookieStore.delete("session_auth");
}
