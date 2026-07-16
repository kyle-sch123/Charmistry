/**
 * Account settings — server shell. Fetches the profile under RLS and hands
 * everything to the client component, which writes updates back through the
 * browser client (also under RLS — own-row update policy).
 */

import { createAuthServerClient } from "@/lib/auth/server";
import type { Profile } from "@/types";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const supabase = await createAuthServerClient();

  const [{ data: userData }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("*").maybeSingle<Profile>(),
  ]);

  return (
    <SettingsClient
      email={userData.user?.email ?? null}
      profile={profile ?? null}
    />
  );
}
