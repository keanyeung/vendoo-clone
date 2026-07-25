import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

// In Next.js 16, "Proxy" replaces "Middleware". This performs an optimistic
// auth check on the session cookie and redirects unauthenticated users to
// /login (and authenticated users away from /login).

const PUBLIC_PATHS = ["/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const token = req.cookies.get("session")?.value;
  const session = await decrypt(token);
  const authed = session?.auth === true;

  if (!authed && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
