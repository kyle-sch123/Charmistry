-- ============================================================================
-- Baseline schema — Charmistry catalogue, discount codes, and supporting types
--
-- This migration creates everything 001_orders.sql depends on (it references
-- public.products) plus the discount_codes table that /api/checkout and
-- /api/subscribe write to. It is intentionally numbered 000 so it runs first
-- on a fresh database while leaving the historical 001/002/003 numbering
-- alone for projects that have already applied them.
--
-- Idempotent — every CREATE uses IF NOT EXISTS and types are guarded with
-- DO blocks, so it is safe to re-run on a partially-populated database.
-- ============================================================================

-- ---- Enum types ----------------------------------------------------------

do $$ begin
  create type metal_type as enum ('gold', 'silver', 'rose_gold', 'white_gold', 'platinum');
exception when duplicate_object then null; end $$;

do $$ begin
  create type badge_type as enum ('NEW', 'BESTSELLER', 'LIMITED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type discount_type as enum ('percentage', 'fixed');
exception when duplicate_object then null; end $$;

-- ---- categories ----------------------------------------------------------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists categories_slug_idx on public.categories (slug);

-- ---- products ------------------------------------------------------------
-- One row per (name, metal). The shop grid collapses variants by name +
-- category; the PDP exposes the metals as a swatch picker.
-- Note: material and size are also added by migration 003 with IF NOT EXISTS,
-- so applying 003 after this baseline is a no-op.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  category_id uuid references public.categories(id) on delete set null,
  metal metal_type,
  badge badge_type,
  material text,
  size text,
  image_url text,
  images text[] not null default '{}',
  in_stock boolean not null default true,
  rating numeric(3, 2) check (rating is null or (rating >= 0 and rating <= 5)),
  review_count integer not null default 0 check (review_count >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now()
);

create index if not exists products_slug_idx on public.products (slug);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_in_stock_idx on public.products (in_stock);
create index if not exists products_metal_idx on public.products (metal);
create index if not exists products_name_idx on public.products (name);

-- ---- discount_codes ------------------------------------------------------
-- Read-only resolution via lib/discounts.resolveDiscount() — atomic
-- redemption via the redeem_discount_code RPC (migration 004).

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type discount_type not null,
  discount_value numeric(10, 2) not null check (discount_value >= 0),
  min_order_amount numeric(10, 2) not null default 0 check (min_order_amount >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists discount_codes_code_idx on public.discount_codes (code);
create index if not exists discount_codes_email_active_idx on public.discount_codes (email, active);

-- ---- Row-Level Security --------------------------------------------------
-- Anon role can READ catalogue (categories, products) for the public site.
-- discount_codes is service-role only — clients hit it via /api/discount/validate.

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.discount_codes enable row level security;

do $$ begin
  create policy "categories_anon_read" on public.categories
    for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "products_anon_read" on public.products
    for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;

-- No public policies for discount_codes — only service role can read/write.
