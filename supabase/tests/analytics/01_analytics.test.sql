-- Assertions for 014_analytics.sql. Run after 00_fixture.sql and the migration.
-- Each block raises (and stops the run) on the first failed assertion.
--
-- Range under test: 15-21 Nov 2026 SAST = [2026-11-14T22:00Z, 2026-11-21T22:00Z).
--   S1 (V1, mobile, Mon 16 Nov 12:00 SAST): Instagram campaign touch, home ->
--      search -> Belle Ring -> sticky add -> checkout -> email -> Pay; paid
--      order O1 (R600, welcome code CHARM-ABC123 -R60), attributed.
--   S2 (V2, desktop, Tue 17 Nov 20:00 SAST): direct, one page, 3s -> bounce.
--   S3 (V3, tablet, Wed 18 Nov 11:00 SAST): Google organic, Luna Hoops, add
--      to bag, no order (O3 is pending).
--   S4 (V1, 10 Nov): outside the range.
--   O2: paid in range, R400, no attribution ("Not tracked").

-- ---- shop data ---------------------------------------------------------------
insert into products (id, name, slug) values
  ('b1111111-1111-4111-8111-111111111111', 'Belle Ring', 'belle-ring-gold'),
  ('b2222222-2222-4222-8222-222222222222', 'Luna Hoops', 'luna-hoops-gold');

insert into discount_codes (code, created_at) values
  ('CHARM-ABC123', '2026-11-15T08:00:00Z'),
  ('CHARM-ZZZ999', '2026-11-16T08:00:00Z');

insert into orders (id, email, first_name, last_name, total, status, paid_at, created_at, discount_code, discount_amount) values
  ('c1111111-1111-4111-8111-111111111111', 'thandi@example.com', 'Thandi', 'Mokoena', 600, 'paid',
   '2026-11-16T10:20:00Z', '2026-11-16T10:15:00Z', 'CHARM-ABC123', 60),
  ('c2222222-2222-4222-8222-222222222222', 'sam@example.com', 'Sam', 'Ndlovu', 400, 'paid',
   '2026-11-19T12:00:00Z', '2026-11-19T11:55:00Z', null, 0),
  ('c3333333-3333-4333-8333-333333333333', 'lee@example.com', 'Lee', 'Smith', 300, 'pending',
   null, '2026-11-18T09:20:00Z', null, 0);

insert into order_items (order_id, product_id, product_name, product_slug, unit_price, quantity, line_total) values
  ('c1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'Belle Ring', 'belle-ring-gold', 560, 1, 560),
  ('c2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'Luna Hoops', 'luna-hoops-gold', 340, 1, 340);

-- ---- ingest ------------------------------------------------------------------
do $$
declare r jsonb;
begin
  r := analytics_ingest($j${
    "visitor": {"id": "11111111-1111-4111-8111-111111111111", "seen_at": "2026-11-16T10:00:00Z"},
    "session": {"id": "a1111111-1111-4111-8111-111111111111", "started_at": "2026-11-16T10:00:00Z",
      "last_activity_at": "2026-11-16T10:19:00Z", "landing_path": "/", "landing_page_type": "home",
      "device": "mobile", "browser": "Safari", "os": "iOS", "country": "ZA", "city": "Cape Town"},
    "touches": [{"id": "d1111111-1111-4111-8111-111111111111", "at": "2026-11-16T10:00:00Z",
      "fingerprint": "instagram|social|2026-11_launch", "landing_path": "/", "referrer_host": null,
      "utm_source": "instagram", "utm_medium": "social", "utm_campaign": "2026-11_launch",
      "utm_content": "story_sticker", "utm_term": null, "utm_id": null, "click_id_type": null,
      "click_id": null, "in_app": null, "source": "instagram", "medium": "social",
      "campaign": "2026-11_launch", "content": "story_sticker", "term": null,
      "channel": "Organic social", "inferred": false, "excluded": false}],
    "page_views": [
      {"id": "e1111111-1111-4111-8111-111111111111", "viewed_at": "2026-11-16T10:00:00Z", "path": "/",
       "page_type": "home", "product_slug": null, "title": "Charmistry", "engaged_ms": 5000, "max_scroll_pct": 40},
      {"id": "e1111111-1111-4111-8111-111111111112", "viewed_at": "2026-11-16T10:01:00Z",
       "path": "/products/belle-ring-gold", "page_type": "product", "product_slug": "belle-ring-gold",
       "title": "Belle Ring", "engaged_ms": 60000, "max_scroll_pct": 75},
      {"id": "e1111111-1111-4111-8111-111111111113", "viewed_at": "2026-11-16T10:05:00Z",
       "path": "/checkout", "page_type": "checkout", "product_slug": null, "title": "Checkout",
       "engaged_ms": 30000, "max_scroll_pct": 90}],
    "events": [
      {"id": "f1111111-1111-4111-8111-111111111110", "page_view_id": "e1111111-1111-4111-8111-111111111111",
       "name": "search", "occurred_at": "2026-11-16T10:00:30Z", "product_id": null, "product_slug": null,
       "value": null, "props": {"term": "Hoops", "results": 2}},
      {"id": "f1111111-1111-4111-8111-111111111109", "page_view_id": "e1111111-1111-4111-8111-111111111111",
       "name": "search", "occurred_at": "2026-11-16T10:00:40Z", "product_id": null, "product_slug": null,
       "value": null, "props": {"term": "zzz", "results": 0}},
      {"id": "f1111111-1111-4111-8111-111111111108", "page_view_id": "e1111111-1111-4111-8111-111111111111",
       "name": "promo_click", "occurred_at": "2026-11-16T10:00:50Z", "product_id": null, "product_slug": null,
       "value": null, "props": {"promo": "rings_stack_banner"}},
      {"id": "f1111111-1111-4111-8111-111111111111", "page_view_id": "e1111111-1111-4111-8111-111111111112",
       "name": "view_item", "occurred_at": "2026-11-16T10:01:00Z",
       "product_id": "b1111111-1111-4111-8111-111111111111", "product_slug": "belle-ring-gold",
       "value": 560, "props": {"name": "Belle Ring"}},
      {"id": "f1111111-1111-4111-8111-111111111112", "page_view_id": "e1111111-1111-4111-8111-111111111112",
       "name": "add_to_cart", "occurred_at": "2026-11-16T10:02:00Z",
       "product_id": "b1111111-1111-4111-8111-111111111111", "product_slug": "belle-ring-gold",
       "value": 560, "props": {"name": "Belle Ring", "source": "pdp_sticky"}},
      {"id": "f1111111-1111-4111-8111-111111111113", "page_view_id": "e1111111-1111-4111-8111-111111111113",
       "name": "begin_checkout", "occurred_at": "2026-11-16T10:05:00Z", "product_id": null,
       "product_slug": null, "value": 560, "props": {}},
      {"id": "f1111111-1111-4111-8111-111111111114", "page_view_id": "e1111111-1111-4111-8111-111111111113",
       "name": "checkout_email_entered", "occurred_at": "2026-11-16T10:06:00Z", "product_id": null,
       "product_slug": null, "value": null, "props": {}},
      {"id": "f1111111-1111-4111-8111-111111111115", "page_view_id": "e1111111-1111-4111-8111-111111111113",
       "name": "checkout_submitted", "occurred_at": "2026-11-16T10:08:00Z", "product_id": null,
       "product_slug": null, "value": 600, "props": {}}]
  }$j$::jsonb);
  assert (r ->> 'skipped')::boolean = false, 'S1 ingest skipped';
  assert (r ->> 'touches')::int = 1 and (r ->> 'page_views')::int = 3 and (r ->> 'events')::int = 8,
    format('S1 ingest counts wrong: %s', r);

  -- A retried batch never double-counts; page views keep the larger engagement.
  r := analytics_ingest($j${
    "visitor": {"id": "11111111-1111-4111-8111-111111111111", "seen_at": "2026-11-16T10:19:00Z"},
    "session": {"id": "a1111111-1111-4111-8111-111111111111", "started_at": "2026-11-16T10:00:00Z",
      "last_activity_at": "2026-11-16T10:19:00Z", "landing_path": "/", "landing_page_type": "home",
      "device": "mobile", "browser": "Safari", "os": "iOS", "country": "ZA", "city": "Cape Town"},
    "touches": [], "page_views": [
      {"id": "e1111111-1111-4111-8111-111111111111", "viewed_at": "2026-11-16T10:00:00Z", "path": "/",
       "page_type": "home", "product_slug": null, "title": null, "engaged_ms": 1000, "max_scroll_pct": 10}],
    "events": [{"id": "f1111111-1111-4111-8111-111111111115", "page_view_id": null,
       "name": "checkout_submitted", "occurred_at": "2026-11-16T10:08:00Z", "product_id": null,
       "product_slug": null, "value": 600, "props": {}}]
  }$j$::jsonb);
  assert (r ->> 'events')::int = 0, 'retried event was inserted twice';
  assert (select engaged_ms from analytics_page_views where id = 'e1111111-1111-4111-8111-111111111111') = 5000,
    'page view engagement went backwards';
  assert (select title from analytics_page_views where id = 'e1111111-1111-4111-8111-111111111111') = 'Charmistry',
    'page view title was blanked';

  -- Someone else's session id is refused.
  r := analytics_ingest($j${
    "visitor": {"id": "99999999-9999-4999-8999-999999999999", "seen_at": "2026-11-16T11:00:00Z"},
    "session": {"id": "a1111111-1111-4111-8111-111111111111", "started_at": "2026-11-16T11:00:00Z",
      "last_activity_at": "2026-11-16T11:00:00Z", "landing_path": "/", "landing_page_type": "home",
      "device": "desktop"}, "touches": [], "page_views": [], "events": []
  }$j$::jsonb);
  assert (r ->> 'skipped')::boolean = true, 'hijacked session was not skipped';

  assert (select channel from analytics_sessions where id = 'a1111111-1111-4111-8111-111111111111') = 'Organic social',
    'session acquisition not taken from its first touch';
end $$;

do $$ begin
  -- S2: direct bounce.
  perform analytics_ingest($j${
    "visitor": {"id": "22222222-2222-4222-8222-222222222222", "seen_at": "2026-11-17T18:00:00Z"},
    "session": {"id": "a2222222-2222-4222-8222-222222222222", "started_at": "2026-11-17T18:00:00Z",
      "last_activity_at": "2026-11-17T18:00:03Z", "landing_path": "/", "landing_page_type": "home",
      "device": "desktop", "browser": "Chrome", "os": "Windows", "country": null, "city": null},
    "touches": [], "page_views": [
      {"id": "e2222222-2222-4222-8222-222222222221", "viewed_at": "2026-11-17T18:00:00Z", "path": "/",
       "page_type": "home", "product_slug": null, "title": "Charmistry", "engaged_ms": 3000, "max_scroll_pct": 10}],
    "events": []
  }$j$::jsonb);
  -- S3: Google organic, Luna Hoops, added to bag, no paid order.
  perform analytics_ingest($j${
    "visitor": {"id": "33333333-3333-4333-8333-333333333333", "seen_at": "2026-11-18T09:00:00Z"},
    "session": {"id": "a3333333-3333-4333-8333-333333333333", "started_at": "2026-11-18T09:00:00Z",
      "last_activity_at": "2026-11-18T09:03:00Z", "landing_path": "/products/luna-hoops-gold",
      "landing_page_type": "product", "device": "tablet", "browser": "Safari", "os": "iPadOS",
      "country": "ZA", "city": null},
    "touches": [{"id": "d3333333-3333-4333-8333-333333333333", "at": "2026-11-18T09:00:00Z",
      "fingerprint": "google", "landing_path": "/products/luna-hoops-gold", "referrer_host": "www.google.co.za",
      "utm_source": null, "utm_medium": null, "utm_campaign": null, "utm_content": null, "utm_term": null,
      "utm_id": null, "click_id_type": null, "click_id": null, "in_app": null, "source": "google",
      "medium": "organic", "campaign": null, "content": null, "term": null,
      "channel": "Organic search", "inferred": false, "excluded": false}],
    "page_views": [
      {"id": "e3333333-3333-4333-8333-333333333331", "viewed_at": "2026-11-18T09:00:00Z",
       "path": "/products/luna-hoops-gold", "page_type": "product", "product_slug": "luna-hoops-gold",
       "title": "Luna Hoops", "engaged_ms": 20000, "max_scroll_pct": 60}],
    "events": [
      {"id": "f3333333-3333-4333-8333-333333333331", "page_view_id": "e3333333-3333-4333-8333-333333333331",
       "name": "view_item", "occurred_at": "2026-11-18T09:00:01Z",
       "product_id": "b2222222-2222-4222-8222-222222222222", "product_slug": "luna-hoops-gold",
       "value": 340, "props": {"name": "Luna Hoops"}},
      {"id": "f3333333-3333-4333-8333-333333333332", "page_view_id": "e3333333-3333-4333-8333-333333333331",
       "name": "add_to_cart", "occurred_at": "2026-11-18T09:02:00Z",
       "product_id": "b2222222-2222-4222-8222-222222222222", "product_slug": "luna-hoops-gold",
       "value": 340, "props": {"name": "Luna Hoops", "source": "pdp"}}]
  }$j$::jsonb);
  -- S4: V1 again, before the range.
  perform analytics_ingest($j${
    "visitor": {"id": "11111111-1111-4111-8111-111111111111", "seen_at": "2026-11-10T08:00:00Z"},
    "session": {"id": "a4444444-4444-4444-8444-444444444444", "started_at": "2026-11-10T08:00:00Z",
      "last_activity_at": "2026-11-10T08:01:00Z", "landing_path": "/shop", "landing_page_type": "shop",
      "device": "mobile"}, "touches": [], "page_views": [
      {"id": "e4444444-4444-4444-8444-444444444441", "viewed_at": "2026-11-10T08:00:00Z", "path": "/shop",
       "page_type": "shop", "product_slug": null, "title": "Shop", "engaged_ms": 40000, "max_scroll_pct": 80}],
    "events": []
  }$j$::jsonb);

  perform analytics_attribute_order($j${
    "order_id": "c1111111-1111-4111-8111-111111111111", "visitor_id": "11111111-1111-4111-8111-111111111111",
    "session_id": "a1111111-1111-4111-8111-111111111111",
    "first_touch": {"at": "2026-11-16T10:00:00Z", "landing_path": "/", "source": "instagram", "medium": "social",
      "campaign": "2026-11_launch", "content": "story_sticker", "term": null, "channel": "Organic social",
      "inferred": false, "click_id_type": null},
    "last_touch": {"at": "2026-11-16T10:00:00Z", "landing_path": "/", "source": "instagram", "medium": "social",
      "campaign": "2026-11_launch", "content": "story_sticker", "term": null, "channel": "Organic social",
      "inferred": false, "click_id_type": null},
    "touch_count": 1, "fbclid": "IwAR0AbC", "fbclid_at": "2026-11-16T10:00:00Z", "fbp": "fb.1.1.2",
    "fbc": null, "user_agent": "Mozilla/5.0", "country": "ZA"
  }$j$::jsonb);
  -- O3 is pending; attributing it must not make S3 "paid".
  perform analytics_attribute_order($j${
    "order_id": "c3333333-3333-4333-8333-333333333333", "visitor_id": "33333333-3333-4333-8333-333333333333",
    "session_id": "a3333333-3333-4333-8333-333333333333", "first_touch": null, "last_touch": null,
    "touch_count": 0, "fbclid": null, "fbclid_at": null, "fbp": null, "fbc": null,
    "user_agent": null, "country": "ZA"
  }$j$::jsonb);
  -- Attributing twice keeps the first snapshot.
  perform analytics_attribute_order($j${
    "order_id": "c1111111-1111-4111-8111-111111111111", "visitor_id": "22222222-2222-4222-8222-222222222222",
    "session_id": "a2222222-2222-4222-8222-222222222222", "first_touch": null, "last_touch": null,
    "touch_count": 0, "fbclid": null, "fbclid_at": null, "fbp": null, "fbc": null, "user_agent": null,
    "country": null
  }$j$::jsonb);
  assert (select session_id from analytics_order_attribution
          where order_id = 'c1111111-1111-4111-8111-111111111111') = 'a1111111-1111-4111-8111-111111111111',
    'second attribution overwrote the first';
  assert (select channel from analytics_order_attribution
          where order_id = 'c3333333-3333-4333-8333-333333333333') = 'Direct',
    'an order with no attributable touch should be Direct';
end $$;

-- ---- sections ----------------------------------------------------------------
do $$
declare
  rng constant jsonb := '{"from": "2026-11-14T22:00:00Z", "to": "2026-11-21T22:00:00Z", "device": null}';
  cmp jsonb := rng || '{"prev_from": "2026-11-07T22:00:00Z", "prev_to": "2026-11-14T22:00:00Z", "granularity": "day"}';
  r jsonb;
  t jsonb;
begin
  -- summary
  r := analytics_summary(cmp);
  t := r #> '{current,totals}';
  assert (t ->> 'sessions')::int = 3, format('sessions %s', t);
  assert (t ->> 'visitors')::int = 3, format('visitors %s', t);
  assert (t ->> 'adds')::int = 2, format('adds %s', t);
  assert (t ->> 'bounces')::int = 1, format('bounces %s', t);
  assert (t ->> 'conversions')::int = 1, format('conversions %s', t);
  assert (t ->> 'orders')::int = 2 and (t ->> 'revenue')::numeric = 1000, format('orders/revenue %s', t);
  assert (r #>> '{previous,totals,sessions}')::int = 1, format('previous sessions %s', r -> 'previous');
  -- S1 starts on day index 1 (16 Nov), S2 day 2, S3 day 3.
  assert exists (select 1 from jsonb_array_elements(r #> '{current,buckets}') b
                 where (b ->> 'i')::int = 1 and (b ->> 'sessions')::int = 1 and (b ->> 'revenue')::numeric = 600),
    format('bucket 1 wrong: %s', r #> '{current,buckets}');
  assert analytics_summary(rng) -> 'previous' = 'null'::jsonb, 'previous should be null without prev_from';

  -- device filter
  r := analytics_summary(jsonb_set(cmp, '{device}', '"mobile"'));
  assert (r #>> '{current,totals,sessions}')::int = 1 and (r #>> '{current,totals,orders}')::int = 1,
    format('mobile filter %s', r -> 'current');

  -- funnel
  r := analytics_funnel(cmp);
  assert r -> 'current' = '[3, 2, 2, 1, 1, 1, 1]'::jsonb, format('funnel %s', r);

  -- acquisition
  r := analytics_acquisition(rng);
  assert exists (select 1 from jsonb_array_elements(r -> 'channels') c
                 where c ->> 'key' = 'Organic social' and (c ->> 'sessions')::int = 1
                   and (c ->> 'orders')::int = 1 and (c ->> 'revenue')::numeric = 600),
    format('channels %s', r -> 'channels');
  assert exists (select 1 from jsonb_array_elements(r -> 'channels') c
                 where c ->> 'key' = 'Direct' and (c ->> 'sessions')::int = 1 and (c ->> 'bounces')::int = 1),
    format('direct row %s', r -> 'channels');
  assert (r #>> '{not_tracked,orders}')::int = 1 and (r #>> '{not_tracked,revenue}')::numeric = 400,
    format('not tracked %s', r -> 'not_tracked');
  assert jsonb_array_length(r -> 'orders') = 2, format('orders list %s', r -> 'orders');
  assert (r -> 'orders' -> 0 ->> 'short_id') = 'C2222222', 'orders should be newest first';
  assert exists (select 1 from jsonb_array_elements(r -> 'campaigns') c
                 where c ->> 'key' = '2026-11_launch' and (c ->> 'orders')::int = 1
                   and c ->> 'source_medium' = 'instagram / social'),
    format('campaigns %s', r -> 'campaigns');
  assert exists (select 1 from jsonb_array_elements(r -> 'orders') o
                 where o ->> 'short_id' = 'C1111111' and (o ->> 'days_to_purchase')::int = 0
                   and (o ->> 'tracked')::boolean),
    format('order row %s', r -> 'orders');

  -- products
  r := analytics_products(rng);
  assert exists (select 1 from jsonb_array_elements(r -> 'rows') x
                 where x ->> 'name' = 'Belle Ring' and (x ->> 'views')::int = 1 and (x ->> 'adds')::int = 1
                   and (x ->> 'view_purchases')::int = 1 and (x ->> 'units')::int = 1
                   and (x ->> 'revenue')::numeric = 560 and x ->> 'slug' = 'belle-ring-gold'),
    format('belle ring %s', r);
  assert exists (select 1 from jsonb_array_elements(r -> 'rows') x
                 where x ->> 'name' = 'Luna Hoops' and (x ->> 'views')::int = 1
                   and (x ->> 'view_purchases')::int = 0 and (x ->> 'units')::int = 1),
    format('luna hoops %s', r);

  -- promotions
  r := analytics_promotions(rng);
  assert r -> 'rows' = '[{"code": "WELCOME", "orders": 1, "revenue": 600, "discount": 60}]'::jsonb,
    format('promo rows %s', r -> 'rows');
  assert (r ->> 'total_orders')::int = 2, format('total orders %s', r);
  assert (r #>> '{no_promo,orders}')::int = 1 and (r #>> '{no_promo,revenue}')::numeric = 400,
    format('no promo %s', r -> 'no_promo');
  assert r -> 'welcome' = '{"issued": 2, "redeemed": 1}'::jsonb, format('welcome %s', r -> 'welcome');
  assert r -> 'banners' = '{"clicks": 1, "sessions": 1, "orders": 1, "revenue": 600}'::jsonb,
    format('banners %s', r -> 'banners');

  -- devices
  r := analytics_devices(rng);
  assert jsonb_array_length(r -> 'rows') = 3, format('device rows %s', r);
  assert r -> 'rows' -> 0 ->> 'device' = 'mobile' and (r -> 'rows' -> 0 ->> 'orders')::int = 1,
    format('mobile row %s', r -> 'rows');
  assert r -> 'sticky' = '{"mobile_adds": 2, "sticky_adds": 1}'::jsonb, format('sticky %s', r -> 'sticky');

  -- pages
  r := analytics_pages(rng);
  assert exists (select 1 from jsonb_array_elements(r -> 'rows') x
                 where x ->> 'path' = '/' and (x ->> 'views')::int = 2 and (x ->> 'exits')::int = 1
                   and x ->> 'title' = 'Charmistry'),
    format('home page row %s', r);
  assert exists (select 1 from jsonb_array_elements(r -> 'rows') x
                 where x ->> 'path' = '/checkout' and (x ->> 'exits')::int = 1),
    format('checkout exits %s', r);

  -- search
  r := analytics_search(rng);
  assert r -> 'top' @> '[{"term": "hoops", "searches": 1, "led_to_view": 1}]'::jsonb, format('top %s', r);
  assert r -> 'no_results' -> 0 ->> 'term' = 'zzz', format('no results %s', r);

  -- when: Mon 12:00, Tue 20:00, Wed 11:00 SAST
  r := analytics_when(rng);
  assert jsonb_array_length(r -> 'cells') = 7 and jsonb_array_length(r -> 'cells' -> 0) = 24, 'when shape';
  assert (r #>> '{cells,0,12}')::int = 1 and (r #>> '{cells,1,20}')::int = 1
     and (r #>> '{cells,2,11}')::int = 1, format('when cells %s', r);

  -- geography
  r := analytics_geography(rng);
  assert r -> 'countries' -> 0 = '{"code": "ZA", "sessions": 2, "orders": 1, "revenue": 600}'::jsonb,
    format('countries %s', r -> 'countries');
  assert r -> 'cities' @> '[{"name": "Cape Town", "sessions": 1}]'::jsonb, format('cities %s', r -> 'cities');

  -- health
  r := analytics_health('{}');
  assert (r ->> 'ever')::boolean, 'health.ever';

  -- capi context
  r := analytics_capi_context('{"order_id": "c1111111-1111-4111-8111-111111111111"}');
  assert r ->> 'fbclid' = 'IwAR0AbC' and r ->> 'fbp' = 'fb.1.1.2', format('capi %s', r);
  assert analytics_capi_context('{"order_id": "c2222222-2222-4222-8222-222222222222"}') is null,
    'capi context for an untracked order should be null';
end $$;

-- ---- journeys ----------------------------------------------------------------
do $$
declare
  base constant jsonb := '{"from": "2026-11-14T22:00:00Z", "to": "2026-11-21T22:00:00Z", "device": null,
    "outcome": "any", "channel": null, "campaign": null, "step": null, "q": null, "page": 1, "page_size": 25}';
  r jsonb;
begin
  r := analytics_journeys(base);
  assert (r ->> 'total')::int = 3, format('journeys total %s', r ->> 'total');
  assert r -> 'rows' -> 0 ->> 'session_id' = 'a3333333-3333-4333-8333-333333333333', 'newest first';
  assert r -> 'facets' -> 'channels' @> '["Organic social", "Direct", "Organic search"]'::jsonb,
    format('facets %s', r -> 'facets');

  r := analytics_journeys(jsonb_set(base, '{outcome}', '"paid"'));
  assert (r ->> 'total')::int = 1 and r -> 'rows' -> 0 ->> 'customer_name' = 'Thandi Mokoena'
     and r -> 'rows' -> 0 ->> 'order_short_id' = 'C1111111', format('paid journeys %s', r);
  r := analytics_journeys(jsonb_set(base, '{outcome}', '"bag"'));
  assert (r ->> 'total')::int = 1 and (r -> 'rows' -> 0 ->> 'bag_value')::numeric = 340,
    format('bag journeys %s', r);
  r := analytics_journeys(jsonb_set(base, '{outcome}', '"browsed"'));
  assert (r ->> 'total')::int = 1, format('browsed journeys %s', r);
  r := analytics_journeys(jsonb_set(base, '{step}', '"reached_checkout"'));
  assert (r ->> 'total')::int = 1, format('step filter %s', r);
  r := analytics_journeys(jsonb_set(base, '{channel}', '"Organic search"'));
  assert (r ->> 'total')::int = 1, format('channel filter %s', r);

  -- Searching by order number or email ignores the range and returns every visit of that visitor.
  r := analytics_journeys(jsonb_set(base, '{q}', '"#C1111111"'));
  assert (r ->> 'total')::int = 2, format('order search %s', r);
  r := analytics_journeys(jsonb_set(base, '{q}', '"Thandi@Example.com"'));
  assert (r ->> 'total')::int = 2, format('email search %s', r);
  r := analytics_journeys(jsonb_set(base, '{q}', '"hello"'));
  assert (r ->> 'total')::int = 0, format('free-text search %s', r);

  -- paging
  r := analytics_journeys(base || '{"page": 2, "page_size": 2}');
  assert jsonb_array_length(r -> 'rows') = 1 and (r ->> 'total')::int = 3, format('paging %s', r);

  -- detail
  r := analytics_journey('{"session_id": "a1111111-1111-4111-8111-111111111111"}');
  assert r #>> '{session,channel}' = 'Organic social', format('journey session %s', r -> 'session');
  assert (r #>> '{session,pages}')::int = 3, 'journey pages';
  assert jsonb_array_length(r -> 'orders') = 1, format('journey orders %s', r -> 'orders');
  assert jsonb_array_length(r -> 'sessions') = 2, format('journey sessions %s', r -> 'sessions');
  assert r #>> '{visitor,first_touch,channel}' = 'Organic social', format('first touch %s', r -> 'visitor');
  assert r #>> '{visitor,customer_name}' = 'Thandi Mokoena', 'customer name';
  assert exists (select 1 from jsonb_array_elements(r -> 'timeline') i where i ->> 'kind' = 'order'),
    'timeline has the order';
  assert exists (select 1 from jsonb_array_elements(r -> 'timeline') i where i ->> 'kind' = 'touch'),
    'timeline has the touch';
  assert (select count(*) from jsonb_array_elements(r -> 'timeline') i where i ->> 'kind' = 'page') = 3,
    'timeline pages';
  assert analytics_journey('{"session_id": "a9999999-9999-4999-8999-999999999999"}') is null,
    'unknown session should be null';
end $$;

-- ---- retention and forgetting -----------------------------------------------
do $$
declare r jsonb;
begin
  perform analytics_ingest(jsonb_build_object(
    'visitor', jsonb_build_object('id', '55555555-5555-4555-8555-555555555555', 'seen_at', now() - interval '14 months'),
    'session', jsonb_build_object('id', 'a5555555-5555-4555-8555-555555555555',
      'started_at', now() - interval '14 months', 'last_activity_at', now() - interval '14 months',
      'landing_path', '/', 'landing_page_type', 'home', 'device', 'desktop'),
    'touches', '[]'::jsonb, 'page_views', '[]'::jsonb, 'events', '[]'::jsonb));

  r := analytics_purge('{}');
  assert (r ->> 'ran')::boolean and (r ->> 'sessions')::int >= 1, format('purge %s', r);
  assert not exists (select 1 from analytics_visitors where id = '55555555-5555-4555-8555-555555555555'),
    'old visitor not purged';
  assert exists (select 1 from analytics_order_attribution), 'purge must never touch attribution';
  r := analytics_purge('{}');
  assert not (r ->> 'ran')::boolean, 'purge ran twice in one day';

  r := analytics_forget('THANDI@example.com');
  assert (r ->> 'visitors')::int = 1 and (r ->> 'attributions')::int = 1, format('forget %s', r);
  assert analytics_journey('{"session_id": "a1111111-1111-4111-8111-111111111111"}') is null,
    'forgotten visitor still has a journey';
end $$;

-- ---- privileges --------------------------------------------------------------
do $$ begin
  assert not has_function_privilege('anon', 'public.analytics_summary(jsonb)', 'execute'), 'anon can run summary';
  assert not has_function_privilege('authenticated', 'public.analytics_ingest(jsonb)', 'execute'),
    'authenticated can run ingest';
  assert has_function_privilege('service_role', 'public.analytics_summary(jsonb)', 'execute'),
    'service_role cannot run summary';
  assert not has_function_privilege('service_role', 'public.analytics_forget(text)', 'execute'),
    'service_role can run forget';
  assert not has_function_privilege('service_role',
    'public.analytics__session_facts(timestamptz, timestamptz, text, uuid[])', 'execute'),
    'service_role can run an internal helper';
  assert not has_table_privilege('anon', 'public.analytics_sessions', 'select'), 'anon can read sessions';
end $$;

select 'analytics SQL tests passed' as result;
