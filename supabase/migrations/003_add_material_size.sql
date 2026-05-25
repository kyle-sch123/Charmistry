-- Add material and size columns to products table
alter table public.products add column if not exists material text;
alter table public.products add column if not exists size text;
