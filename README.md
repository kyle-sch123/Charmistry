# Charmistry

E-commerce storefront for **Charmistry** — a South-African jewellery brand
selling water-resistant, tarnish-resistant stainless-steel pieces.

> **At a glance.** Next.js 15 (App Router) + React 19 site, deployed to
> Cloudflare via OpenNext. Supabase is the catalogue + order database,
> PayFast handles payments, Resend sends transactional email, Courier Guy
> dispatches parcels, Klaviyo tracks marketing events. The cart lives in
> the browser (Zustand + localStorage with a 30-day TTL).

---

## Table of contents

1. [Stack](#stack)
2. [Local development](#local-development)
3. [Environment variables](#environment-variables)
4. [Project structure](#project-structure)
5. [Architecture](#architecture)
6. [Database](#database)
7. [Payment flow (end to end)](#payment-flow-end-to-end)
8. [Common operations](#common-operations)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)
11. [Known issues](#known-issues)

---

## Stack

| Concern                | Choice                                         |
|------------------------|------------------------------------------------|
| Framework              | Next.js 15.3 (App Router, Server Components)   |
| UI                     | React 19, Tailwind v4, Framer Motion           |
| State (client)         | Zustand 5, localStorage persist with TTL       |
| Database / Storage     | Supabase (Postgres + Storage buckets)          |
| Payments               | PayFast (ZA market, ZAR currency)              |
| Transactional email    | Resend                                         |
| Shipping / dispatch    | Courier Guy (optional, opt-in via env)         |
| Marketing events       | Klaviyo (optional, opt-in via env)             |
| Analytics              | Google Analytics 4 (optional, opt-in via env)  |
| Deployment target      | Cloudflare Pages via `@opennextjs/cloudflare`  |
| Lint / typecheck       | ESLint 9 + `eslint-config-next`, TS 5          |

Node 20+ is required (matches `@types/node` in package.json).

---

## Local development

```bash
# 1. Install (peer deps need --legacy-peer-deps right now — see Known issues)
npm install --legacy-peer-deps

# 2. Configure env
cp .env.example .env.local
#   then fill in real Supabase + PayFast + Resend keys

# 3. Run dev server
npm run dev
#   open http://localhost:3000
```

The dev server hot-reloads on save. The catalogue is read straight from
Supabase — there is no local DB to set up.

### Available scripts

| Script              | What it does                                              |
|---------------------|-----------------------------------------------------------|
| `npm run dev`       | Next dev server with HMR at :3000                         |
| `npm run build`     | Production build (Next, vanilla)                          |
| `npm run start`     | Serve the production build (after `build`)                |
| `npm run build:cf`  | Build for Cloudflare (`opennextjs-cloudflare build`)      |
| `npm run preview`   | Local Cloudflare preview (`opennextjs-cloudflare preview`)|
| `npm run deploy`    | Deploy to Cloudflare (`opennextjs-cloudflare deploy`)     |
| `npm run lint`      | Run ESLint                                                |
| `npx tsc --noEmit`  | Run TypeScript without emitting (recommended pre-commit)  |

### Running the checkout flow locally

Webhooks need a public URL. Tunnel your dev server with cloudflared or ngrok:

```bash
# ngrok
ngrok http 3000
# or cloudflared
cloudflared tunnel --url http://localhost:3000
```

Set `NEXT_PUBLIC_SITE_URL` in `.env.local` to the tunnel URL — the
checkout route bakes that URL into the `notify_url` form field PayFast
calls back. (PayFast doesn't need a webhook to be pre-registered in a
dashboard the way Paystack does; the notify URL is sent per transaction.)

---

## Environment variables

See `.env.example` for the full list. Quick rundown:

**Required to boot:**

| Var                              | Purpose                                          |
|----------------------------------|--------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`       | Catalogue reads (browser + server).              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Same; safe to expose.                            |
| `SUPABASE_SERVICE_ROLE_KEY`      | Order writes, discount RPCs. Server-only.        |
| `PAYFAST_MERCHANT_ID`            | Without this, checkout 500s.                     |
| `PAYFAST_MERCHANT_KEY`           | Without this, checkout 500s.                     |
| `PAYFAST_PASSPHRASE`             | Optional. If set on your PayFast account it MUST be set here too, or signatures mismatch. |
| `PAYFAST_SANDBOX`                | `"true"` to point at sandbox.payfast.co.za; anything else means live. |
| `RESEND_API_KEY`                 | Transactional email.                             |
| `RESEND_AUDIENCE_ID`             | Newsletter audience.                             |
| `RESEND_FROM_EMAIL`              | "From" address on every send.                    |
| `MERCHANT_NOTIFICATION_EMAIL`    | Fulfilment inbox for new-order alerts.           |
| `NEXT_PUBLIC_SITE_URL`           | Used to build return/cancel/notify URLs sent to PayFast. |

**Optional (feature flags):**

| Var                              | Purpose                                          |
|----------------------------------|--------------------------------------------------|
| `COURIER_GUY_API_BASE_URL`       | Set both to enable automated dispatch.           |
| `COURIER_GUY_API_KEY`            | Set both to enable automated dispatch.           |
| `COURIER_GUY_SENDER_*`           | Your business pickup address (8 vars).           |
| `KLAVIYO_API_KEY`                | Set to enable server-side Placed Order + Ordered Product events. |
| `NEXT_PUBLIC_GA_ID`              | Set to enable GA script injection.               |
| `NEXT_PUBLIC_FB_PIXEL_ID`        | Set to enable Meta (Facebook) Pixel injection.   |
| `S3_BUCKET_NAME`                 | Supabase Storage bucket for product galleries.   |

The optional integrations all have `isXConfigured()` guards — leaving the
key blank disables the call without breaking the rest of the flow.

---

## Project structure

```
src/
  app/                         Routes and pages (App Router).
    api/
      bestsellers/             GET — top 5 in-stock by review_count.
      checkout/                POST — main checkout orchestrator.
      discount/validate/       POST — code preview (does not consume).
      payfast/notify/          POST — PayFast ITN handler (payment finalisation).
      shipping/quote/          POST — live shipping cost estimate.
      subscribe/               POST — newsletter signup + welcome code.
    checkout/                  Form, success page, cancelled page.
    products/[slug]/           Product detail + not-found.
    shop/                      Filterable shop grid.
    care/ faq/ privacy/ shipping/   Static policy pages.
    layout.tsx                 Root layout, fonts, cart drawer mount.
    page.tsx                   Home page composition.
  components/
    analytics/GoogleAnalytics  GA script + pageview emitter.
    analytics/MetaPixel        Meta Pixel script + pageview emitter.
    cart/CartDrawer            Right-side slide-in bag.
    icons/Logo                 Text wordmark.
    layout/{Navbar, MobileMenu, Footer}
    product/ProductDetail      PDP body with variant picker.
    search/SearchOverlay       Full-screen catalogue search.
    sections/                  Home-page sections (Hero, BestSellers, etc.).
    shop/ShopFilterBar         URL-driven filter + sort bar.
    ui/                        ProductCard, ScrollReveal, SectionDivider,
                               TextReveal.
  data/
    navigation.ts              Static nav links.
    testimonials.ts            Hand-curated home-page testimonials.
  hooks/useEmailSubscribe.ts   Newsletter submit hook.
  lib/
    courier-guy.ts             Shipment dispatch.
    discounts.ts               Resolve / consume / refund codes.
    email-templates.ts         Transactional HTML.
    gtag.ts                    GA helpers (no-op when env blank).
    fpixel.ts                  Meta Pixel helpers (no-op when env blank).
    klaviyo.ts                 Server-side order events (Placed/Ordered Product).
    klaviyo-client.ts          Onsite funnel events (Viewed/Added/Started Checkout).
    payfast.ts                 Payment-request build + ITN signature + validate.
    queries.ts                 Anon-side Supabase reads.
    shipping.ts                Shipping price estimator.
    supabase.ts                Anon Supabase client.
    supabase-server.ts         Service-role Supabase client factory.
    utils.ts                   cn() + formatPrice().
  stores/cart.ts               Zustand cart with 30-day TTL persist.
  types/index.ts               Shared domain types.

scripts/
  import-catalogue.mjs         CSV → Supabase products table upserter.

public/                        Static SVG assets (Next.js boilerplate).
.env.example                   Full env var list with comments.
findings.md                    Most recent code-review notes (see also
                               "Known issues" below).
```

Files at the top of each module carry a docblock explaining the why. Read
those first; the per-symbol comments only mark non-obvious decisions
(invariants, workarounds, encoded business rules).

---

## Architecture

### Catalogue reads (public)

```
Server / Client Component
        │
        ▼  (anon key, RLS enforced)
   lib/queries.ts
        │
        ▼
    Supabase
```

Anything user-facing — the shop grid, PDP, bestsellers, search overlay —
calls `lib/queries.ts`, which uses `lib/supabase.ts` (anon client).

### Checkout (the load-bearing path)

```
CheckoutClient (browser)
        │
        ▼  POST /api/checkout
   /api/checkout/route.ts
        │   1. Validate body
        │   2. Fetch products (service role)
        │   3. Compute totals (server-side prices)
        │   4. resolveDiscount() — read-only
        │   5. Insert order (pending)
        │   6. Insert order_items
        │   7. consumeDiscount() — atomic
        │   8. buildPaymentRequest() — signed PayFast form
        ▼
   CheckoutClient builds a hidden POST form
   and submits it to PayFast's hosted page
        │
        ▼  (user pays)
   PayFast → /checkout/success?order=… → cart cleared, success page
        │
        ▼  (async, server-to-server ITN)
   /api/payfast/notify
        │   1. Parse form-encoded body, verify MD5 signature
        │   2. Server-to-server replay to PayFast /eng/query/validate
        │   3. Check amount_gross matches order.total
        │   4. UPDATE orders SET status='paid' WHERE status='pending'
        │      (.select("id") → losers of the race bail before side effects)
        │   5. Send confirmation emails (Resend)
        │   6. Track Placed Order (Klaviyo, if configured)
        │   7. Create shipment (Courier Guy, if configured)
        │   8. Track Shipped Order (Klaviyo, if configured)
```

The ITN is the source of truth for payment state. The success page is
purely UX — it does NOT confirm anything happened. PayFast retries the
ITN aggressively on 4xx/5xx, so anything non-200 should be a real failure
worth investigating, not a soft "ignore".

### Discount lifecycle

```
resolveDiscount → returns { code, amount } or error string
                  (read-only — does NOT mutate)
                          │
                          ▼
                 used by /api/discount/validate
                 used by /api/checkout pricing

consumeDiscount → calls Supabase RPC `redeem_discount_code`
                  RPC atomically increments uses_count
                  returns false if already exhausted
                          │
                          ▼
                 only called from /api/checkout AFTER order is persisted

refundDiscount  → calls Supabase RPC `refund_discount_code`
                  decrements uses_count
                          │
                          ▼
                 only called if PayFast payment-request build errored AFTER consume
```

### Cart (browser state)

Lives entirely in `src/stores/cart.ts` (Zustand + localStorage). Snapshots
the product fields at add-time (price, name, image, maxQuantity) so the
cart renders without re-fetching. The server re-prices everything at
checkout — cart fields are display-only.

Persisted carts older than 30 days are dropped on rehydration so a returning
visitor doesn't checkout at last quarter's prices.

---

## Database

All schema lives in `supabase/migrations/`. On a fresh project, apply them
in numerical order via the Supabase SQL editor or `supabase db push`:

| File                                  | What it creates                                  |
|---------------------------------------|--------------------------------------------------|
| `000_baseline.sql`                    | `categories`, `products`, `discount_codes`, enums, RLS read policies |
| `001_orders.sql`                      | `orders`, `order_items`, RLS (service-role only) |
| `002_add_order_shipping_columns.sql`  | `shipping_status`, `tracking_*` columns on orders |
| `003_add_material_size.sql`           | `material`, `size` columns on products (no-op if 000 ran first) |
| `004_discount_rpcs.sql`               | `redeem_discount_code()` and `refund_discount_code()` |
| `005_email_canonical.sql`             | `discount_codes.email_canonical` + partial unique index over active rows (welcome-code abuse fix — see "Newsletter signup" below) |
| `006_stock_decrement_rpc.sql`         | `decrement_product_stock()` — atomic, oversell-safe stock debit run on payment confirmation |

The migrations are idempotent (CREATE / ADD IF NOT EXISTS, DO blocks for
enums, CREATE OR REPLACE for functions) so re-running them is safe.

**Storage bucket** — `getProductImages()` in `lib/queries.ts` lists a
Supabase Storage bucket (default name `Charmistry Assets`, override with
`S3_BUCKET_NAME`). Create the bucket in Supabase Studio and make it
publicly listable so the anon role can enumerate the gallery. If you skip
this, the PDP falls back to the row's `image_url` + `images[]` array.

### Tables

**`categories`**
```
id           uuid pk
name         text
slug         text unique  ('rings' | 'necklaces' | 'earrings' |
                           'bracelets' | 'jewellery-boxes')
description  text nullable
image_url    text nullable
created_at   timestamptz
```

**`products`**
```
id             uuid pk
name           text
slug           text unique
description    text nullable
price          numeric         ZAR
category_id    uuid fk → categories.id, nullable
metal          text nullable   ('gold' | 'silver' | 'rose_gold' |
                                'white_gold' | 'platinum')
badge          text nullable   ('NEW' | 'BESTSELLER' | 'LIMITED')
material       text nullable
size           text/numeric nullable   (sentinels: "0" → Adjustable,
                                                   "-1" → 9x10cm box)
image_url      text nullable
images         text[]          additional gallery URLs
in_stock       boolean
rating         numeric nullable
review_count   int
quantity       int
created_at     timestamptz
```

One row per (name, metal). The shop grid de-duplicates on name + category
so variants present as a single tile; the PDP exposes the variant picker.

**`orders`**
```
id                    uuid pk
email                 text
first_name            text
last_name             text
phone                 text nullable
shipping_address_*    text     (line1, line2, city, postal_code, country)
subtotal              numeric
shipping_cost         numeric
discount_code         text nullable
discount_amount       numeric
total                 numeric
currency              text     ('ZAR')
status                text     ('pending' | 'paid' | 'failed' | 'cancelled')
shipping_status       text     ('pending' | 'created' | 'shipped' |
                                'delivered' | 'failed')
courier               text nullable
tracking_number       text nullable
tracking_url          text nullable
waybill_number        text nullable
shipped_at            timestamptz nullable
payfast_payment_id    text nullable    set at checkout to order.id (our `m_payment_id` to PayFast)
payfast_pf_payment_id text nullable    set on ITN to PayFast's `pf_payment_id`
notes                 text nullable
created_at            timestamptz
updated_at            timestamptz
paid_at               timestamptz nullable
```

The column names match the current payment gateway (PayFast). They were
originally PayFast, briefly stored Paystack values during a Paystack
experiment, and now hold PayFast values again. The codebase has no
Paystack code left.

**`order_items`**
```
id                  uuid pk
order_id            uuid fk → orders.id
product_id          uuid fk → products.id, nullable
product_name        text     snapshot at order time
product_slug        text
product_image_url   text nullable
unit_price          numeric  snapshot at order time
quantity            int
line_total          numeric
created_at          timestamptz
```

`product_*` fields are snapshots so a later catalogue rename doesn't break
an old receipt.

**`discount_codes`**
```
id                uuid pk
code              text unique   uppercase
discount_type     text          ('percentage' | 'fixed')
discount_value    numeric       percent (0–100) or ZAR
min_order_amount  numeric       0 if unrestricted
max_uses          int nullable  null = unlimited
uses_count        int
expires_at        timestamptz nullable
active            boolean
email             text nullable when set, code is restricted to this email
email_canonical   text nullable canonicalised form of email — partial
                                unique index where email_canonical IS NOT
                                NULL AND active = true enforces one
                                welcome code per inbox (see lib/email.ts
                                for the canonicalisation rules)
created_at        timestamptz
```

Welcome codes from `/api/subscribe` carry both `email` (raw, used by
`resolveDiscount` when matching the customer at checkout) and
`email_canonical` (used by the duplicate-signup check). Two addresses that
resolve to the same Gmail inbox — `bob+x@gmail.com`, `b.o.b@gmail.com`,
`bob@googlemail.com` — collapse to the same `email_canonical`, so the
partial unique index makes alias-based abuse impossible. Admin-issued
codes (not bound to a customer) leave both fields NULL and are unaffected
by the constraint. Deactivating a code (`active = false`) drops it out of
the partial index, freeing the canonical email for a fresh signup.

### RPCs (must exist server-side)

**`redeem_discount_code(code_id uuid) returns boolean`**

Atomically: row-lock the code; if `active` and `expires_at` not past and
`uses_count < max_uses`, increment `uses_count` and return true. Otherwise
return false.

**`refund_discount_code(code_id uuid) returns void`**

Row-lock the code, decrement `uses_count` if it's > 0.

### Storage

Bucket name from `S3_BUCKET_NAME` (defaults to `Charmistry Assets`). The
PDP calls `getProductImages(name)` which lists files matching the product
slug and returns their public URLs.

---

## Payment flow (end to end)

A successful purchase produces these side effects in order:

1. **Order row created** with `status='pending'`.
2. **Order items inserted** with server-computed prices.
3. **Discount consumed** (if a code was applied) — RPC increments `uses_count`.
4. **PayFast payment request built** — signed form (`merchant_id`, `m_payment_id`, `amount`, `signature`, …) returned to the browser.
5. **Browser builds + submits the hidden POST form** to PayFast's hosted page. User pays.
6. **PayFast POSTs the ITN** to `/api/payfast/notify`.
7. **Order updated** to `status='paid'`, `paid_at=now()`, `payfast_pf_payment_id` set.
8. **Stock decremented** — `decrement_product_stock()` RPC atomically debits `products.quantity` per line (clamped at 0, flips `in_stock=false` at zero, flags any oversell).
9. **Customer confirmation email** sent (Resend).
10. **Merchant notification email** sent (Resend) — only if `MERCHANT_NOTIFICATION_EMAIL` is set.
11. **Klaviyo `Placed Order` event** fired (if `KLAVIYO_API_KEY` set).
12. **Courier Guy shipment created** (if Courier Guy env vars set), order updated with tracking info.
13. **Klaviyo `Shipped Order` event** fired (if both Courier Guy and Klaviyo configured).

If step 4 (PayFast build) errors, step 3's consume is refunded and the
order is marked `failed`. If step 6 doesn't fire, the order stays in
`pending` forever — that's intentional, so a customer who paid but for
whom the ITN didn't land can be reconciled manually.

Zero-total orders (100% discount code, exactly matched by shipping) skip
steps 4 and 5 — the API marks the order `paid` directly, decrements stock,
and returns a `redirectUrl` that takes the browser straight to the success
page. (The R0 path does not send the confirmation emails — see "Order
confirmation emails".)

The ITN handler is race-safe against duplicate deliveries: the
pending → paid transition uses `.eq("status","pending").select("id")`,
and the handler bails before steps 8–13 if zero rows were updated. Only
one concurrent ITN invocation runs the side effects, so a customer can't
receive duplicate emails, a double stock debit, or two Courier Guy shipments.

Defence in depth on the ITN: signature verification + server-to-server
replay to `/eng/query/validate` + amount-gross check. A forged ITN
needs to pass all three.

---

## Common operations

### Add a new product

Insert the row into Supabase Studio (the import script can update existing
rows but does not create new ones). Required fields: `name`, `slug`,
`price`, `in_stock`, `quantity`. Optional but recommended: `category_id`,
`metal`, `image_url`, `description`.

Variants are separate rows with the same `name` + `category_id` but
different `metal`.

### Bulk update prices / stock / images

Edit a CSV with the inventory headers (`Product;Catagory;Gold/Silver;
Sellng Price;Qty;Product Photo`) and run:

```bash
node scripts/import-catalogue.mjs path/to/file.csv
```

The script matches on `name + metal` (case-insensitive) and updates the
matching row(s).

### Generate a manual discount code

Insert a row into `discount_codes`:

```sql
insert into discount_codes
  (code, discount_type, discount_value, min_order_amount, max_uses,
   email, expires_at, active)
values
  ('FRIEND10', 'percentage', 10, 0, null, null, null, true);
```

`max_uses = null` means unlimited. `email = null` means anyone can use it.
`expires_at = null` means it never expires.

### Test the PayFast ITN locally

```bash
# Terminal 1
npm run dev

# Terminal 2 (tunnel)
ngrok http 3000

# Update .env.local — NEXT_PUBLIC_SITE_URL must be the public tunnel URL.
# /api/checkout bakes that URL into the form's `notify_url` field, so
# without it PayFast can't reach your local notify endpoint.
NEXT_PUBLIC_SITE_URL=https://<your-tunnel>.ngrok.io

# Then restart the dev server and place a test order. With
# PAYFAST_SANDBOX=true, use a sandbox test card (4242 4242 4242 4242
# typically works) on the PayFast sandbox checkout page.
```

ITN payloads are signed with MD5 of the ordered URL-encoded form fields
(plus your `PAYFAST_PASSPHRASE` if set). The notify handler also POSTs
the raw body back to `/eng/query/validate` for a server-to-server
confirmation, so even a forged signature won't pass unless PayFast
themselves recognise the ITN.

Unlike Paystack, PayFast doesn't need a pre-registered webhook URL in
their dashboard — the `notify_url` is sent per transaction in the form
data. That means rotating between local/staging/production is just a
matter of changing `NEXT_PUBLIC_SITE_URL`.

### Disable an integration

Blank out the env var:

- `KLAVIYO_API_KEY=` → no marketing events
- `COURIER_GUY_API_KEY=` → no automated dispatch (orders still marked paid)
- `NEXT_PUBLIC_GA_ID=` → no GA script
- `NEXT_PUBLIC_FB_PIXEL_ID=` → no Meta Pixel script

The code checks `isXConfigured()` before calling.

### Order confirmation emails (customer + merchant)

On payment confirmation, `/api/payfast/notify` → `sendConfirmationEmail()`
sends **two** emails via Resend:

- **Customer** → `order.email`, subject *"Order confirmed — Charmistry
  #XXXX"*: order summary, line items, totals and shipping address
  (`orderConfirmationHtml`).
- **Merchant** → `MERCHANT_NOTIFICATION_EMAIL`, subject *"New order #XXXX —
  {name} — R{total}"*: the item table (what was bought), customer contact,
  shipping address and notes — everything needed to pack and dispatch
  (`merchantOrderNotificationHtml`).

The code is already wired; what makes it actually **deliver** is configuration:

1. **`RESEND_FROM_EMAIL` must be on a Resend-verified domain.** The default
   `onboarding@resend.dev` is Resend's shared test sender and only delivers
   to your *own* Resend-account address — real customers get nothing (the
   403 is caught and logged, so it fails silently). Verify your sending
   domain in Resend (add the DNS records) and set e.g.
   `RESEND_FROM_EMAIL=orders@charmistry.co.za`.
2. **`NEXT_PUBLIC_SITE_URL` must be the public site URL** (not
   `http://localhost:3000`). Checkout bakes
   `notify_url=${NEXT_PUBLIC_SITE_URL}/api/payfast/notify` into the PayFast
   form; if PayFast can't reach it the ITN never arrives, the order stays
   `pending`, and **no email is ever sent**. Locally, use a tunnel
   (cloudflared / ngrok) and point this at it.
3. **`MERCHANT_NOTIFICATION_EMAIL`** is the fulfilment inbox the merchant
   copy goes to. If unset, the merchant email is skipped (the customer email
   still sends).

Both emails fire automatically once payment is confirmed — no code change is
needed. Caveat: the zero-total (100%-off) checkout path marks the order paid
but does **not** call `sendConfirmationEmail`, so a fully discounted order
currently notifies no one.

---

## Deployment

Default target is Cloudflare Workers via OpenNext. End-to-end, "from zip
to live" looks like this:

### Prerequisites (one-time, accounts you need)

1. **Supabase** — https://supabase.com — free tier is fine for launch.
2. **PayFast** — https://www.payfast.co.za — South-African business
   verification required to enable a live merchant account. The sandbox
   at sandbox.payfast.co.za works immediately with the public test creds
   `merchant_id=10000100` / `merchant_key=46f0cd694581a`.
3. **Resend** — https://resend.com — free tier covers ~3k emails/month.
4. **Cloudflare** — https://dash.cloudflare.com — free Workers plan covers
   ~100k requests/day.
5. (Optional) **Courier Guy** API access — request via their sales team;
   they hand back a base URL + API key.
6. (Optional) **Klaviyo** — https://klaviyo.com — free up to 250 contacts.
7. (Optional) **Google Analytics 4** — https://analytics.google.com — set
   up a property and grab the `G-XXXXXXXXXX` measurement ID.

### Step 1 — Local install

```bash
unzip Charmistry-main.zip
cd Charmistry-main
npm install
```

`@opennextjs/cloudflare` is in `devDependencies`, so `wrangler` lands in
`node_modules/.bin/` automatically — every `npx wrangler …` command below
uses that local copy.

### Step 2 — Supabase

1. Create a new project. Note the **Project URL** and the **anon** and
   **service_role** keys from Settings → API.
2. In SQL Editor, run each migration in `supabase/migrations/` in
   numerical order:
   ```
   000_baseline.sql                    -- categories, products, discount_codes
   001_orders.sql                      -- orders, order_items
   002_add_order_shipping_columns.sql  -- shipping_status, tracking_*
   003_add_material_size.sql           -- no-op if 000 ran first
   004_discount_rpcs.sql               -- redeem_discount_code, refund_discount_code
   005_email_canonical.sql             -- email_canonical column + partial unique index
   ```
   (You can also push them with `supabase db push` if you use the CLI.)
3. Seed the catalogue. Easiest path: open Studio → Table Editor, insert a
   few `categories` rows (one per slug: rings, necklaces, etc.), then
   insert `products` rows referencing them. For bulk loads use
   `scripts/import-catalogue.mjs` (see "Bulk update prices / stock /
   images" above).
4. **Storage bucket** (only if you want gallery images served from
   Supabase Storage rather than `image_url` text fields). Studio →
   Storage → New bucket → name `Charmistry Assets` → toggle Public on.
   Upload product images named with the product's slug as a prefix
   (e.g. `mila-bracelet-gold.jpg`).

### Step 3 — PayFast

1. For sandbox: use the public sandbox creds
   (`merchant_id=10000100` / `merchant_key=46f0cd694581a`, no passphrase).
   Set `PAYFAST_SANDBOX=true`. No dashboard setup needed.
2. For live: log into your PayFast merchant account → Settings →
   Integration. Copy **Merchant ID** + **Merchant Key**. If you have a
   passphrase set on that page, also copy it (and unset it on PayFast's
   side only if you want to operate without one — that's a deliberate
   security trade-off).
3. Unlike Paystack, PayFast does NOT need a webhook URL pre-registered
   in their dashboard. The `notify_url` is sent per transaction in the
   form body — `/api/checkout` builds it from `NEXT_PUBLIC_SITE_URL`.
   You'll fill that in at step 7.

### Step 4 — Resend

1. Domains → Add Domain → enter your sending domain (e.g.
   `mail.your-domain.com`) → add the DNS records Resend shows you. Wait
   for verification (usually <5 minutes).
2. Audiences → Create Audience → name it "Charmistry Club" or similar →
   copy the **Audience ID** (a UUID).
3. API Keys → Create → full access → copy the key (`re_…`).
4. The "from" address you use in `RESEND_FROM_EMAIL` MUST be on a verified
   domain. `orders@<verified-domain>` is the convention.

### Step 5 — Optional services

- **Courier Guy.** Set all `COURIER_GUY_*` env vars. If you don't, the
  webhook skips dispatch and the order stays `paid` with
  `shipping_status='pending'` — you fulfil manually.
- **Klaviyo.** The onsite funnel (`Active on Site`, `Viewed Product`, `Added
  to Cart`, `Started Checkout`) runs off `NEXT_PUBLIC_KLAVIYO_COMPANY_ID`. Set
  `KLAVIYO_API_KEY` to also fire the server-side `Placed Order` and `Ordered
  Product` events from the PayFast ITN. Skip the key to disable those.
- **GA.** Set `NEXT_PUBLIC_GA_ID` to inject the gtag script. Skip to
  disable.

### Step 6 — Cloudflare auth and project bootstrap

```bash
npx wrangler login
```

Opens a browser; click Allow. The first `npm run deploy` (later) will
create the Worker project if it doesn't exist — no manual creation
needed. The Worker name comes from `wrangler.toml` (`name = "charmistry"`)
— rename if you want a different one.

### Step 7 — Configure environment

Two kinds of env vars, configured in two different places:

**Public vars** (`NEXT_PUBLIC_*`) get baked into the build. Put them in a
`.env.local` file at the repo root so `npm run build:cf` can read them:

```bash
# .env.local — public, build-time only
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_SITE_URL=https://<your-worker>.workers.dev   # set after first deploy if you don't know the URL yet
NEXT_PUBLIC_GA_ID=                                       # blank if no GA
```

**Server-only secrets** live in Cloudflare. Push each one with
`wrangler secret put`:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put PAYFAST_MERCHANT_ID
npx wrangler secret put PAYFAST_MERCHANT_KEY
npx wrangler secret put PAYFAST_PASSPHRASE     # only if your account has one
npx wrangler secret put PAYFAST_SANDBOX        # "true" for sandbox; omit for live
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_AUDIENCE_ID
npx wrangler secret put RESEND_FROM_EMAIL
npx wrangler secret put MERCHANT_NOTIFICATION_EMAIL
npx wrangler secret put S3_BUCKET_NAME                  # only if using Supabase Storage gallery

# Optional integrations — only set these if you're using them:
npx wrangler secret put COURIER_GUY_API_BASE_URL
npx wrangler secret put COURIER_GUY_API_KEY
npx wrangler secret put COURIER_GUY_SENDER_NAME
npx wrangler secret put COURIER_GUY_SENDER_EMAIL
npx wrangler secret put COURIER_GUY_SENDER_PHONE
npx wrangler secret put COURIER_GUY_SENDER_ADDRESS_LINE1
npx wrangler secret put COURIER_GUY_SENDER_ADDRESS_LINE2
npx wrangler secret put COURIER_GUY_SENDER_CITY
npx wrangler secret put COURIER_GUY_SENDER_POSTAL_CODE
npx wrangler secret put COURIER_GUY_SENDER_COUNTRY
npx wrangler secret put KLAVIYO_API_KEY
```

Each command prompts for the value and stores it encrypted in your
Cloudflare account. They're available to the Worker at runtime under
`process.env.*`.

### Step 8 — Build and deploy

```bash
npm run build:cf      # OpenNext + Next build → .open-next/worker.js
npm run deploy        # wrangler deploy
```

First deploy takes ~2-3 minutes. wrangler prints the live URL
(`https://<name>.<your-subdomain>.workers.dev`). Copy it.

### Step 9 — Post-deploy wiring

1. **Fill in `NEXT_PUBLIC_SITE_URL`** in `.env.local` with the live URL
   from step 8, then re-run `npm run build:cf && npm run deploy`. (This
   var is bake-time, so it can't be a secret.) Without it the ITN
   `notify_url` PayFast calls back points at localhost — every payment
   succeeds on PayFast but the order stays `pending` forever.
2. **PayFast notify URL** is automatic — no dashboard step needed.
   `/api/checkout` builds `notify_url=${NEXT_PUBLIC_SITE_URL}/api/payfast/notify`
   per transaction.
3. **Custom domain** (optional). In the Cloudflare dashboard, attach a
   custom domain to the Worker (Workers & Pages → your-worker →
   Settings → Triggers → Custom Domains). After DNS propagates, update
   `NEXT_PUBLIC_SITE_URL` to the custom domain and redeploy.

### Step 10 — Smoke test

1. Browse the live site, add a product to bag, go to checkout, fill the
   form.
2. Apply a discount code you inserted in step 2 (optional).
3. Click Pay — your browser auto-submits the hidden form and lands on
   the PayFast hosted payment page (sandbox or live, depending on the
   `PAYFAST_SANDBOX` env).
4. Pay with the sandbox test details (any name; card `4242 4242 4242 4242`;
   any future expiry; CVV `1234`).
5. Land on `/checkout/success?order=<uuid>` — cart should clear.
6. Check Supabase `orders` table: the row should be `status='paid'`,
   `payfast_pf_payment_id` populated.
7. Check your customer inbox for the confirmation email and the merchant
   inbox for the new-order alert.
8. (If Courier Guy is configured) check the same row for
   `tracking_number`, `tracking_url`, `shipping_status='shipped'`.

### Step 11 — Go live with PayFast

When you're satisfied with sandbox:

1. `npx wrangler secret put PAYFAST_MERCHANT_ID` — paste your live
   merchant ID.
2. `npx wrangler secret put PAYFAST_MERCHANT_KEY` — paste your live
   merchant key.
3. (If you have one) `npx wrangler secret put PAYFAST_PASSPHRASE` —
   paste the live passphrase.
4. `npx wrangler secret put PAYFAST_SANDBOX` — empty string or omit
   (anything other than `"true"` means live).
5. Redeploy: `npm run deploy`.

No code change needed — `getPayFastConfig()` reads the env vars at call
time.

### Step 12 — Day-2 ops

- **Updating prices / stock.** Use Supabase Studio or run
  `scripts/import-catalogue.mjs` against a CSV.
- **Generating a one-off discount.** SQL `insert` into `discount_codes`
  (see "Generate a manual discount code" above).
- **Rotating a secret.** `npx wrangler secret put <NAME>` again with the
  new value — instant.
- **Rolling back a deploy.** Cloudflare dashboard → Workers & Pages →
  your worker → Deployments → "Rollback to this version".

### Alternative hosts

OpenNext is Cloudflare-specific. To target Vercel / Node / self-hosted:

```bash
npm run build
npm run start
```

You'll still need every env var from `.env.example` available at runtime,
just through your host's secret mechanism instead of `wrangler secret`.

---

## Troubleshooting

**"supabaseUrl is required" at build time**
The build runs static page collection. Even a build of the production
bundle reads env vars. Set `NEXT_PUBLIC_SUPABASE_URL` (and the other
required vars) in `.env.local`.

**Checkout returns `payment_misconfigured`**
`PAYFAST_MERCHANT_ID` or `PAYFAST_MERCHANT_KEY` is missing. Confirm both
are set in `.env.local` (or via `wrangler secret put` in production).

**ITN arrives but order stays `pending`**
The notify handler logs the reason. Most common causes:
1. Signature mismatch — your `PAYFAST_PASSPHRASE` env doesn't match what's
   set on the PayFast dashboard. Either set both consistently or unset
   both. Local sandbox uses no passphrase by default.
2. Server-to-server validation failed — `/eng/query/validate` returned
   anything other than `VALID`. Usually means the raw body was reformatted
   in transit (e.g. a proxy that re-encodes URL-encoded chars). The
   notify handler passes `request.text()` byte-for-byte; check for any
   middleware mutating the body.
3. Amount mismatch — `amount_gross` differs from `order.total`. The
   handler marks the order `failed`; check the `orders` row.
4. `m_payment_id` doesn't match a real order — the order was deleted
   between checkout and ITN arrival.

**ITN never arrives**
PayFast can't reach your `notify_url`. Check that `NEXT_PUBLIC_SITE_URL`
is publicly reachable from PayFast's servers, then look at the order
row's `notes` / `payfast_payment_id` to confirm checkout completed. Local
dev needs a tunnel (ngrok / cloudflared) — see "Test the PayFast ITN
locally".

**Cart shows old prices after a price change**
Carts are persisted for 30 days. Either ask the user to refresh (they'll
re-fetch on next add) or force-expire by bumping the persist `name` in
`src/stores/cart.ts`.

**`npm install` fails with ERESOLVE peer dependency conflict**
Shouldn't happen on this branch (Next 15.5.15+ satisfies the OpenNext
peer-dep range). If it does, you've bumped Next or OpenNext to versions
that don't agree — check `@opennextjs/cloudflare`'s required Next range
and pin accordingly. As an emergency unblock, `npm install --legacy-peer-deps`
works but masks the underlying mismatch.

**`wrangler deploy` fails with "Authentication error"**
You need to authenticate this machine first: `npx wrangler login`. The
browser flow connects wrangler to your Cloudflare account; the token is
stored in `~/.wrangler/config/`.

**`wrangler deploy` succeeds but the live site 500s on every request**
A secret is missing. Cloudflare dashboard → your worker → Logs (Real-time).
You'll see an error like `PayFast misconfigured: PAYFAST_MERCHANT_ID and
PAYFAST_MERCHANT_KEY are required` or `Supabase server client
misconfigured`. Re-run the matching `wrangler secret put <NAME>` for the
one that's missing.

**PayFast checkout page says "Invalid signature"**
The signature we computed doesn't match what PayFast expects. Two usual
suspects:
1. Passphrase drift — `PAYFAST_PASSPHRASE` on Cloudflare isn't identical
   to the one in your PayFast dashboard (or one side has it and the
   other doesn't). Either set both or unset both.
2. Sandbox/live mismatch — `PAYFAST_SANDBOX=true` while using live
   merchant creds, or vice versa. The sandbox merchant ID
   `10000100` won't work against the live process URL.

**Storage bucket images don't show on PDP**
`getProductImages()` lists the bucket as the anon role. If the bucket is
private, the anon role can't list it and the call returns `[]`. Either
make the bucket public or use Supabase signed URLs (would require a
queries change).

---

## Known issues

The most recent end-to-end audit is in `findings.md` at the repo root.
Specifically still open:

- **Next 15.3 has CVE-2025-66478.** Patched in later 15.x — upgrade is a
  one-line `package.json` change but wasn't done in this pass because it
  also affects `eslint-config-next` versioning.
- **No rate limiting on any API route.** Newsletter signup and discount
  validate are particularly worth limiting in production.
- **Country field is locked to ZA in the checkout UI** but the shipping
  estimator has an international branch. Pick one or the other.
- **Stock oversell race in `/api/checkout`.** The handler reads
  `products.quantity` and validates `qty <= available`, but doesn't take a
  row lock or atomically decrement. Two simultaneous checkouts for the
  last unit can both pass the check and both go through PayFast. The fix
  is either a `SELECT … FOR UPDATE` inside an RPC (atomic
  check-then-decrement) or an inventory-reservation table — neither was
  applied in this pass.

## Testing

### Static checks

```bash
npx tsc --noEmit
npm run lint
npm run build      # needs env vars: NEXT_PUBLIC_SUPABASE_URL,
                   # NEXT_PUBLIC_SUPABASE_ANON_KEY, PAYFAST_MERCHANT_ID,
                   # PAYFAST_MERCHANT_KEY, RESEND_API_KEY,
                   # RESEND_AUDIENCE_ID, RESEND_FROM_EMAIL,
                   # SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL.
                   # Placeholder values are enough for the build to pass —
                   # the routes that need real creds are `force-dynamic`.
```

### Pure-function unit tests (`scripts/test-logic.mjs`)

`canonicaliseEmail`, the shipping estimator, the discount-amount
calculator, the welcome-code shape + entropy. 33 assertions, no
dependencies beyond Node.

```bash
node --experimental-strip-types scripts/test-logic.mjs
```

### In-process runtime tests (`scripts/test-runtime.mjs`)

Real route-handler code (subscribe, checkout, discount/validate,
payfast notify, shipping/quote, bestsellers) exercised against an
in-memory mock of Supabase REST + PayFast + Resend. The mock enforces
the same constraints as the real schema — partial unique index on
`(email_canonical) WHERE active = true`, atomic `redeem_discount_code`
RPC semantics, etc. — so concurrency tests catch behaviour that pure
mocks would miss.

```bash
node --experimental-strip-types --import ./scripts/test-loader.mjs scripts/test-runtime.mjs
```

The custom loader (`scripts/test-loader.mjs` + `test-loader-impl.mjs`)
rewrites the `@/` path alias from `tsconfig.json` so the handlers import
under plain Node.

What's covered (34 tests):

- **Subscribe:** happy path, duplicate dedup, plus-addressing collapse,
  Gmail-dot collapse, `googlemail.com` ↔ `gmail.com` collapse,
  non-Gmail dot preservation, **100 concurrent signups for one canonical
  email** (exactly one 200, ninety-nine 409s via the DB partial unique
  constraint), invalid-email rejection.
- **Discount validate:** valid code, expired, email-bound mismatch,
  missing-email returns `email_required` (no code-enumeration oracle).
- **Checkout:** happy path with PayFast form built (signature, m_payment_id,
  amount checks), server-side reprice (client can't inject prices), out
  of stock, insufficient stock, the `in_stock=true && quantity=0` edge
  that used to slip through, empty cart, missing customer fields,
  discount math (subtotal − discount + shipping = total), 100%-off
  skipping PayFast for R0 totals, **concurrent redemption of a
  `max_uses=1` code** (exactly one of five parallel checkouts succeeds —
  the atomic RPC handles the race, losers get rolled back).
- **PayFast notify (ITN):** valid ITN flips pending → paid with both
  customer + merchant emails sent, invalid signature returns 400,
  server-to-server validate=INVALID returns 400 (defends against forged
  ITNs with correct signature), amount mismatch marks order failed,
  `payment_status=CANCELLED` marks order cancelled, **concurrent
  triple-delivery of the same ITN fires side effects exactly once** (the
  `.eq("status","pending").select("id")` row-count check makes the
  pending→paid transition race-safe), unknown order returns 200 to stop
  retries.
- **Shipping quote** + **bestsellers** routes.

The stock-oversell hazard is asserted-as-known: the test logs
"10 concurrent buys of quantity=1 → N succeeded" and currently shows N
all succeeding, documenting the open bug. When the atomic-decrement RPC
lands, that assertion flips to `assertEq(ok, 1)` and the hazard's
known-issues entry comes out.

### Bugs the harness has caught

- **`escapeHtml` crashed the merchant notification email** when a
  numeric value was passed in (the bug was first surfaced under a
  Paystack experiment where `data.id` was an int; PayFast emits
  `pf_payment_id` as a string, but the defensive fix is correct either
  way). The signature was `(value: string) => string` and
  `(999).replace` is undefined. The template threw synchronously during
  argument construction, which short-circuited the merchant `.send()`
  while the customer `.send()` had already fired — the rejected
  `sendConfirmationEmail` promise was then swallowed by
  `Promise.allSettled` in the notify handler so the failure was
  invisible in logs. Fix: coerce with `String(value ?? "")` and widen
  the signature.

### Deferred: full live-service integration

The in-process harness covers everything that doesn't require a real
network: a true E2E test (real Supabase + PayFast sandbox + Resend
sandbox + browser-driven navigation) would still add value for catching
contract drift with the upstream services. Bring-up recipe when that
work is picked up: `npx supabase start`, `npx supabase db reset` to
apply migrations, seed a minimal catalogue, set `.env.local` to the
CLI-printed URLs/keys, `npm run dev`, tunnel a public URL for the ITN,
and drive the flows with Playwright (navigation) plus a small Node
script using `Promise.all` (load).

When in doubt about the why behind a decision, read the module docblock at
the top of the relevant file.
