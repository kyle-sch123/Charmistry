-- ============================================================================
-- products.shop_featured — which metal variant represents a piece on /shop.
--
-- The catalogue stores one row per (name, metal), but the shop grid, search and
-- the stack builder all consolidate those rows into ONE card per piece (see
-- pickPieceRepresentatives in lib/pieces.ts). Until now that card was simply
-- the first variant in sort order, so the photo — and the metal — shoppers saw
-- was effectively arbitrary, and the owner had no way to choose it. This flag
-- makes that choice explicit and editable from /admin/catalogue.
--
-- Exactly one row per piece should carry the flag. /api/admin/products
-- (op:"shop_image") clears it across the piece before setting the chosen row,
-- and the storefront falls back to the old first-in-sort-order behaviour when
-- no row is flagged — so deploying this before anything is chosen changes
-- nothing, and the column is safe to add ahead of the app code.
-- ============================================================================

alter table public.products
  add column if not exists shop_featured boolean not null default false;

-- Partial index: the storefront only ever looks for the flagged rows, and in a
-- catalogue where one row per piece is flagged that is a small slice.
create index if not exists products_shop_featured_idx
  on public.products (shop_featured)
  where shop_featured;
