/**
 * Detecting "analytics isn't set up yet" (migration 014 not applied).
 *
 * Why this exists: the app can deploy before the database migration runs.
 * Until it does, the tracker's beacons are silently dropped, checkout and the
 * PayFast ITN skip their analytics side-effects, and the admin dashboard shows
 * a designed "Analytics isn't set up yet" panel. That panel is an expected
 * product state, not an error, so the admin APIs answer it with HTTP 200.
 *
 * PostgREST reports a missing function as PGRST202, a missing table as
 * PGRST205; Postgres itself uses 42883 (undefined function) and 42P01
 * (undefined table).
 */

import { ANALYTICS_RPC } from "./rpc";

export const ANALYTICS_MIGRATION = "014_analytics.sql";
export const MISSING_SCHEMA_CODES: ReadonlySet<string> = new Set([
  "42P01",
  "PGRST205",
  "PGRST202",
  "42883",
]);

export function isAnalyticsMissingError(
  e: { code?: string } | null | undefined,
): boolean {
  return Boolean(e && typeof e.code === "string" && MISSING_SCHEMA_CODES.has(e.code));
}

export interface SetupRequired {
  status: "setup_required";
  missing: string[];
  migration: string;
}

/** The functions that were not found, for the admin's "Copy setup details". */
export function missingFunctions(failed: string[]): string[] {
  const known = new Set<string>(Object.values(ANALYTICS_RPC));
  const list = failed.filter((f) => known.has(f));
  return list.length > 0 ? Array.from(new Set(list)).sort() : Object.values(ANALYTICS_RPC).sort();
}

export function setupRequiredResponse(missing: string[]): Response {
  const body: SetupRequired = {
    status: "setup_required",
    missing,
    migration: ANALYTICS_MIGRATION,
  };
  return Response.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

const logged = new Set<string>();

/** Log an analytics DB problem once per isolate per context and code. Never logs payloads or PII. */
export function logAnalyticsErrorOnce(
  context: string,
  e: { code?: string; message?: string } | null | undefined,
): void {
  const code = e?.code ?? "unknown";
  const key = `${context}:${code}`;
  if (logged.has(key)) return;
  logged.add(key);
  console.warn(
    `[analytics] ${context} failed (${code})${
      isAnalyticsMissingError(e) ? `: apply ${ANALYTICS_MIGRATION}` : ""
    }`,
  );
}
