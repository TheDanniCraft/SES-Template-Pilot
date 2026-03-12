import { NextResponse, type NextRequest } from "next/server";
import { parseSessionCookie } from "@/lib/auth-cookie";

const PUBLIC_EXACT_PATHS = ["/", "/favicon.ico", "/robots.txt", "/sitemap.xml"];
const PUBLIC_PREFIX_PATHS = ["/login", "/setup", "/invite", "/_next", "/api/webhooks/ses"];

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT_PATHS.includes(pathname)) {
    return true;
  }

  return PUBLIC_PREFIX_PATHS.some((path) => pathname.startsWith(path));
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return withSecurityHeaders(NextResponse.next());
  }

  const cookieValue = request.cookies.get("session_auth")?.value;
  if (!cookieValue) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const parsed = await parseSessionCookie(cookieValue);
  if (!parsed) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"]
};
