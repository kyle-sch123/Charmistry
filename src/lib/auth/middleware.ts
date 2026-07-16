/**
 * Session refresh + route guarding, called from src/middleware.ts.
 *
 * Follows the @supabase/ssr middleware pattern: build a response up front,
 * mirror every cookie the client refreshes onto both the forwarded request
 * and the response, and make no auth decision before getClaims() has run.
 *
 * Guards (the matcher in src/middleware.ts limits us to these paths):
 *   signed-out on /account/** -> /login?next=<path>
 *   signed-in  on /login      -> /account (or a sanitised ?next)
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNextPath } from "./redirect";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session if expired. Do not run logic between client
  // creation and this call — the cookie mirroring above depends on it.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  const path = request.nextUrl.pathname;

  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    const [pathname, query] = target.split("?");
    url.pathname = pathname;
    url.search = query ? `?${query}` : "";
    const redirect = NextResponse.redirect(url);
    // Carry any refreshed session cookies onto the redirect response.
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    return redirect;
  };

  if (!isSignedIn && (path === "/account" || path.startsWith("/account/"))) {
    return redirectTo(`/login?next=${encodeURIComponent(path)}`);
  }

  if (isSignedIn && path === "/login") {
    return redirectTo(
      sanitizeNextPath(request.nextUrl.searchParams.get("next")),
    );
  }

  return supabaseResponse;
}
