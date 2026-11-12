import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route check.
 * Ye sirf dekhta hai ke session cookie maujood hai ya nahi.
 * Asli verification (database, expiry, revoked) pages ke andar
 * getCurrentUser() se hota hai. Proxy par bharosa poora nahi kiya jata.
 */

const SESSION_COOKIE_NAME = "kbr_session";
const PROTECTED_PREFIXES = ["/dashboard"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value
  );

  if (!hasSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
