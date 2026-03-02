import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLinkToken } from "@/lib/auth-service";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const nonce = request.nextUrl.searchParams.get("nonce") ?? "";
  const cookieStore = await cookies();
  const nonceCookie = cookieStore.get("magic_link_nonce")?.value;

  if (!nonce || !nonceCookie || nonce !== nonceCookie) {
    cookieStore.delete("magic_link_nonce");
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired", request.url));
  }

  const consumed = await consumeMagicLinkToken(token);

  if (!consumed) {
    cookieStore.delete("magic_link_nonce");
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired", request.url));
  }

  cookieStore.delete("magic_link_nonce");
  cookieStore.set("session_auth", consumed.cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: consumed.maxAgeSeconds
  });

  return NextResponse.redirect(new URL("/app", request.url));
}
