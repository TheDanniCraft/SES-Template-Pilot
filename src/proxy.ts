import { NextResponse, type NextRequest } from "next/server";
import { validateSessionCookie } from "@/lib/auth-cookie";
import { getAppPassword } from "@/lib/app-password";

const PUBLIC_PATHS = ["/login", "/_next", "/favicon.ico"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const expectedPassword = getAppPassword();
  if (!expectedPassword) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cookieValue = request.cookies.get("session_auth")?.value;
  if (!cookieValue) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isValid = await validateSessionCookie(cookieValue, expectedPassword);
  if (!isValid) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"]
};
