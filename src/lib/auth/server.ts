/**
 * User-scoped Supabase server client (anon key + the caller's session
 * cookies). Queries run under RLS as the signed-in user — use this for
 * everything in the /account area so the database, not the page code, is
 * what scopes data to its owner.
 *
 * For privileged writes that bypass RLS, keep using createServerSupabase()
 * from supabase-server.ts (service role).
 *
 * Never derive auth decisions from getSession() on the server — it reads the
 * cookie without verifying it. getVerifiedUser() goes through auth.getUser(),
 * which validates the JWT against the auth server.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

export async function createAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components may not write cookies. Safe to ignore:
            // middleware refreshes sessions for every /account and /login
            // request, so the cookie a Server Component would have written
            // has already been set.
          }
        },
      },
    },
  );
}

/** The signed-in user, verified against the auth server, or null. */
export async function getVerifiedUser(): Promise<User | null> {
  try {
    const supabase = await createAuthServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  } catch {
    return null;
  }
}
