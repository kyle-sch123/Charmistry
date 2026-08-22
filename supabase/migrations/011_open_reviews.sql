-- ============================================================================
-- 011_open_reviews.sql
--
-- Reviews are no longer purchase-gated. Any signed-in account may review any
-- piece; the gate in /api/reviews (a PAID order containing the piece) is gone,
-- because it left genuine customers unable to review — guest checkouts, gifts,
-- orders placed on another account — and kept the review count near zero.
--
-- Nothing about the SCHEMA changes: writes still go through the service role in
-- /api/reviews, user_id stays NOT NULL (sign-in is still required, which is
-- what keeps an unauthenticated, unrate-limited write endpoint off the table),
-- and the RLS policies are untouched. This migration exists solely so the
-- table's own comment stops describing a rule the API no longer enforces.
-- ============================================================================

comment on table public.reviews is
  'Product reviews. Written only by the service role via /api/reviews, which requires a signed-in session but does NOT require a purchase. Readable by everyone. One review per user per piece (enforced across metal variants in the API). author_name is a "First L." snapshot taken from the reviewer profile at submit time.';
