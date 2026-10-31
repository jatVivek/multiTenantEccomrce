import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge-safe middleware: No Node.js or Drizzle/pg imports
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip Next.js internal paths and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Admin Routes Protection & Isolation
  if (pathname === "/admin/login") {
    const token = request.cookies.get("admin_token")?.value;
    if (token) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const token = request.cookies.get("admin_token")?.value;
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    const response = NextResponse.next();
    response.headers.set("x-is-admin", "true");
    return response;
  }

  // 3. Root path redirects to the first featured brand
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/urban-streetwear";
    return NextResponse.redirect(url);
  }

  // 4. Storefront brand routes: forward with header
  const slug = pathname.split("/")[1];
  const response = NextResponse.next();
  if (slug) {
    response.headers.set("x-brand-slug", slug);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
