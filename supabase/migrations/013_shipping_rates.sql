-- ============================================================================
-- 013_shipping_rates.sql
--
-- Owner-editable shipping prices. Until now the flat price of each delivery
-- method lived only in code (SHIPPING_METHODS in src/lib/shipping.ts), so
-- changing what Locker-to-Locker or Standard Economy costs meant a deploy. The
-- owner now sets them in /admin/catalogue → Shipping prices.
--
-- One row per method, keyed by the same id the orders table records in
-- orders.shipping_method ('pudo_locker' | 'courier_economy'). The code keeps
-- its built-in prices as the DEFAULTS: a method with no row here — or this
-- whole table missing, i.e. app deployed before this migration — is charged
-- its default, so checkout never breaks on deploy order.
--
-- Seeded with the prices the shop charges today (R59 / R79), so applying this
-- migration changes nothing a customer sees.
--
-- What this does NOT hold: the free-delivery thresholds (R500 locker, R700 any
-- method). Those stay in code, because the cart drawer's free-delivery bar
-- renders on every page from those constants.
--
-- RLS: public SELECT, like products and categories — the prices are shown at
-- checkout anyway, and the checkout page reads them with the anon client. NO
-- write policies: only the service role (/api/admin/shipping, behind the admin
-- key) can change a price.
--
-- Idempotent — safe to re-run. Re-running does NOT reset prices the owner has
-- changed (the seed is ON CONFLICT DO NOTHING).
-- ============================================================================

create table if not exists public.shipping_rates (
  method_id  text primary key,
  -- Above zero: a R0 method would read "Free" at checkout while the cart's
  -- free-delivery bar (driven by the thresholds) still asked for more spend.
  price      numeric(10, 2) not null check (price > 0),
  updated_at timestamptz not null default now()
);

comment on table public.shipping_rates is
  'Flat price (ZAR) per shipping method, edited in /admin/catalogue. A method with no row is charged its default from src/lib/shipping.ts. Free-delivery thresholds are not stored here.';
comment on column public.shipping_rates.method_id is
  'Shipping method id: pudo_locker | courier_economy (same ids as orders.shipping_method).';

alter table public.shipping_rates enable row level security;

do $$
begin
  create policy "shipping_rates_anon_read" on public.shipping_rates
    for select using (true);
exception when duplicate_object then null;
end $$;

insert into public.shipping_rates (method_id, price)
values ('pudo_locker', 59), ('courier_economy', 79)
on conflict (method_id) do nothing;
