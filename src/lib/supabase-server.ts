/**
 * Service-role Supabase client factory.
 *
 * Bypasses RLS. Use ONLY from API routes that need to write orders, consume
 * discount codes, or upsert anything privileged. The service-role key must
 * never be imported into a Client Component — that would ship it to the
 * browser bundle.
 *
 * Auth session persistence is disabled because each request gets a fresh
 * client; we don't want lingering auth state.
 */

import { createClient } from "@supabase/supabase-js";

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
