/**
 * Shared admin auth for the internal admin tools (/admin/fulfil,
 * /admin/catalogue).
 *
 * Auth model: every admin API request must carry the ADMIN_FULFILMENT_KEY
 * server secret in an `x-admin-key` header. Compared in constant time (both
 * sides SHA-256'd so timingSafeEqual always gets equal-length buffers).
 * Fail-closed: if the env var is unset, everything is 401.
 *
 * Because this imports `node:crypto`, any route that uses isAuthorized() must
 * declare `export const runtime = "nodejs"`.
 */

import crypto from "node:crypto";

export function isAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_FULFILMENT_KEY;
  const provided = request.headers.get("x-admin-key");
  if (!expected || !provided) return false;
  // Hash both sides so timingSafeEqual gets equal-length buffers regardless of
  // what the caller sent.
  const a = crypto.createHash("sha256").update(expected).digest();
  const b = crypto.createHash("sha256").update(provided).digest();
  return crypto.timingSafeEqual(a, b);
}
