-- ============================================================================
-- Product reviews — purchase-gated ratings + written reviews.
--
-- One row per (user, product) a customer has reviewed. Reviews are scoped to
-- the logical "piece", not the metal variant: the shop stores one product row
-- per metal, but a review left on any variant is aggregated and displayed
-- across every sibling row sharing the same (name, category_id). That
-- aggregation, the purchase check (a paid order containing the piece), and the
-- one-review-per-piece rule all live in /api/reviews (service role) — reviews
-- are never written directly from the browser.
--
-- author_name is a snapshot ("Emily S.") taken from the reviewer's profile at
-- submit time, so the public read path (anon SELECT below) never has to touch
-- the RLS-protected profiles table.
--
-- The existing products.rating / products.review_count columns (000_baseline)
-- are kept in sync by the API as an aggregate cache — the PDP header and shop
-- cards read them directly.
--
-- RLS model: anyone may READ reviews (public catalogue data, like products).
-- All WRITES are service-role only — no client insert/update/delete policies —
-- because the purchase gate and aggregate recompute must run server-side.
--
-- Idempotent — safe to re-run (if-not-exists / duplicate_object guards).
-- ============================================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text not null check (char_length(btrim(body)) > 0),
  author_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reviews is
  'Purchase-gated product reviews. Written only by the service role via /api/reviews (verifies a paid order for the piece); readable by everyone. author_name is a "First L." snapshot taken from the reviewer profile at submit time.';

-- One review per user per variant row. Piece-level uniqueness (across metal
-- variants) is enforced in the API — this constraint is a secondary guard
-- against duplicate rows on the same variant.
do $$ begin
  alter table public.reviews
    add constraint reviews_user_product_unique unique (user_id, product_id);
exception when duplicate_object then null; end $$;

create index if not exists reviews_product_id_idx on public.reviews (product_id);
create index if not exists reviews_user_id_idx on public.reviews (user_id);

-- Keep updated_at fresh (pinned search_path, matching set_profiles_updated_at).
create or replace function public.set_reviews_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reviews_updated_at on public.reviews;
create trigger trg_reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_reviews_updated_at();

alter table public.reviews enable row level security;

-- Public read (catalogue data). No client write policies — all inserts and
-- updates go through the service role in /api/reviews.
do $$ begin
  create policy "reviews_anon_read" on public.reviews
    for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;
