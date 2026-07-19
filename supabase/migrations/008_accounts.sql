-- ============================================================================
-- Customer accounts: profiles, order ownership, and wishlists.
--
-- Supabase Auth (Google OAuth + email OTP) backs the new /account area. This
-- migration adds everything the feature needs on the DB side:
--
--   profiles        one row per auth user (created by trigger on signup),
--                   holding editable details + the default shipping address
--                   used to prefill checkout, and the marketing opt-in flag.
--   orders.user_id  nullable owner. Stamped by /api/checkout for signed-in
--                   buyers; back-filled for past guest orders by the claim
--                   helper (exact lowercase email match on a VERIFIED auth
--                   email, service role only). ON DELETE SET NULL keeps order
--                   records after account deletion (POPIA/accounting).
--   wishlist_items  (user_id, product_id) pairs, written directly from the
--                   browser under RLS.
--
-- RLS model: customers get row-scoped SELECT on orders/order_items and full
-- own-row control of profiles (update) and wishlist_items (select/insert/
-- delete). All order WRITES stay service-role only — checkout, the PayFast
-- ITN, and the fulfilment console are untouched by these policies. Guest
-- orders (user_id IS NULL) remain invisible to every client role.
--
-- Idempotent — safe to re-run (if-not-exists / duplicate_object guards).
-- ============================================================================

-- ---- profiles --------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  marketing_opt_in boolean not null default false,
  default_address_line1 text,
  default_address_line2 text,
  default_city text,
  default_postal_code text,
  default_country text not null default 'ZA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth.users row, created by the on_auth_user_created trigger. Holds account details editable by the owner and the default shipping address used to prefill checkout.';

alter table public.profiles enable row level security;

do $$ begin
  create policy "profiles_own_select" on public.profiles
    for select to authenticated
    using ((select auth.uid()) = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_own_update" on public.profiles
    for update to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);
exception when duplicate_object then null; end $$;

-- No INSERT/DELETE policies: rows are created by the signup trigger below
-- (or the service role) and removed by the ON DELETE CASCADE from auth.users.

-- Pinned search_path (the 001 orders version predates the linter rule).
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();

-- Create the profile row at signup. SECURITY DEFINER because the trigger
-- fires as the auth admin, which has no INSERT policy on profiles. Google
-- supplies given_name/family_name (fall back to splitting full_name); email
-- OTP signups start blank and fill their details in /account/settings.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    nullif(coalesce(
      new.raw_user_meta_data->>'given_name',
      split_part(coalesce(new.raw_user_meta_data->>'full_name',
                          new.raw_user_meta_data->>'name', ''), ' ', 1)
    ), ''),
    nullif(coalesce(
      new.raw_user_meta_data->>'family_name',
      nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name',
                                     new.raw_user_meta_data->>'name', ''),
                            '^\S+\s*', ''), '')
    ), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Supabase grants EXECUTE to anon/authenticated directly (not via PUBLIC),
-- so revoke from each role explicitly or the security advisor flags it.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- orders ownership ------------------------------------------------------

alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

comment on column public.orders.user_id is
  'Owning auth user. NULL for guest orders and after account deletion (order records are retained). Stamped server-side only — never from client input.';

create index if not exists orders_user_id_idx on public.orders (user_id);

do $$ begin
  create policy "orders_own_select" on public.orders
    for select to authenticated
    using ((select auth.uid()) = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "order_items_own_select" on public.order_items
    for select to authenticated
    using (
      exists (
        select 1 from public.orders o
        where o.id = order_items.order_id
          and o.user_id = (select auth.uid())
      )
    );
exception when duplicate_object then null; end $$;

-- ---- wishlist ---------------------------------------------------------------

create table if not exists public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

comment on table public.wishlist_items is
  'Saved products per user. Written directly from the browser client; RLS scopes every operation to the owner.';

-- Covers the FK scan when a product row is deleted.
create index if not exists wishlist_items_product_id_idx
  on public.wishlist_items (product_id);

alter table public.wishlist_items enable row level security;

do $$ begin
  create policy "wishlist_own_select" on public.wishlist_items
    for select to authenticated
    using ((select auth.uid()) = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "wishlist_own_insert" on public.wishlist_items
    for insert to authenticated
    with check ((select auth.uid()) = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "wishlist_own_delete" on public.wishlist_items
    for delete to authenticated
    using ((select auth.uid()) = user_id);
exception when duplicate_object then null; end $$;
