/**
 * Cookie-backed Supabase browser client — the ONLY client that owns auth
 * state in the browser.
 *
 * Sessions live in cookies (via @supabase/ssr) so Server Components, Route
 * Handlers, and middleware can all see them. The plain anon singleton in
 * src/lib/supabase.ts is for catalogue reads only and has its auth machinery
 * disabled — creating a second session-owning GoTrue client would make the
 * two fight over storage.
 */

import { createBrowserClient } from "@supabase/ssr";

export function getAuthBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
