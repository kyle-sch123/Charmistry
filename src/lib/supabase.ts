/**
 * Browser-safe Supabase client (anon key).
 *
 * Use for catalogue reads from Server Components, Client Components, and
 * the shared queries.ts module. The anon key is exposed to the browser by
 * design; RLS on the Supabase side is what restricts what it can do.
 *
 * For privileged writes (orders, discount RPCs, etc.) use createServerSupabase()
 * from supabase-server.ts instead — it holds the service role key.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
