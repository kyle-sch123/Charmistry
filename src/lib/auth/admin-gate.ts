/**
 * Password gate for /admin/** — HTTP Basic Auth enforced in middleware so the
 * admin page shells never render for an unauthenticated visitor. This is the
 * single front door in front of every admin tool (fulfilment today, catalogue +
 * dashboard once they merge). Each admin *API* keeps its own key check behind
 * it; this only guards the pages.
 *
 * Secret: ADMIN_PASSWORD if set, otherwise the existing ADMIN_FULFILMENT_KEY so
 * the gate works with zero new config (that secret is already provisioned in
 * prod). Fail-closed: with neither set, every /admin request is 401.
 *
 * The username half of the Basic credential is ignored — only the password is
 * checked, in constant time (SHA-256 both sides via Web Crypto, the only crypto
 * primitive available in the Edge middleware runtime; node:crypto is not).
 */

import { NextResponse, type NextRequest } from "next/server";

const REALM = "Charmistry Admin";

/**
 * Pull the password out of an `Authorization: Basic <base64(user:pass)>` header.
 * Returns null for a missing, non-Basic, or malformed header. The password may
 * itself contain colons — only the first colon separates user from password.
 */
export function extractBasicPassword(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [scheme, encoded] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "basic" || !encoded) return null;

  let decoded: string;
  try {
    decoded = atob(encoded.trim());
  } catch {
    return null; // not valid base64
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) return null;
  return decoded.slice(sep + 1);
}

/**
 * Constant-time string equality. Compares SHA-256 digests so neither the
 * password's length nor its content leaks through comparison timing.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

/** 401 that makes the browser show its native password prompt for the realm. */
function challenge(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Content-Type": "text/plain; charset=utf-8",
      // Never let a browser or CDN cache the challenge or a rejected attempt.
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Allow the request through only when it carries the correct Basic-Auth
 * password; otherwise return a 401 challenge. Called from src/middleware.ts for
 * every /admin path.
 */
export async function guardAdmin(request: NextRequest): Promise<NextResponse> {
  const expected =
    process.env.ADMIN_PASSWORD || process.env.ADMIN_FULFILMENT_KEY;
  // Fail closed: no secret configured means nobody gets in.
  if (!expected) return challenge();

  const provided = extractBasicPassword(request.headers.get("authorization"));
  if (!provided) return challenge();

  if (!(await timingSafeEqual(provided, expected))) return challenge();

  return NextResponse.next();
}
