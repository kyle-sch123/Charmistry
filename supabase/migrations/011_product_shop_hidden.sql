-- ============================================================================
-- products.shop_hidden — keep a product out of the shop's browse surfaces.
--
-- The sibling flag from migration 010, shop_featured, answers "WHICH variant
-- represents this piece on /shop". This one answers a different question the
-- owner had no way to express: "should this piece appear on /shop AT ALL".
--
-- The case that forced it: a collection's products have to exist in the
-- catalogue before the collection launches — the collection page reads them by
-- slug for live prices, stock and working cart rows — but /shop lists
-- out-of-stock products by default, so creating them published ten unannounced
-- pieces onto the live shop grid. Setting in_stock = false would have hidden
-- them from nothing and broken the cart; this flag is the honest control.
--
-- Hidden means hidden from BROWSE AND DISCOVERY (the /shop grid, search, the
-- stack builder, related products, best sellers). It deliberately does NOT
-- touch getProductBySlug, so the product page stays reachable and any direct
-- link — a collection page, an email, an existing cart — keeps working.
--
-- `not null default false` makes this a no-op on deploy: every existing row is
-- visible, exactly as before, and the column is safe to add ahead of the app
-- code.
-- ============================================================================

alter table public.products
  add column if not exists shop_hidden boolean not null default false;

-- Partial index on the hidden rows only. The storefront filters
-- `shop_hidden = false`, which is almost every row, so an index over the whole
-- column would never be used; indexing the small hidden slice lets the planner
-- use an anti-join when the catalogue grows.
create index if not exists products_shop_hidden_idx
  on public.products (shop_hidden)
  where shop_hidden;
