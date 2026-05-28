/**
 * Canonicalise an email so addresses that resolve to the same inbox compare
 * equal. Used by /api/subscribe to enforce one welcome code per real inbox.
 *
 * The canonical form is stored alongside the raw email in
 * `discount_codes.email_canonical`; a partial unique index on that column
 * (active rows only) makes the "already subscribed?" check race-safe at the
 * DB layer and closes the alias-abuse path that the application-level
 * `.eq("email", …)` lookup left open.
 *
 * Rules — intentionally narrow, only the cases we observe in practice:
 *  - Trim, then lowercase.
 *  - Strip plus-addressing — everything from `+` to `@` in the local-part.
 *    So `bob+anything@example.com` collapses to `bob@example.com`.
 *  - Gmail-only: `googlemail.com` is rewritten to `gmail.com`, and dots in
 *    the local-part are removed (Gmail treats them as identical). So
 *    `b.o.b@googlemail.com` collapses to `bob@gmail.com`.
 *
 * Non-goals: full RFC 5321 normalisation, quoted local-parts, IDN domains.
 * Callers should have already shape-validated the address (EMAIL_RE).
 *
 * The SQL backfill in `supabase/migrations/005_email_canonical.sql` mirrors
 * these rules. Keep the two in sync.
 */
export function canonicaliseEmail(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const atIdx = trimmed.lastIndexOf("@");
  if (atIdx === -1) return trimmed;
  let local = trimmed.slice(0, atIdx);
  let domain = trimmed.slice(atIdx + 1);
  const plusIdx = local.indexOf("+");
  if (plusIdx !== -1) local = local.slice(0, plusIdx);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}
