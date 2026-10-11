import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { isProjectDocPublic, publicDocSlugFromPath } from "@/lib/project-docs";

/**
 * Private by default: every explorer route requires the session cookie. `/api/ingest`
 * is excluded because it carries its own bearer-token auth for the X Bookmarks agent.
 *
 * `/roadmap` and `/changelog` (read paths only) skip the redirect when that
 * ProjectDoc's `isPublic` flag is true in Neo4j. Edit paths and every bookmark
 * or API route stay gated. A graph error fails closed (treat as private).
 */
export const config = {
  matcher: ["/((?!api/ingest|login|_next/static|_next/image|favicon.ico).*)"],
};

export async function proxy(request: NextRequest) {
  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const slug = publicDocSlugFromPath(request.nextUrl.pathname);
  if (slug && (await isProjectDocPublic(slug))) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const target = request.nextUrl.pathname + request.nextUrl.search;
  if (target !== "/") loginUrl.searchParams.set("next", target);

  return NextResponse.redirect(loginUrl);
}
