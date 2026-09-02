-- ============================================================================
-- 012_guest_reviews.sql
--
-- Reviews no longer require an account. Anyone browsing the shop may rate and
-- review any piece; the sign-in requirement in /api/reviews is gone, because
-- asking a shopper to create an account before they can say anything is the
-- single biggest reason the review count stayed near zero.
--
-- One column changes: user_id becomes NULLABLE. A guest review is a row with
-- user_id IS NULL and whatever display name the reviewer typed (or the literal
-- 'Anonymous' when they left the name box blank — author_name stays NOT NULL,
-- the API always writes something).
--
-- What deliberately does NOT change:
--
--   * reviews_user_product_unique UNIQUE (user_id, product_id) is KEPT. In
--     Postgres, NULLs compare as distinct inside a unique index (the default,
--     NULLS DISTINCT), so any number of guest rows may exist for one product
--     while a signed-in account is still held to one review per product row.
--     Piece-level uniqueness for accounts (across metal variants) continues to
--     be enforced in the API.
--
--   * RLS. Public SELECT stays; there are still NO client write policies. Every
--     insert/update/delete goes through the service role in /api/reviews, which
--     owns the aggregate recompute onto products.rating / products.review_count.
--     Opening reviews to guests must not open the TABLE to the browser.
--
--   * The auth.users foreign key, which is now simply not exercised by guest
--     rows. ON DELETE CASCADE still cleans up an account's own reviews if that
--     account is ever deleted; guest reviews are unaffected by that.
--
-- Note on abuse: with the sign-in gate removed this is an unauthenticated write
-- path, and it is intentionally unthrottled — a rate limit was considered and
-- declined. If review spam ever shows up, the rows are ordinary table rows and
-- can be deleted directly; a per-IP guard would go here.
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.reviews alter column user_id drop not null;

comment on column public.reviews.user_id is
  'The reviewing account, or NULL for a guest review left without signing in. Guests cannot edit or delete their review afterwards — there is no identity to scope that to.';

comment on table public.reviews is
  'Product reviews, open to everyone: /api/reviews (service role) accepts them with or without a signed-in session, and requires no purchase. Readable by everyone. Signed-in accounts get one review per piece (enforced across metal variants in the API) plus edit/delete; guests insert a new row each time with user_id NULL. author_name is the name the reviewer typed, falling back to their profile "First L." snapshot when signed in, and finally to ''Anonymous''.';
