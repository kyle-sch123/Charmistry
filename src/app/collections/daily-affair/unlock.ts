/**
 * Server action behind the Daily Affair password form.
 *
 * Kept as a plain <form action={...}> submit rather than a client fetch so the
 * gate works with JavaScript disabled and the password never touches the
 * client bundle — the comparison happens here, on the server, and only a
 * hashed unlock token ever goes back to the browser.
 */

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DAILY_AFFAIR_COOKIE,
  DAILY_AFFAIR_COOKIE_MAX_AGE,
  dailyAffairPassword,
  passwordMatches,
  unlockToken,
} from "@/lib/auth/daily-affair-gate";

const PATH = "/collections/daily-affair";

export async function unlockDailyAffair(formData: FormData) {
  const provided = String(formData.get("password") ?? "");

  if (!(await passwordMatches(provided))) {
    // Bounce back with a flag rather than returning state, so the wrong-password
    // message survives without making the gate a client component.
    redirect(`${PATH}?locked=1`);
  }

  const secret = dailyAffairPassword();
  if (!secret) redirect(PATH);

  const jar = await cookies();
  jar.set(DAILY_AFFAIR_COOKIE, await unlockToken(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: PATH,
    maxAge: DAILY_AFFAIR_COOKIE_MAX_AGE,
  });

  redirect(PATH);
}
