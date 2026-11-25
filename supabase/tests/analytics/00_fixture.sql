-- Test fixture for 014_analytics.sql: a minimal stand-in for the shop schema.
--
-- ONLY for a throwaway Postgres (PGlite or a fresh local database). Never run
-- this against the real project: it creates roles and bare copies of the shop
-- tables. Apply order: 00_fixture.sql, then ../../migrations/014_analytics.sql
-- (twice, to prove it is idempotent), then 01_analytics.test.sql.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

do $$ begin
  create type order_status as enum ('pending', 'paid', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.products (
  id uuid primary key,
  name text not null,
  slug text not null unique
);

create table if not exists public.orders (
  id uuid primary key,
  email text not null,
  first_name text not null,
  last_name text not null,
  total numeric(10, 2) not null,
  status order_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  discount_code text,
  discount_amount numeric not null default 0
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_slug text not null,
  unit_price numeric(10, 2) not null,
  quantity integer not null,
  line_total numeric(10, 2) not null
);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_at timestamptz not null default now()
);
