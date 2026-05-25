alter table public.orders
  add column if not exists shipping_status text not null default 'pending';

alter table public.orders
  add column if not exists courier text;

alter table public.orders
  add column if not exists tracking_number text;

alter table public.orders
  add column if not exists tracking_url text;

alter table public.orders
  add column if not exists waybill_number text;

alter table public.orders
  add column if not exists shipped_at timestamptz;
