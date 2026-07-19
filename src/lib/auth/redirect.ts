/**
 * Post-auth redirect target sanitiser.
 *
 * The `next` query param flows through /login, /auth/callback, and
 * /auth/confirm. Anything that isn't a same-site path ("/x", not "//evil.com"
 * or "https://evil.com") would turn the auth flow into an open redirect, so
 * everything else collapses to the fallback.
 */

export function sanitizeNextPath(
  raw: string | null | undefined,
  fallback = "/account",
): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
}
