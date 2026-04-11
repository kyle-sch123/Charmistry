import { createClient } from "@supabase/supabase-js";

// Service-role client for trusted server-side work (orders, ITN webhook).
// NEVER import this from a Client Component or expose the key to the browser.
export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase server client misconfigured: missing URL or service role key");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
