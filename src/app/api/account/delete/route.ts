/**
 * POST /api/account/delete — self-serve account deletion (POPIA-friendly).
 *
 * The verified session IS the authorisation: a user can delete exactly the
 * account they're signed in to, nothing is read from the body. Deletion runs
 * via the service-role admin API; the schema does the rest —
 *
 *   profiles        → removed (ON DELETE CASCADE from auth.users)
 *   wishlist_items  → removed (ON DELETE CASCADE)
 *   orders.user_id  → NULL    (ON DELETE SET NULL — order records are kept
 *                              for accounting, no longer linked to a person)
 *
 * The client signs out afterwards; the orphaned access token isn't a leak
 * vector because every row it could reach is gone or detached.
 */

export const runtime = "nodejs";

import { getVerifiedUser } from "@/lib/auth/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST() {
  const user = await getVerifiedUser();
  if (!user) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("account/delete: deleteUser failed", error);
    return Response.json({ error: "service_error" }, { status: 500 });
  }

  return Response.json({ success: true }, { status: 200 });
}
