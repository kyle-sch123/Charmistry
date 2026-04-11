-- Charmistry orders schema
-- Run this in the Supabase SQL editor (project: qkgakhluqruqoifknprg).

create type order_status as enum ('pending', 'paid', 'failed', 'cancelled');

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  shipping_address_line1 text not null,
  shipping_address_line2 text,
  shipping_city text not null,
  shipping_postal_code text not null,
  shipping_country text not null default 'ZA',
  subtotal numeric(10, 2) not null,
  shipping_cost numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  currency text not null default 'ZAR',
  status order_status not null default 'pending',
  payfast_payment_id text,
  payfast_pf_payment_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists orders_email_idx on public.orders (email);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_slug text not null,
  product_image_url text,
  unit_price numeric(10, 2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- Keep updated_at fresh
create or replace function public.set_orders_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_orders_updated_at();

-- RLS: orders are only accessed by the service role (server-side).
-- Enable RLS with no public policies so the anon key cannot read/write.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
