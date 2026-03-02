"use server";

import { cookies } from "next/headers";
import { createSessionCookie } from "@/lib/auth-cookie";
import { getAppPassword } from "@/lib/app-password";
import { loginSchema, type LoginInput } from "@/lib/validators";

export async function loginAction(input: LoginInput) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input"
    };
  }

  const configuredPassword = getAppPassword();
  if (!configuredPassword) {
    return {
      success: false,
      error: "APP_PASSWORD is not configured"
    };
  }

  if (parsed.data.password !== configuredPassword) {
    return {
      success: false,
      error: "Invalid password"
    };
  }

  const value = await createSessionCookie(configuredPassword);
  const cookieStore = await cookies();
  cookieStore.set("session_auth", value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return { success: true };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session_auth");
}
