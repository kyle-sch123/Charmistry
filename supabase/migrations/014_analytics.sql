-- 014_analytics.sql
--
-- First-party customer-journey analytics: visitors, sessions, campaign
-- touches, page views and shop events, plus a per-order attribution snapshot.
--
-- Why it exists: GA4, Meta and Klaviyo keys can send data but can't hand back
-- per-visitor journeys or time on page, so journeys are recorded here and the
-- admin dashboard reads them through the functions below.
--
-- Rules:
--   * App code reaches these tables ONLY through the analytics_* functions,
--     each taking one `p jsonb` argument (supabase.rpc(name, { p })).
--   * Tables have RLS enabled and no policies; anon/authenticated get nothing.
--     Public functions are SECURITY DEFINER and executable by service_role only.
--     Internal helpers (analytics__*) and analytics_forget are executable by no
--     API role at all.
--   * Privacy (POPIA): no email, name, phone or IP address is stored in these
--     tables. Visitors are random ids; country/city are coarse. Sessions,
--     touches and events are purged after 13 months (analytics_purge, called
--     at most once a day by the admin overview). Order attribution lives and
--     dies with its order.
--   * Time: South Africa is UTC+2 all year, so SAST maths uses a fixed offset
--     (no time-zone database needed).
--   * Idempotent: safe to re-run, and safe to apply before or after the app
--     deploys (the app degrades to "setup required" until it exists).

-- ---- tables ------------------------------------------------------------------

create table if not exists public.analytics_visitors (
  id uuid primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.analytics_sessions (
  id uuid primary key,
  visitor_id uuid not null references public.analytics_visitors(id) on delete cascade,
  started_at timestamptz not null,
  last_activity_at timestamptz not null,
  landing_path text not null default '/',
  landing_page_type text not null default 'other',
  touch_id uuid,
  channel text not null default 'Direct',
  source text not null default '(direct)',
  medium text not null default '(none)',
  campaign text,
  inferred boolean not null default false,
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  browser text,
  os text,
  country char(2),
  city text
);

create table if not exists public.analytics_touches (
  id uuid primary key,
  visitor_id uuid not null references public.analytics_visitors(id) on delete cascade,
  session_id uuid not null references public.analytics_sessions(id) on delete cascade,
  touched_at timestamptz not null,
  fingerprint text not null default '',
  landing_path text not null default '/',
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  utm_id text,
  click_id_type text,
  click_id text,
  in_app text,
  source text not null,
  medium text not null,
  campaign text,
  channel text not null,
  inferred boolean not null default false,
  excluded boolean not null default false
);

create table if not exists public.analytics_page_views (
  id uuid primary key,
  session_id uuid not null references public.analytics_sessions(id) on delete cascade,
  viewed_at timestamptz not null,
  path text not null,
  page_type text not null default 'other',
  product_slug text,
  title text,
  engaged_ms integer not null default 0 check (engaged_ms between 0 and 21600000),
  max_scroll_pct smallint not null default 0 check (max_scroll_pct between 0 and 100)
);

create table if not exists public.analytics_events (
  id uuid primary key,
  session_id uuid not null references public.analytics_sessions(id) on delete cascade,
  page_view_id uuid,
  name text not null,
  occurred_at timestamptz not null,
  -- No FK: products can be deleted, history must survive.
  product_id uuid,
  product_slug text,
  value numeric(12, 2),
  props jsonb not null default '{}'::jsonb
);

create table if not exists public.analytics_order_attribution (
  order_id uuid primary key references public.orders(id) on delete cascade,
  -- No FKs: the snapshot must survive the 13-month session purge.
  visitor_id uuid not null,
  session_id uuid not null,
  first_touch jsonb,
  last_touch jsonb,
  touch_count integer not null default 0,
  channel text not null default 'Direct',
  source text not null default '(direct)',
  medium text not null default '(none)',
  campaign text,
  fbclid text,
  fbclid_at timestamptz,
  fbp text,
  fbc text,
  user_agent text,
  country char(2),
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.analytics_meta (key, value, updated_at)
values ('purge', '{}'::jsonb, 'epoch'::timestamptz)
on conflict (key) do nothing;

-- ---- indexes -----------------------------------------------------------------

create index if not exists analytics_sessions_started_at_idx on public.analytics_sessions (started_at);
create index if not exists analytics_sessions_visitor_idx on public.analytics_sessions (visitor_id, started_at desc);
create index if not exists analytics_touches_visitor_idx on public.analytics_touches (visitor_id, touched_at desc);
create index if not exists analytics_touches_session_idx on public.analytics_touches (session_id);
create index if not exists analytics_page_views_session_idx on public.analytics_page_views (session_id, viewed_at);
create index if not exists analytics_page_views_viewed_at_idx on public.analytics_page_views (viewed_at);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id, occurred_at);
create index if not exists analytics_events_name_idx on public.analytics_events (name, occurred_at);
create index if not exists analytics_events_occurred_at_idx on public.analytics_events (occurred_at);
create index if not exists analytics_events_product_idx on public.analytics_events (product_id) where product_id is not null;
create index if not exists analytics_order_attribution_visitor_idx on public.analytics_order_attribution (visitor_id);
create index if not exists analytics_order_attribution_session_idx on public.analytics_order_attribution (session_id);
-- Index only; no columns on orders change.
create index if not exists orders_paid_at_idx on public.orders (paid_at) where status = 'paid';

-- ---- lock the tables down ----------------------------------------------------

alter table public.analytics_visitors enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_touches enable row level security;
alter table public.analytics_page_views enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_order_attribution enable row level security;
alter table public.analytics_meta enable row level security;

revoke all on public.analytics_visitors, public.analytics_sessions, public.analytics_touches,
  public.analytics_page_views, public.analytics_events, public.analytics_order_attribution,
  public.analytics_meta
  from public, anon, authenticated;

-- ---- internal helpers --------------------------------------------------------

-- SAST wall-clock time (UTC+2, no daylight saving).
create or replace function public.analytics__sast(p_ts timestamptz)
returns timestamp language sql immutable set search_path = public as $$
  select (p_ts at time zone 'UTC') + interval '2 hours'
$$;

-- Index of the SAST day or hour of p_ts, counted from the range start.
create or replace function public.analytics__bucket(p_ts timestamptz, p_from timestamptz, p_granularity text)
returns integer language sql immutable set search_path = public as $$
  select floor(extract(epoch from (p_ts - p_from))
    / case when p_granularity = 'hour' then 3600 else 86400 end)::integer
$$;

create or replace function public.analytics__device(p_device text)
returns text language sql immutable set search_path = public as $$
  select case when p_device in ('mobile', 'tablet', 'desktop') then p_device else null end
$$;

create or replace function public.analytics__short_id(p_id uuid)
returns text language sql immutable set search_path = public as $$
  select upper(left(p_id::text, 8))
$$;

-- One row per session started in [p_from, p_to), with its funnel flags.
-- p_visitors (optional) limits it to those visitors (journey search).
create or replace function public.analytics__session_facts(
  p_from timestamptz, p_to timestamptz, p_device text, p_visitors uuid[] default null)
returns table (
  session_id uuid, visitor_id uuid, started_at timestamptz, device text,
  channel text, source text, medium text, campaign text, inferred boolean,
  landing_path text, country text, city text,
  pages integer, engaged_ms bigint, interactions integer,
  viewed_product boolean, added boolean, reached_checkout boolean,
  entered_email boolean, clicked_pay boolean,
  paid_orders integer, paid_revenue numeric, bag_value numeric,
  max_step integer, bounced boolean
)
language sql stable set search_path = public as $$
  with s as (
    select * from analytics_sessions x
    where x.started_at >= p_from and x.started_at < p_to
      and (p_device is null or x.device = p_device)
      and (p_visitors is null or x.visitor_id = any(p_visitors))
  ),
  pv as (
    select v.session_id,
      count(*)::integer as pages,
      coalesce(sum(v.engaged_ms), 0)::bigint as engaged_ms,
      bool_or(v.page_type = 'product') as product_page,
      bool_or(v.page_type = 'checkout') as checkout_page
    from analytics_page_views v join s on s.id = v.session_id
    group by v.session_id
  ),
  ev as (
    select e.session_id,
      (count(*) filter (where e.name <> 'view_item'))::integer as interactions,
      bool_or(e.name = 'view_item') as viewed_item,
      bool_or(e.name = 'add_to_cart') as added,
      bool_or(e.name = 'begin_checkout') as began_checkout,
      bool_or(e.name = 'checkout_email_entered') as entered_email,
      bool_or(e.name = 'checkout_submitted') as clicked_pay,
      coalesce(sum(e.value) filter (where e.name = 'add_to_cart'), 0) as bag_value
    from analytics_events e join s on s.id = e.session_id
    group by e.session_id
  ),
  po as (
    select a.session_id, count(*)::integer as paid_orders, coalesce(sum(o.total), 0) as paid_revenue
    from analytics_order_attribution a
    join orders o on o.id = a.order_id and o.status = 'paid'
    join s on s.id = a.session_id
    group by a.session_id
  )
  select s.id, s.visitor_id, s.started_at, s.device,
    s.channel, s.source, s.medium, s.campaign, s.inferred,
    s.landing_path, s.country::text, s.city,
    coalesce(pv.pages, 0), coalesce(pv.engaged_ms, 0)::bigint, coalesce(ev.interactions, 0),
    coalesce(pv.product_page, false) or coalesce(ev.viewed_item, false),
    coalesce(ev.added, false),
    coalesce(pv.checkout_page, false) or coalesce(ev.began_checkout, false),
    coalesce(ev.entered_email, false),
    coalesce(ev.clicked_pay, false),
    coalesce(po.paid_orders, 0), coalesce(po.paid_revenue, 0), coalesce(ev.bag_value, 0),
    case
      when coalesce(po.paid_orders, 0) > 0 then 7
      when coalesce(ev.clicked_pay, false) then 6
      when coalesce(ev.entered_email, false) then 5
      when coalesce(pv.checkout_page, false) or coalesce(ev.began_checkout, false) then 4
      when coalesce(ev.added, false) then 3
      when coalesce(pv.product_page, false) or coalesce(ev.viewed_item, false) then 2
      else 1
    end,
    coalesce(pv.pages, 0) <= 1
      and coalesce(pv.engaged_ms, 0) < 10000
      and coalesce(ev.interactions, 0) = 0
  from s
  left join pv on pv.session_id = s.id
  left join ev on ev.session_id = s.id
  left join po on po.session_id = s.id
$$;

-- Paid orders with paid_at in [p_from, p_to), with their attribution snapshot.
-- With a device filter, only orders whose attributed session matches count.
create or replace function public.analytics__paid_orders(p_from timestamptz, p_to timestamptz, p_device text)
returns table (
  order_id uuid, paid_at timestamptz, total numeric, discount_code text, discount_amount numeric,
  session_id uuid, a_channel text, a_source text, a_medium text, a_campaign text, tracked boolean,
  a_device text, a_country text, a_city text, a_landing text,
  first_touch jsonb, last_touch jsonb, touch_count integer
)
language sql stable set search_path = public as $$
  select o.id, o.paid_at, o.total, nullif(trim(o.discount_code), ''), coalesce(o.discount_amount, 0),
    a.session_id, a.channel, a.source, a.medium, a.campaign, a.order_id is not null,
    s.device, coalesce(s.country, a.country)::text, s.city, s.landing_path,
    a.first_touch, a.last_touch, coalesce(a.touch_count, 0)
  from orders o
  left join analytics_order_attribution a on a.order_id = o.id
  left join analytics_sessions s on s.id = a.session_id
  where o.status = 'paid' and o.paid_at >= p_from and o.paid_at < p_to
    and (p_device is null or s.device = p_device)
$$;

-- Totals and per-bucket counts for one window.
create or replace function public.analytics__summary_window(p_from timestamptz, p_to timestamptz, p_device text, p_granularity text)
returns jsonb language sql stable set search_path = public as $$
  with f as (select * from analytics__session_facts(p_from, p_to, p_device)),
  o as (select * from analytics__paid_orders(p_from, p_to, p_device)),
  sb as (
    select analytics__bucket(f.started_at, p_from, p_granularity) as i,
      count(*) as sessions,
      count(distinct f.visitor_id) as visitors,
      count(*) filter (where f.added) as adds,
      coalesce(sum(f.engaged_ms), 0) as engaged_ms,
      count(*) filter (where f.bounced) as bounces,
      count(*) filter (where f.paid_orders > 0) as conversions
    from f group by 1
  ),
  ob as (
    select analytics__bucket(o.paid_at, p_from, p_granularity) as i,
      count(*) as orders, coalesce(sum(o.total), 0) as revenue
    from o group by 1
  ),
  b as (
    select coalesce(sb.i, ob.i) as i,
      coalesce(sb.sessions, 0) as sessions, coalesce(sb.visitors, 0) as visitors,
      coalesce(sb.adds, 0) as adds, coalesce(sb.engaged_ms, 0) as engaged_ms,
      coalesce(sb.bounces, 0) as bounces, coalesce(sb.conversions, 0) as conversions,
      coalesce(ob.orders, 0) as orders, coalesce(ob.revenue, 0) as revenue
    from sb full join ob on ob.i = sb.i
  )
  select jsonb_build_object(
    'buckets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'i', b.i, 'sessions', b.sessions, 'visitors', b.visitors, 'adds', b.adds,
        'engaged_ms', b.engaged_ms, 'bounces', b.bounces, 'conversions', b.conversions,
        'orders', b.orders, 'revenue', b.revenue) order by b.i)
      from b), '[]'::jsonb),
    'totals', jsonb_build_object(
      'sessions', (select count(*) from f),
      'visitors', (select count(distinct visitor_id) from f),
      'adds', (select count(*) from f where added),
      'engaged_ms', (select coalesce(sum(engaged_ms), 0) from f),
      'bounces', (select count(*) from f where bounced),
      'conversions', (select count(*) from f where paid_orders > 0),
      'orders', (select count(*) from o),
      'revenue', (select coalesce(sum(total), 0) from o))
  )
$$;

-- Stored form of a touch (matches ClassifiedTouch in src/lib/analytics/rpc.ts).
create or replace function public.analytics__touch_json(
  p_at timestamptz, p_landing text, p_source text, p_medium text, p_campaign text,
  p_content text, p_term text, p_channel text, p_inferred boolean, p_click_id_type text)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('at', p_at, 'landing_path', p_landing, 'source', p_source,
    'medium', p_medium, 'campaign', p_campaign, 'content', p_content, 'term', p_term,
    'channel', p_channel, 'inferred', p_inferred, 'click_id_type', p_click_id_type)
$$;

-- ---- ingest and attribution --------------------------------------------------

create or replace function public.analytics_ingest(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_vid uuid := (p #>> '{visitor,id}')::uuid;
  v_seen timestamptz := (p #>> '{visitor,seen_at}')::timestamptz;
  v_s jsonb := p -> 'session';
  v_sid uuid := (p #>> '{session,id}')::uuid;
  v_owner uuid;
  n_t integer := 0;
  n_pv integer := 0;
  n_ev integer := 0;
begin
  -- A session id that already belongs to another visitor is refused outright.
  select x.visitor_id into v_owner from analytics_sessions x where x.id = v_sid;
  if v_owner is not null and v_owner <> v_vid then
    return jsonb_build_object('skipped', true, 'touches', 0, 'page_views', 0, 'events', 0);
  end if;

  insert into analytics_visitors (id, first_seen_at, last_seen_at)
  values (v_vid, v_seen, v_seen)
  on conflict (id) do update
    set first_seen_at = least(analytics_visitors.first_seen_at, excluded.first_seen_at),
        last_seen_at = greatest(analytics_visitors.last_seen_at, excluded.last_seen_at);

  insert into analytics_sessions (id, visitor_id, started_at, last_activity_at, landing_path,
    landing_page_type, device, browser, os, country, city)
  values (v_sid, v_vid, (v_s ->> 'started_at')::timestamptz, (v_s ->> 'last_activity_at')::timestamptz,
    coalesce(v_s ->> 'landing_path', '/'), coalesce(v_s ->> 'landing_page_type', 'other'),
    coalesce(analytics__device(v_s ->> 'device'), 'desktop'), v_s ->> 'browser', v_s ->> 'os',
    nullif(v_s ->> 'country', ''), nullif(v_s ->> 'city', ''))
  on conflict (id) do update
    set last_activity_at = greatest(analytics_sessions.last_activity_at, excluded.last_activity_at),
        country = coalesce(analytics_sessions.country, excluded.country),
        city = coalesce(analytics_sessions.city, excluded.city);

  with ins as (
    insert into analytics_touches (id, visitor_id, session_id, touched_at, fingerprint, landing_path,
      referrer_host, utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id,
      click_id_type, click_id, in_app, source, medium, campaign, channel, inferred, excluded)
    select (t ->> 'id')::uuid, v_vid, v_sid, (t ->> 'at')::timestamptz, coalesce(t ->> 'fingerprint', ''),
      coalesce(t ->> 'landing_path', '/'), t ->> 'referrer_host', t ->> 'utm_source', t ->> 'utm_medium',
      t ->> 'utm_campaign', t ->> 'utm_content', t ->> 'utm_term', t ->> 'utm_id',
      t ->> 'click_id_type', t ->> 'click_id', t ->> 'in_app',
      coalesce(t ->> 'source', '(direct)'), coalesce(t ->> 'medium', '(none)'), t ->> 'campaign',
      coalesce(t ->> 'channel', 'Unassigned'), coalesce((t ->> 'inferred')::boolean, false),
      coalesce((t ->> 'excluded')::boolean, false)
    from jsonb_array_elements(coalesce(p -> 'touches', '[]'::jsonb)) t
    on conflict (id) do nothing
    returning 1
  )
  select count(*) into n_t from ins;

  -- The first touch of a session sets its acquisition, once.
  update analytics_sessions se
     set touch_id = ft.id, channel = ft.channel, source = ft.source, medium = ft.medium,
         campaign = ft.campaign, inferred = ft.inferred
    from (
      select x.id, x.channel, x.source, x.medium, x.campaign, x.inferred
      from analytics_touches x where x.session_id = v_sid
      order by x.touched_at asc, x.id asc limit 1
    ) ft
   where se.id = v_sid and se.touch_id is null;

  with ins as (
    insert into analytics_page_views as pv (id, session_id, viewed_at, path, page_type, product_slug,
      title, engaged_ms, max_scroll_pct)
    select (v ->> 'id')::uuid, v_sid, (v ->> 'viewed_at')::timestamptz, coalesce(v ->> 'path', '/'),
      coalesce(v ->> 'page_type', 'other'), v ->> 'product_slug', v ->> 'title',
      least(greatest(coalesce((v ->> 'engaged_ms')::integer, 0), 0), 21600000),
      least(greatest(coalesce((v ->> 'max_scroll_pct')::integer, 0), 0), 100)
    from jsonb_array_elements(coalesce(p -> 'page_views', '[]'::jsonb)) v
    on conflict (id) do update
      set engaged_ms = greatest(pv.engaged_ms, excluded.engaged_ms),
          max_scroll_pct = greatest(pv.max_scroll_pct, excluded.max_scroll_pct),
          title = coalesce(excluded.title, pv.title)
      where pv.session_id = excluded.session_id
    returning 1
  )
  select count(*) into n_pv from ins;

  with ins as (
    insert into analytics_events (id, session_id, page_view_id, name, occurred_at, product_id,
      product_slug, value, props)
    select (e ->> 'id')::uuid, v_sid, nullif(e ->> 'page_view_id', '')::uuid, e ->> 'name',
      (e ->> 'occurred_at')::timestamptz, nullif(e ->> 'product_id', '')::uuid, e ->> 'product_slug',
      nullif(e ->> 'value', '')::numeric, coalesce(e -> 'props', '{}'::jsonb)
    from jsonb_array_elements(coalesce(p -> 'events', '[]'::jsonb)) e
    on conflict (id) do nothing
    returning 1
  )
  select count(*) into n_ev from ins;

  return jsonb_build_object('skipped', false, 'touches', n_t, 'page_views', n_pv, 'events', n_ev);
end;
$$;

create or replace function public.analytics_attribute_order(p jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_last jsonb := nullif(p -> 'last_touch', 'null'::jsonb);
  v_first jsonb := nullif(p -> 'first_touch', 'null'::jsonb);
begin
  insert into analytics_order_attribution (order_id, visitor_id, session_id, first_touch, last_touch,
    touch_count, channel, source, medium, campaign, fbclid, fbclid_at, fbp, fbc, user_agent, country)
  values ((p ->> 'order_id')::uuid, (p ->> 'visitor_id')::uuid, (p ->> 'session_id')::uuid,
    v_first, v_last, greatest(coalesce((p ->> 'touch_count')::integer, 0), 0),
    coalesce(v_last ->> 'channel', 'Direct'), coalesce(v_last ->> 'source', '(direct)'),
    coalesce(v_last ->> 'medium', '(none)'), v_last ->> 'campaign',
    p ->> 'fbclid', nullif(p ->> 'fbclid_at', '')::timestamptz, p ->> 'fbp', p ->> 'fbc',
    p ->> 'user_agent', nullif(p ->> 'country', ''))
  on conflict (order_id) do nothing;
end;
$$;

create or replace function public.analytics_capi_context(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('fbclid', a.fbclid, 'fbclid_at', a.fbclid_at, 'fbp', a.fbp,
    'fbc', a.fbc, 'user_agent', a.user_agent)
  from analytics_order_attribution a
  where a.order_id = (p ->> 'order_id')::uuid
$$;

-- ---- dashboard sections ------------------------------------------------------

create or replace function public.analytics_summary(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'current', analytics__summary_window((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'), coalesce(p ->> 'granularity', 'day')),
    'previous', case
      when nullif(p ->> 'prev_from', '') is null or nullif(p ->> 'prev_to', '') is null then null
      else analytics__summary_window((p ->> 'prev_from')::timestamptz, (p ->> 'prev_to')::timestamptz,
        analytics__device(p ->> 'device'), coalesce(p ->> 'granularity', 'day'))
    end)
$$;

create or replace function public.analytics__funnel_counts(p_from timestamptz, p_to timestamptz, p_device text)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_array(
    count(*),
    count(*) filter (where max_step >= 2),
    count(*) filter (where max_step >= 3),
    count(*) filter (where max_step >= 4),
    count(*) filter (where max_step >= 5),
    count(*) filter (where max_step >= 6),
    count(*) filter (where max_step >= 7))
  from analytics__session_facts(p_from, p_to, p_device)
$$;

create or replace function public.analytics_funnel(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'current', analytics__funnel_counts((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device')),
    'previous', case
      when nullif(p ->> 'prev_from', '') is null or nullif(p ->> 'prev_to', '') is null then null
      else analytics__funnel_counts((p ->> 'prev_from')::timestamptz, (p ->> 'prev_to')::timestamptz,
        analytics__device(p ->> 'device'))
    end)
$$;

-- Merge a session-side and an order-side breakdown into rows (json).
create or replace function public.analytics__merge_rows(p_sessions jsonb, p_orders jsonb, p_limit integer)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(r order by (r ->> 'sessions')::integer desc,
    (r ->> 'revenue')::numeric desc, r ->> 'key'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'key', coalesce(s.key, o.key),
      'sessions', coalesce(s.sessions, 0), 'adds', coalesce(s.adds, 0),
      'bounces', coalesce(s.bounces, 0), 'orders', coalesce(o.orders, 0),
      'revenue', coalesce(o.revenue, 0)) as r
    from jsonb_to_recordset(p_sessions) as s(key text, sessions integer, adds integer, bounces integer)
    full join jsonb_to_recordset(p_orders) as o(key text, orders integer, revenue numeric)
      on o.key = s.key
    order by coalesce(s.sessions, 0) desc, coalesce(o.revenue, 0) desc, coalesce(s.key, o.key)
    limit p_limit
  ) q
$$;

create or replace function public.analytics_acquisition(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  with f as materialized (
    select * from analytics__session_facts((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'))
  ),
  o as materialized (
    select * from analytics__paid_orders((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'))
  ),
  camp_s as (
    select campaign as key, min(source || ' / ' || medium) as source_medium, count(*) as sessions,
      count(*) filter (where added) as adds, count(*) filter (where bounced) as bounces
    from f where campaign is not null group by campaign
  ),
  camp_o as (
    select a_campaign as key, min(a_source || ' / ' || a_medium) as source_medium,
      count(*) as orders, sum(total) as revenue
    from o where tracked and a_campaign is not null group by a_campaign
  ),
  camp as (
    select coalesce(s.key, x.key) as key, coalesce(s.source_medium, x.source_medium) as source_medium,
      coalesce(s.sessions, 0) as sessions, coalesce(s.adds, 0) as adds,
      coalesce(s.bounces, 0) as bounces, coalesce(x.orders, 0) as orders,
      coalesce(x.revenue, 0) as revenue
    from camp_s s full join camp_o x on x.key = s.key
    order by coalesce(x.revenue, 0) desc, coalesce(s.sessions, 0) desc, coalesce(s.key, x.key)
    limit 100
  )
  select jsonb_build_object(
    'channels', analytics__merge_rows(
      coalesce((select jsonb_agg(jsonb_build_object('key', channel, 'sessions', n, 'adds', a, 'bounces', b))
        from (select channel, count(*) as n, count(*) filter (where added) as a,
                count(*) filter (where bounced) as b from f group by channel) z), '[]'::jsonb),
      coalesce((select jsonb_agg(jsonb_build_object('key', a_channel, 'orders', n, 'revenue', r))
        from (select a_channel, count(*) as n, sum(total) as r from o where tracked group by a_channel) z),
        '[]'::jsonb),
      100),
    'source_medium', analytics__merge_rows(
      coalesce((select jsonb_agg(jsonb_build_object('key', k, 'sessions', n, 'adds', a, 'bounces', b))
        from (select source || ' / ' || medium as k, count(*) as n, count(*) filter (where added) as a,
                count(*) filter (where bounced) as b from f group by 1) z), '[]'::jsonb),
      coalesce((select jsonb_agg(jsonb_build_object('key', k, 'orders', n, 'revenue', r))
        from (select a_source || ' / ' || a_medium as k, count(*) as n, sum(total) as r
              from o where tracked group by 1) z), '[]'::jsonb),
      100),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object('key', c.key, 'source_medium', c.source_medium,
        'sessions', c.sessions, 'adds', c.adds, 'bounces', c.bounces, 'orders', c.orders,
        'revenue', c.revenue) order by c.revenue desc, c.sessions desc, c.key)
      from camp c), '[]'::jsonb),
    'landing', analytics__merge_rows(
      coalesce((select jsonb_agg(jsonb_build_object('key', landing_path, 'sessions', n, 'adds', a, 'bounces', b))
        from (select landing_path, count(*) as n, count(*) filter (where added) as a,
                count(*) filter (where bounced) as b from f group by landing_path) z), '[]'::jsonb),
      coalesce((select jsonb_agg(jsonb_build_object('key', a_landing, 'orders', n, 'revenue', r))
        from (select a_landing, count(*) as n, sum(total) as r
              from o where tracked and a_landing is not null group by a_landing) z), '[]'::jsonb),
      100),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('order_id', x.order_id,
        'short_id', analytics__short_id(x.order_id), 'paid_at', x.paid_at, 'total', x.total,
        'tracked', x.tracked, 'session_id', x.session_id, 'first_touch', x.first_touch,
        'last_touch', x.last_touch, 'touches', x.touch_count,
        'days_to_purchase', case when x.first_touch ? 'at'
          then greatest(floor(extract(epoch from (x.paid_at - (x.first_touch ->> 'at')::timestamptz)) / 86400), 0)::integer
          else null end)
        order by x.paid_at desc)
      from (select * from o order by paid_at desc limit 200) x), '[]'::jsonb),
    'not_tracked', (select jsonb_build_object('orders', count(*), 'revenue', coalesce(sum(total), 0))
      from o where not tracked),
    'totals', jsonb_build_object(
      'sessions', (select count(*) from f),
      'orders', (select count(*) from o),
      'revenue', (select coalesce(sum(total), 0) from o))
  )
$$;

create or replace function public.analytics_products(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  with f as (
    select * from analytics__session_facts((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'))
  ),
  o as (
    select * from analytics__paid_orders((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'))
  ),
  ev as (
    select e.session_id, e.name, e.product_slug,
      lower(trim(coalesce(pr.name, e.props ->> 'name'))) as key,
      coalesce(pr.name, e.props ->> 'name') as display
    from analytics_events e
    join f on f.session_id = e.session_id
    left join products pr on pr.id = e.product_id
    where e.name in ('view_item', 'add_to_cart')
      and coalesce(pr.name, e.props ->> 'name') is not null
  ),
  views as (
    select key, count(distinct session_id) as views, min(display) as display
    from ev where name = 'view_item' group by key
  ),
  adds as (
    select key, count(distinct session_id) as adds from ev where name = 'add_to_cart' group by key
  ),
  slugs as (
    select distinct on (key) key, product_slug as slug
    from (select key, product_slug, count(*) as n from ev
          where name = 'view_item' and product_slug is not null group by key, product_slug) z
    order by key, n desc, product_slug
  ),
  -- Lines of paid orders attributed to sessions in range, for view -> purchase.
  bought as (
    select distinct a.session_id, lower(trim(coalesce(pr.name, oi.product_name))) as key
    from analytics_order_attribution a
    join orders od on od.id = a.order_id and od.status = 'paid'
    join order_items oi on oi.order_id = od.id
    left join products pr on pr.id = oi.product_id
    join f on f.session_id = a.session_id
  ),
  view_purchases as (
    select v.key, count(distinct v.session_id) as n
    from (select distinct session_id, key from ev where name = 'view_item') v
    join bought b on b.session_id = v.session_id and b.key = v.key
    group by v.key
  ),
  sales as (
    select lower(trim(coalesce(pr.name, oi.product_name))) as key,
      min(coalesce(pr.name, oi.product_name)) as display,
      min(oi.product_slug) as slug,
      count(distinct oi.order_id) as orders, sum(oi.quantity) as units, sum(oi.line_total) as revenue
    from o join order_items oi on oi.order_id = o.order_id
    left join products pr on pr.id = oi.product_id
    group by 1
  ),
  keys as (select key from views union select key from sales),
  rows as (
    select k.key,
      coalesce(v.display, s.display, k.key) as name,
      coalesce(sl.slug, s.slug) as slug,
      coalesce(v.views, 0) as views,
      coalesce(a.adds, 0) as adds,
      coalesce(vp.n, 0) as view_purchases,
      coalesce(s.orders, 0) as orders,
      coalesce(s.units, 0) as units,
      coalesce(s.revenue, 0) as revenue
    from keys k
    left join views v on v.key = k.key
    left join adds a on a.key = k.key
    left join slugs sl on sl.key = k.key
    left join view_purchases vp on vp.key = k.key
    left join sales s on s.key = k.key
    where k.key is not null and (coalesce(v.views, 0) > 0 or coalesce(s.units, 0) > 0)
    order by coalesce(s.revenue, 0) desc, coalesce(v.views, 0) desc, k.key
    limit 200
  )
  select jsonb_build_object('rows', coalesce((
    select jsonb_agg(jsonb_build_object('key', r.key, 'name', r.name, 'slug', r.slug, 'views', r.views,
      'adds', r.adds, 'view_purchases', r.view_purchases, 'orders', r.orders, 'units', r.units,
      'revenue', r.revenue) order by r.revenue desc, r.views desc, r.key)
    from rows r), '[]'::jsonb))
$$;

create or replace function public.analytics_promotions(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  with o as (
    select * from analytics__paid_orders((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'))
  ),
  f as (
    select * from analytics__session_facts((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'))
  ),
  coded as (
    select case when upper(discount_code) like 'CHARM-%' then 'WELCOME' else upper(discount_code) end as code,
      total, discount_amount
    from o where discount_code is not null
  ),
  welcome as (
    select dc.code from discount_codes dc
    where upper(dc.code) like 'CHARM-%'
      and dc.created_at >= (p ->> 'from')::timestamptz and dc.created_at < (p ->> 'to')::timestamptz
  ),
  clicks as (
    select e.session_id from analytics_events e join f on f.session_id = e.session_id
    where e.name = 'promo_click'
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object('code', c.code, 'orders', c.orders, 'revenue', c.revenue,
        'discount', c.discount) order by c.orders desc, c.revenue desc, c.code)
      from (select code, count(*) as orders, sum(total) as revenue, sum(discount_amount) as discount
            from coded group by code) c), '[]'::jsonb),
    'total_orders', (select count(*) from o),
    'no_promo', (select jsonb_build_object('orders', count(*), 'revenue', coalesce(sum(total), 0))
                 from o where discount_code is null),
    'welcome', jsonb_build_object(
      'issued', (select count(*) from welcome),
      'redeemed', (select count(*) from welcome w where exists (
        select 1 from orders x where x.status = 'paid' and upper(trim(x.discount_code)) = upper(w.code)))),
    'banners', jsonb_build_object(
      'clicks', (select count(*) from clicks),
      'sessions', (select count(distinct session_id) from clicks),
      'orders', (select coalesce(sum(f.paid_orders), 0) from f
                 where f.session_id in (select session_id from clicks)),
      'revenue', (select coalesce(sum(f.paid_revenue), 0) from f
                  where f.session_id in (select session_id from clicks))))
$$;

create or replace function public.analytics_devices(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  with f as (
    select * from analytics__session_facts((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'))
  ),
  o as (
    select * from analytics__paid_orders((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'))
  ),
  adds as (
    select e.props ->> 'source' as src
    from analytics_events e join f on f.session_id = e.session_id
    where e.name = 'add_to_cart' and f.device in ('mobile', 'tablet')
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object('device', d.device, 'sessions', d.sessions,
        'orders', d.orders, 'revenue', d.revenue)
        order by array_position(array['mobile', 'tablet', 'desktop'], d.device))
      from (
        select coalesce(s.device, x.device) as device, coalesce(s.sessions, 0) as sessions,
          coalesce(x.orders, 0) as orders, coalesce(x.revenue, 0) as revenue
        from (select device, count(*) as sessions from f group by device) s
        full join (select a_device as device, count(*) as orders, sum(total) as revenue
                   from o where a_device is not null group by a_device) x on x.device = s.device
      ) d), '[]'::jsonb),
    'sticky', jsonb_build_object(
      'mobile_adds', (select count(*) from adds),
      'sticky_adds', (select count(*) from adds where src = 'pdp_sticky')))
$$;

create or replace function public.analytics_pages(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  with v as (
    select pv.session_id, pv.path, pv.title, pv.viewed_at, pv.engaged_ms,
      row_number() over (partition by pv.session_id order by pv.viewed_at desc, pv.id desc) as rn_last
    from analytics_page_views pv
    join analytics_sessions s on s.id = pv.session_id
    where pv.viewed_at >= (p ->> 'from')::timestamptz and pv.viewed_at < (p ->> 'to')::timestamptz
      and (analytics__device(p ->> 'device') is null or s.device = analytics__device(p ->> 'device'))
  ),
  g as (
    select path, count(*) as views, coalesce(sum(engaged_ms), 0) as engaged_ms,
      count(*) filter (where rn_last = 1) as exits,
      (array_agg(title order by viewed_at desc) filter (where title is not null))[1] as title
    from v group by path
  )
  select jsonb_build_object('rows', coalesce((
    select jsonb_agg(jsonb_build_object('path', g.path, 'title', g.title, 'views', g.views,
      'engaged_ms', g.engaged_ms, 'exits', g.exits) order by g.views desc, g.path)
    from (select * from g order by views desc, path limit 100) g), '[]'::jsonb))
$$;

create or replace function public.analytics_search(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  with f as (
    select * from analytics__session_facts((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'))
  ),
  s as (
    select e.session_id, e.occurred_at, lower(trim(e.props ->> 'term')) as term,
      coalesce((e.props ->> 'results')::integer, 0) as results
    from analytics_events e join f on f.session_id = e.session_id
    where e.name = 'search' and coalesce(trim(e.props ->> 'term'), '') <> ''
  ),
  s2 as (
    select s.*, exists (
      select 1 from analytics_page_views pv
      where pv.session_id = s.session_id and pv.page_type = 'product'
        and pv.viewed_at > s.occurred_at and pv.viewed_at <= s.occurred_at + interval '30 minutes'
    ) as led
    from s
  )
  select jsonb_build_object(
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('term', t.term, 'searches', t.searches,
        'led_to_view', t.led) order by t.searches desc, t.term)
      from (select term, count(*) as searches, count(*) filter (where led) as led
            from s2 group by term order by count(*) desc, term limit 20) t), '[]'::jsonb),
    'no_results', coalesce((
      select jsonb_agg(jsonb_build_object('term', t.term, 'searches', t.searches,
        'last_at', t.last_at) order by t.searches desc, t.term)
      from (select term, count(*) as searches, max(occurred_at) as last_at
            from s2 where results = 0 group by term order by count(*) desc, term limit 20) t), '[]'::jsonb))
$$;

create or replace function public.analytics_when(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (
    select (extract(isodow from analytics__sast(s.started_at))::integer - 1) as d,
      extract(hour from analytics__sast(s.started_at))::integer as h, count(*) as n
    from analytics_sessions s
    where s.started_at >= (p ->> 'from')::timestamptz and s.started_at < (p ->> 'to')::timestamptz
      and (analytics__device(p ->> 'device') is null or s.device = analytics__device(p ->> 'device'))
    group by 1, 2
  ),
  grid as (
    select d.d, jsonb_agg(coalesce(c.n, 0) order by h.h) as hours
    from generate_series(0, 6) as d(d)
    cross join generate_series(0, 23) as h(h)
    left join c on c.d = d.d and c.h = h.h
    group by d.d
  )
  select jsonb_build_object('cells', (select jsonb_agg(grid.hours order by grid.d) from grid))
$$;

create or replace function public.analytics_geography(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  with f as (
    select * from analytics__session_facts((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'))
  ),
  o as (
    select * from analytics__paid_orders((p ->> 'from')::timestamptz, (p ->> 'to')::timestamptz,
      analytics__device(p ->> 'device'))
    where tracked
  )
  select jsonb_build_object(
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object('code', x.code, 'sessions', x.sessions, 'orders', x.orders,
        'revenue', x.revenue) order by x.sessions desc, x.revenue desc, x.code)
      from (
        select coalesce(s.code, q.code) as code, coalesce(s.sessions, 0) as sessions,
          coalesce(q.orders, 0) as orders, coalesce(q.revenue, 0) as revenue
        from (select coalesce(country, 'ZZ') as code, count(*) as sessions from f group by 1) s
        full join (select coalesce(a_country, 'ZZ') as code, count(*) as orders, sum(total) as revenue
                   from o group by 1) q on q.code = s.code
        order by coalesce(s.sessions, 0) desc, coalesce(q.revenue, 0) desc, coalesce(s.code, q.code)
        limit 50
      ) x), '[]'::jsonb),
    'cities', case when exists (select 1 from f where city is not null) then coalesce((
      select jsonb_agg(jsonb_build_object('name', x.name, 'country', x.country, 'sessions', x.sessions,
        'orders', x.orders, 'revenue', x.revenue) order by x.sessions desc, x.revenue desc, x.name)
      from (
        select coalesce(s.name, q.name) as name, coalesce(s.country, q.country) as country,
          coalesce(s.sessions, 0) as sessions, coalesce(q.orders, 0) as orders,
          coalesce(q.revenue, 0) as revenue
        from (select city as name, coalesce(country, 'ZZ') as country, count(*) as sessions
              from f where city is not null group by 1, 2) s
        full join (select a_city as name, coalesce(a_country, 'ZZ') as country, count(*) as orders,
                     sum(total) as revenue
                   from o where a_city is not null group by 1, 2) q
          on q.name = s.name and q.country = s.country
        order by coalesce(s.sessions, 0) desc, coalesce(q.revenue, 0) desc, coalesce(s.name, q.name)
        limit 50
      ) x), '[]'::jsonb) else null end)
$$;

create or replace function public.analytics_health(p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ever', exists (select 1 from analytics_sessions),
    'events_24h', (select count(*) from analytics_events where occurred_at > now() - interval '24 hours'),
    'page_views_24h', (select count(*) from analytics_page_views where viewed_at > now() - interval '24 hours'),
    'last_at', greatest(
      (select max(viewed_at) from analytics_page_views),
      (select max(occurred_at) from analytics_events)))
$$;

-- ---- journeys ----------------------------------------------------------------

create or replace function public.analytics_journeys(p jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_from timestamptz := (p ->> 'from')::timestamptz;
  v_to timestamptz := (p ->> 'to')::timestamptz;
  v_dev text := analytics__device(p ->> 'device');
  v_outcome text := coalesce(nullif(p ->> 'outcome', ''), 'any');
  v_channel text := nullif(p ->> 'channel', '');
  v_campaign text := nullif(p ->> 'campaign', '');
  v_step integer := array_position(array['sessions', 'viewed_product', 'added_to_bag',
    'reached_checkout', 'entered_email', 'clicked_pay', 'paid'], nullif(p ->> 'step', ''));
  v_q text := nullif(trim(coalesce(p ->> 'q', '')), '');
  v_size integer := least(greatest(coalesce((p ->> 'page_size')::integer, 25), 1), 50);
  v_page integer := greatest(coalesce((p ->> 'page')::integer, 1), 1);
  v_hex text;
  v_visitors uuid[];
  v_search boolean := false;
begin
  if v_q is not null then
    -- A search ignores the date range and filters: find the order, then every
    -- visit of the visitors attributed to it.
    v_search := true;
    v_hex := lower(regexp_replace(v_q, '^#', ''));
    if v_hex ~ '^[0-9a-f]{8}$' then
      select array_agg(distinct a.visitor_id) into v_visitors
      from analytics_order_attribution a join orders o on o.id = a.order_id
      where left(o.id::text, 8) = v_hex;
    elsif position('@' in v_q) > 0 then
      select array_agg(distinct a.visitor_id) into v_visitors
      from analytics_order_attribution a join orders o on o.id = a.order_id
      where lower(o.email) = lower(v_q);
    end if;
    if v_visitors is null then
      return jsonb_build_object('total', 0, 'rows', '[]'::jsonb,
        'facets', jsonb_build_object('channels', '[]'::jsonb, 'campaigns', '[]'::jsonb));
    end if;
    v_from := '-infinity'::timestamptz;
    v_to := 'infinity'::timestamptz;
    v_dev := null;
    v_outcome := 'any';
    v_channel := null;
    v_campaign := null;
    v_step := null;
  end if;

  return (
    with f as materialized (
      select * from analytics__session_facts(v_from, v_to, v_dev, v_visitors)
    ),
    filtered as materialized (
      select * from f x
      where (v_outcome = 'any'
          or (v_outcome = 'paid' and x.paid_orders > 0)
          or (v_outcome = 'bag' and x.added and x.paid_orders = 0)
          or (v_outcome = 'browsed' and not x.added and x.paid_orders = 0))
        and (v_channel is null or x.channel = v_channel)
        and (v_campaign is null or x.campaign = v_campaign)
        and (v_step is null or x.max_step >= v_step)
    ),
    page as (
      select * from filtered
      order by started_at desc, session_id
      limit v_size offset (v_page - 1) * v_size
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
      'session_id', x.session_id,
      'started_at', x.started_at,
      'visitor_tag', left(md5(x.visitor_id::text), 4),
      'customer_name', (
        select nullif(trim(o.first_name || ' ' || o.last_name), '')
        from analytics_order_attribution a join orders o on o.id = a.order_id
        where a.visitor_id = x.visitor_id order by o.created_at desc limit 1),
      'channel', x.channel, 'source', x.source, 'medium', x.medium, 'campaign', x.campaign,
      'inferred', x.inferred, 'landing_path', x.landing_path, 'pages', x.pages,
      'engaged_ms', x.engaged_ms,
      'outcome', case when x.paid_orders > 0 then 'paid' when x.added then 'bag' else 'browsed' end,
      'paid_total', x.paid_revenue,
      'order_short_id', (
        select analytics__short_id(o.id)
        from analytics_order_attribution a join orders o on o.id = a.order_id
        where a.session_id = x.session_id and o.status = 'paid' order by o.paid_at desc limit 1),
      'bag_value', x.bag_value) order by x.started_at desc, x.session_id)
        from page x), '[]'::jsonb),
      'facets', case when v_search
        then jsonb_build_object('channels', '[]'::jsonb, 'campaigns', '[]'::jsonb)
        else jsonb_build_object(
          'channels', coalesce((select jsonb_agg(distinct channel) from f), '[]'::jsonb),
          'campaigns', coalesce((select jsonb_agg(distinct campaign) from f
                                 where campaign is not null), '[]'::jsonb))
        end)
  );
end;
$$;

create or replace function public.analytics_journey(p jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_sid uuid := (p ->> 'session_id')::uuid;
  v_s analytics_sessions%rowtype;
  v_visitors uuid[];
  v_session jsonb;
  v_visitor jsonb;
  v_orders jsonb;
  v_timeline jsonb;
  v_sessions jsonb;
begin
  select * into v_s from analytics_sessions where id = v_sid;
  if not found then
    return null;
  end if;

  -- Stitch only through orders: this visitor, plus visitors attributed to an
  -- order placed with the same email as one of this visitor's orders.
  select array_agg(distinct x.visitor_id) into v_visitors
  from (
    select v_s.visitor_id as visitor_id
    union
    select a2.visitor_id
    from analytics_order_attribution a1
    join orders o1 on o1.id = a1.order_id
    join orders o2 on lower(o2.email) = lower(o1.email)
    join analytics_order_attribution a2 on a2.order_id = o2.id
    where a1.visitor_id = v_s.visitor_id
  ) x;

  select jsonb_build_object(
    'id', v_s.id, 'started_at', v_s.started_at, 'ended_at', v_s.last_activity_at,
    'channel', v_s.channel, 'source', v_s.source, 'medium', v_s.medium, 'campaign', v_s.campaign,
    'inferred', v_s.inferred, 'landing_path', v_s.landing_path, 'device', v_s.device,
    'browser', v_s.browser, 'os', v_s.os, 'country', v_s.country, 'city', v_s.city,
    'pages', (select count(*) from analytics_page_views where session_id = v_sid),
    'engaged_ms', (select coalesce(sum(engaged_ms), 0) from analytics_page_views where session_id = v_sid))
  into v_session;

  select jsonb_build_object(
    'tag', left(md5(v_s.visitor_id::text), 4),
    'customer_name', (
      select nullif(trim(o.first_name || ' ' || o.last_name), '')
      from analytics_order_attribution a join orders o on o.id = a.order_id
      where a.visitor_id = any(v_visitors) order by o.created_at desc limit 1),
    'first_seen_at', (select first_seen_at from analytics_visitors where id = v_s.visitor_id),
    'sessions', (select count(*) from analytics_sessions where visitor_id = any(v_visitors)),
    'first_touch', (
      select analytics__touch_json(t.touched_at, t.landing_path, t.source, t.medium, t.campaign,
        t.utm_content, t.utm_term, t.channel, t.inferred, t.click_id_type)
      from analytics_touches t
      where t.visitor_id = any(v_visitors) and not t.excluded and t.channel <> 'Direct'
      order by t.touched_at asc limit 1))
  into v_visitor;

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'short_id', analytics__short_id(o.id),
    'total', o.total, 'status', o.status, 'paid_at', o.paid_at, 'session_id', a.session_id)
    order by o.created_at desc), '[]'::jsonb)
  into v_orders
  from analytics_order_attribution a join orders o on o.id = a.order_id
  where a.visitor_id = any(v_visitors);

  select coalesce(jsonb_agg(item order by (item ->> 'at')::timestamptz, item ->> 'kind'), '[]'::jsonb)
  into v_timeline
  from (
    select item from (
      select jsonb_build_object('kind', 'page', 'at', pv.viewed_at, 'path', pv.path, 'title', pv.title,
        'page_type', pv.page_type, 'engaged_ms', pv.engaged_ms, 'scroll_pct', pv.max_scroll_pct) as item,
        pv.viewed_at as at
      from analytics_page_views pv where pv.session_id = v_sid
      union all
      select jsonb_build_object('kind', 'event', 'at', e.occurred_at, 'name', e.name, 'props', e.props),
        e.occurred_at
      from analytics_events e where e.session_id = v_sid
      union all
      select jsonb_build_object('kind', 'touch', 'at', t.touched_at, 'touch',
        analytics__touch_json(t.touched_at, t.landing_path, t.source, t.medium, t.campaign,
          t.utm_content, t.utm_term, t.channel, t.inferred, t.click_id_type)),
        t.touched_at
      from analytics_touches t where t.session_id = v_sid
      union all
      select jsonb_build_object('kind', 'order', 'at', o.paid_at, 'order_id', o.id,
        'short_id', analytics__short_id(o.id), 'total', o.total),
        o.paid_at
      from analytics_order_attribution a join orders o on o.id = a.order_id
      where a.session_id = v_sid and o.status = 'paid' and o.paid_at is not null
    ) u
    order by u.at
    limit 500
  ) capped;

  select coalesce(jsonb_agg(r order by (r ->> 'started_at')::timestamptz desc), '[]'::jsonb)
  into v_sessions
  from (
    select jsonb_build_object(
      'id', s.id, 'started_at', s.started_at, 'channel', s.channel, 'source', s.source,
      'medium', s.medium, 'campaign', s.campaign, 'landing_path', s.landing_path,
      'pages', (select count(*) from analytics_page_views where session_id = s.id),
      'outcome', case
        when exists (select 1 from analytics_order_attribution a join orders o on o.id = a.order_id
                     where a.session_id = s.id and o.status = 'paid') then 'paid'
        when exists (select 1 from analytics_events e where e.session_id = s.id and e.name = 'add_to_cart')
          then 'bag'
        else 'browsed' end,
      'paid_total', (select coalesce(sum(o.total), 0) from analytics_order_attribution a
                     join orders o on o.id = a.order_id
                     where a.session_id = s.id and o.status = 'paid'),
      'stitched', s.visitor_id <> v_s.visitor_id) as r
    from analytics_sessions s
    where s.visitor_id = any(v_visitors)
    order by s.started_at desc
    limit 50
  ) q;

  return jsonb_build_object('session', v_session, 'visitor', v_visitor, 'orders', v_orders,
    'timeline', v_timeline, 'sessions', v_sessions);
end;
$$;

-- ---- retention ---------------------------------------------------------------

-- Runs at most once a day (the overview calls it on every load; the guard row
-- in analytics_meta makes the rest no-ops). Never touches order attribution.
create or replace function public.analytics_purge(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_cut timestamptz := now() - interval '13 months';
  v_ran integer;
  n_s integer := 0;
  n_t integer := 0;
  n_v integer := 0;
begin
  update analytics_meta set updated_at = now()
   where key = 'purge' and updated_at < now() - interval '1 day';
  get diagnostics v_ran = row_count;
  if v_ran = 0 then
    return jsonb_build_object('ran', false, 'sessions', 0, 'touches', 0, 'visitors', 0);
  end if;

  delete from analytics_sessions where last_activity_at < v_cut;
  get diagnostics n_s = row_count;
  delete from analytics_touches where touched_at < v_cut;
  get diagnostics n_t = row_count;
  delete from analytics_visitors v
   where v.last_seen_at < v_cut
     and not exists (select 1 from analytics_sessions s where s.visitor_id = v.id);
  get diagnostics n_v = row_count;

  return jsonb_build_object('ran', true, 'sessions', n_s, 'touches', n_t, 'visitors', n_v);
end;
$$;

-- Data-subject request: forget one customer's visits. Run by a developer in
-- the SQL editor (select public.analytics_forget('name@example.com');).
create or replace function public.analytics_forget(p_email text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_visitors uuid[];
  n_v integer := 0;
  n_a integer := 0;
begin
  select array_agg(distinct a.visitor_id) into v_visitors
  from analytics_order_attribution a join orders o on o.id = a.order_id
  where lower(o.email) = lower(trim(p_email));

  if v_visitors is not null then
    delete from analytics_visitors where id = any(v_visitors);
    get diagnostics n_v = row_count;
  end if;

  delete from analytics_order_attribution a using orders o
   where o.id = a.order_id and lower(o.email) = lower(trim(p_email));
  get diagnostics n_a = row_count;

  return jsonb_build_object('visitors', n_v, 'attributions', n_a);
end;
$$;

-- ---- function privileges -----------------------------------------------------

do $$
declare
  fn text;
begin
  -- Public API functions: service_role only.
  foreach fn in array array[
    'analytics_ingest(jsonb)', 'analytics_attribute_order(jsonb)', 'analytics_capi_context(jsonb)',
    'analytics_summary(jsonb)', 'analytics_funnel(jsonb)', 'analytics_acquisition(jsonb)',
    'analytics_products(jsonb)', 'analytics_promotions(jsonb)', 'analytics_devices(jsonb)',
    'analytics_pages(jsonb)', 'analytics_search(jsonb)', 'analytics_when(jsonb)',
    'analytics_geography(jsonb)', 'analytics_health(jsonb)', 'analytics_journeys(jsonb)',
    'analytics_journey(jsonb)', 'analytics_purge(jsonb)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;

  -- Internal helpers and the developer-only forget: no API role at all.
  foreach fn in array array[
    'analytics__sast(timestamptz)', 'analytics__bucket(timestamptz, timestamptz, text)',
    'analytics__device(text)', 'analytics__short_id(uuid)',
    'analytics__session_facts(timestamptz, timestamptz, text, uuid[])',
    'analytics__paid_orders(timestamptz, timestamptz, text)',
    'analytics__merge_rows(jsonb, jsonb, integer)',
    'analytics__summary_window(timestamptz, timestamptz, text, text)',
    'analytics__touch_json(timestamptz, text, text, text, text, text, text, text, boolean, text)',
    'analytics__funnel_counts(timestamptz, timestamptz, text)',
    'analytics_forget(text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated, service_role', fn);
  end loop;
end;
$$;
