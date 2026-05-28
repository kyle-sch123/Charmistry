# Charmistry — Code Review Findings

This is a read-only review of the entire codebase at `C:\dev\repos\test\Charmistry-main`. Findings are grouped by severity. Each item cites the file/line where the issue lives.

Findings are based on actually reading the function bodies, not on names/headers. Where I make a claim about a SQL function (Supabase RPC) or external service contract, I flag it as "needs verification" since those live outside the repo.

---

## Critical — Will break in production or already broken

### C1. `PAYSTACK_SECRET_KEY` is required but undocumented in `.env.example`
- **Where:** `.env.example` (missing) vs `src/lib/paystack.ts:11`
- The checkout API uses Paystack (`initializeTransaction`) and the webhook signs/verifies with `PAYSTACK_SECRET_KEY`. If the key is missing, `getPaystackConfig` throws.
- `.env.example` documents only PayFast variables. An operator following the example will configure PayFast (which the live code does **not** use) and the first checkout attempt will 500 with `payment_misconfigured`.
- Also missing from `.env.example`: `KLAVIYO_API_KEY`, `COURIER_GUY_*` (8 variables), `S3_BUCKET_NAME`, `NEXT_PUBLIC_GA_ID`.

### C2. PayFast vs Paystack — the integration is half-wired
- **Where:** `src/app/api/checkout/route.ts:283`, `src/lib/payfast.ts:127`, `src/app/api/payfast/notify/route.ts`, `src/types/index.ts:124-125`
- Checkout calls **Paystack** (`initializeTransaction`). The Paystack webhook at `src/app/api/paystack/webhook/route.ts` handles payment confirmation.
- `src/lib/payfast.ts:127` `buildCheckoutPayload` is defined and exported but **never called anywhere** (verified with grep). The whole PayFast checkout-initiation path is dead code.
- `src/app/api/payfast/notify/route.ts` still exists and listens for ITN callbacks that will never come — it's harmless but misleading and a maintenance trap.
- Order schema columns are named after PayFast (`payfast_payment_id`, `payfast_pf_payment_id`) but store Paystack `reference` / `transactionId`. Mismatched terminology will confuse anyone debugging payments later.

### C3. Out-of-stock check is bypassed when `quantity` column is 0
- **Where:** `src/app/api/checkout/route.ts:138-150`
- The check is:
  ```ts
  if (!product.in_stock) return out_of_stock;
  const available = Number(product.quantity ?? 0);
  if (available > 0 && qty > available) return insufficient_stock;
  ```
- If a product row has `in_stock = true` but `quantity = 0` (or `null`), `available > 0` is false, so the `qty > available` check is **skipped entirely**. The order proceeds with no stock validation.
- Mirror the row data fix or change to `if (available <= 0 || qty > available)`.

### C4. Missing `/placeholder.webp` asset
- **Where:** referenced in `src/components/sections/BestSellers.tsx:138` and `src/components/ui/ProductCard.tsx:103`
- Both components do `src={item.image_url || "/placeholder.webp"}`. `public/` only contains the default Next.js SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`).
- Any product with a null `image_url` will render a broken `<Image>` and Next will log "Failed to parse src" because the file 404s.

### C5. Brand name misspelled in the browser title
- **Where:** `src/app/layout.tsx:29`
- `title: "Chamristry | Water & Tarnish Resistant Jewellery"` — **"Chamristry"** instead of **"Charmistry"**.
- This is the global title shown in every browser tab and in Google SERP results.

### C6. Contact email misspelled in 3 of 4 pages
- **Where:** `src/app/faq/page.tsx:153`, `src/app/shipping/page.tsx:155,158,261,265`, `src/app/privacy/page.tsx:39,42`
- All use `mailto:chamristryza@gmail.com` (note "**chamr**istry"). Compare to `src/components/layout/Footer.tsx:30` which uses `mailto:charmistryza@gmail.com` (correct spelling).
- Customers clicking from Footer email one address; clicking from FAQ/Shipping/Privacy email a different (possibly non-existent) address.

### C7. PayFast ITN handler overwrites Paystack reference with order id
- **Where:** `src/app/api/payfast/notify/route.ts:89`
- `payfast_payment_id: params.m_payment_id ?? null` — `m_payment_id` is the **order id**, not a payment id. The checkout flow previously stored the Paystack `reference` in this same column. If a PayFast ITN ever arrived (it shouldn't, since PayFast is dead — see C2), it would destroy the Paystack reference. Defense in depth missing.

### C8. Fully discounted orders cannot be placed
- **Where:** `src/app/api/checkout/route.ts:214-220`
- After subtotal + shipping − discount, if `total <= 0` we 400 with `invalid_total`. A 100% off code or fixed discount equal to subtotal+shipping is therefore unfillable.
- More important: Paystack rejects R0 transactions, so even a tiny epsilon-positive total can fail. Either skip Paystack and mark the order paid directly when total is 0, or document that 100% codes are unsupported.

### C9. Discount code on email-restricted codes is bypassable at validate time
- **Where:** `src/lib/discounts.ts:50` + `src/app/api/discount/validate/route.ts`
- `resolveDiscount`:
  ```ts
  if (data.email && customerEmail && data.email.toLowerCase() !== customerEmail.toLowerCase()) return "email_mismatch";
  ```
- If `customerEmail` is empty/absent, the check is skipped — the code resolves as valid.
- `/api/discount/validate` makes `email` optional in the body. So a client can probe codes (incl. someone else's welcome code) and learn that they "validate" without supplying the bound email. The checkout endpoint does require email so the actual redeem will fail, but the validate endpoint becomes an oracle for which codes exist and what they're worth.

### C10. Free shipping threshold inconsistent across the site
- **Where:** `src/lib/shipping.ts:19` (R600) vs `src/app/shipping/page.tsx:277` (R800) vs `src/components/sections/ShippingPayments.tsx:31` (R600) vs `src/components/product/ProductDetail.tsx:375-376` (R600)
- T&Cs say R800. Code uses R600. Customers will be told one thing and charged differently.

---

## High — Security / payment integrity

### H1. Paystack webhook signature comparison is not constant-time
- **Where:** `src/lib/paystack.ts:81`
- `return signature === hash;` — string equality, not `crypto.timingSafeEqual`. Theoretically allows a side-channel timing attack to forge a webhook. Low practical risk because the attacker would also need the body to match, but a textbook fix.

### H2. Welcome discount code generation uses `Math.random()`
- **Where:** `src/app/api/subscribe/route.ts:9-16`
- 6 random alphanumeric characters (~2.1B keyspace) generated with `Math.random()` (not cryptographically secure).
- If the codes table has a unique constraint on `code`, occasional collisions will fail subscribers with a generic `service_error` and the user has no way to retry.
- If there's no unique constraint, two subscribers could end up with the same code and the second one to redeem fails surprisingly.
- Fix: use `crypto.randomBytes` and rely on a DB unique constraint with retry.

### H3. Subscribe endpoint orphans a discount code if Resend "already exists" hits
- **Where:** `src/app/api/subscribe/route.ts:44-83`
- Order of operations: insert discount code into DB → call `resend.contacts.create`. If the Resend call returns an "already exists"-flavoured error (line 77-80 string-matches `"already" || "exist"`), we 409 the request but the discount row stays in the DB associated with a contact who already subscribed.
- Repeated probing creates one fresh `CHARM-XXXXXX` per request, all bound to the same email — they'll all show as redeemable when validated (and at most one will be usable per order, but the others linger).

### H4. No rate limiting anywhere
- **Where:** all API routes
- `/api/subscribe`, `/api/discount/validate`, `/api/shipping/quote`, `/api/checkout`, `/api/bestsellers` have no rate limiting. `/api/subscribe` is particularly dangerous because every hit creates a DB row, a Resend contact, sends an email, and persists a discount code.
- Discount code enumeration via `/api/discount/validate` is unmetered.

### H5. PayFast ITN signature verification reads keys from `Object.keys(params)`
- **Where:** `src/lib/payfast.ts:160-179`
- The verifier rebuilds the signature using `Object.keys(params)` after `parseFormBody`. JS objects preserve string-key insertion order in modern engines, so this *usually* matches the order the form fields were posted. However, if any intermediary tool or proxy re-serializes the body, ordering could be lost and signatures would silently mis-verify.
- Mitigated by also calling `validateItnWithPayFast` server-to-server, so this is defense-in-depth rather than a hole. But worth a comment explaining the assumption.

### H6. PayFast signature verifier returns 200 on signature failure
- **Where:** `src/app/api/payfast/notify/route.ts:20-22`
- `return new Response("Invalid signature", { status: 200 })` — 200 tells PayFast "I got it, don't retry". That's the right move once we've made a final decision, but masking a signature failure with 200 makes it impossible for monitoring to see attacks. Return 4xx + log loudly.

### H7. Service-role Supabase key used in API routes — no row-level safety net
- **Where:** `src/lib/supabase-server.ts`, used by `/api/checkout`, `/api/payfast/notify`, `/api/paystack/webhook`, `/api/discount/validate`, `/api/subscribe`, `/api/bestsellers`
- The service role bypasses RLS. That's expected for webhooks and checkout, but `/api/bestsellers` and `/api/discount/validate` could run on the anon client with read-only RLS — currently they have full DB access if the route logic is ever tricked.

### H8. Type-unsafe webhook payload parsing
- **Where:** `src/app/api/paystack/webhook/route.ts:27` (`let event: any;`)
- `event` is `any`. We dereference `event.event`, `event.data.status`, `event.data.metadata?.orderId`, `event.data.amount`, `event.data.reference`, `event.data.id`. A malformed payload won't crash (`event.data` access is fine even if undefined for `.metadata?.orderId`), but `Number(data.amount)` would yield NaN if `amount` is missing — the amount-mismatch branch catches it but the failure mode is opaque.

---

## High — Order/checkout logic bugs

### O1. Cart `addItem` silently rejects products with no `quantity`
- **Where:** `src/stores/cart.ts:39-42`
  ```ts
  const max = product.quantity ?? 0;
  if (!product.in_stock || max <= 0) return state;
  ```
- Combined with C3 (server allows the order through when `quantity = 0`), the **client** silently does nothing on "Add to Bag" for those same products. The button "succeeds" but the cart is unchanged. Same in `ProductCard.tsx:55-59` (`handleAdd`) — clicking shows no error because `addItem` simply no-ops.

### O2. Shipping `country` defaults to "ZA" but user can change form field in `Field`? — actually readOnly, but…
- **Where:** `src/app/checkout/CheckoutClient.tsx:332-338`
- The country `<Field>` is `readOnly` but still posts. The server-side shipping cost only differentiates "ZA vs not-ZA". With country locked to ZA, the international branch in `src/lib/shipping.ts:40` is unreachable from the UI. Either remove the international logic or unlock the country field. As-is, the unused branch is a maintenance hazard.

### O3. Shipping quote refetches on every keystroke (no debounce)
- **Where:** `src/app/checkout/CheckoutClient.tsx:78-135`
- The `useEffect` deps include `form.city`, `form.postalCode`, `form.addressLine1`, etc. Every keystroke fires a `/api/shipping/quote` POST. The previous request is aborted (good) but the server still runs every parse/compute. No debounce means dozens of unnecessary calls per form fill.
- Also, `form.addressLine1` is in the dep array (line 132) but is **not used** in the request body (only city/postal/country are). Useless dep that just adds extra fetches.

### O4. After payment URL is set, submit button stays disabled forever on redirect failure
- **Where:** `src/app/checkout/CheckoutClient.tsx:200-244`
- On success path, `setPaymentUrl(data.authorizationUrl)` but `setSubmitting(false)` is never called. The button text changes to "Redirecting to Paystack…" and `window.location.assign` runs in a separate effect. If the redirect is blocked (popup blocker, browser extension, CSP), the user is stuck — no retry, no error, button permanently disabled.

### O5. Cart store persists `maxQuantity` snapshot — stale stock after restock changes
- **Where:** `src/stores/cart.ts:62, 78-86`
- `maxQuantity` is stored alongside each line in localStorage. If admin reduces stock from 10 → 2, the cart still allows + button up to 10. The checkout API will catch it (C3 aside), but UX is misleading.
- Also: cart has no expiration. A user can add an item and come back six months later to a stale cart with prices that may have changed.

### O6. Email confirmation emails omit the discount line
- **Where:** `src/lib/email-templates.ts:70-85, 219-233`
- `orderConfirmationHtml` and `merchantOrderNotificationHtml` show Subtotal + Shipping + Total. The discount is silently absorbed into the math (subtotal stays full, total is less). Customers see "Subtotal R500, Shipping Free, Total R450" and have no way to see "you saved R50". The DB has `discount_code` and `discount_amount` — both unused in templates.

### O7. Subscribe success destroys email input before request completes
- **Where:** `src/components/sections/EmailClub.tsx:14-18` and `src/components/sections/NewsletterCTA.tsx:20-26`
- `setEmail("")` runs synchronously before `subscribe(email)` resolves. If the request errors, the user has to retype.

### O8. `success` page clears the cart unconditionally
- **Where:** `src/app/checkout/success/SuccessClient.tsx`
- Navigating to `/checkout/success` clears the cart regardless of whether the user actually paid. A user who lands here (mis-typed URL, bookmarked link, accidental back navigation after cancel) loses their cart. Minor abuse vector: hostile link `/checkout/success` shared with a customer empties their cart.

### O9. Courier shipment uses hard-coded 0.5kg per *line*, not per *unit*
- **Where:** `src/lib/courier-guy.ts:65-70`
  ```ts
  parcels: items.map((item) => ({
    description: item.product_name,
    quantity: item.quantity,
    weight_kg: 0.5,
    value: Number(item.line_total),
  }))
  ```
- The weight is 0.5kg per line regardless of `item.quantity`. A 10× necklace order ships as 0.5kg total. Pricing/insurance/airwaybill with the courier will be wrong.
- Compare with `src/lib/shipping.ts:32-35` which correctly multiplies by quantity.

### O10. No idempotency on Paystack webhook past the status check
- **Where:** `src/app/api/paystack/webhook/route.ts:84-86, 154`
- Idempotency relies on `order.status === "paid"` shortcut. But the courier shipment block runs *after* the status update — if the webhook fires twice (Paystack retries) and the second arrival processes between the first's update and ship creation, both attempts could try to create a shipment. The `.update({ shipping_status: shipment.status })` would also overwrite a successful first run with a failed second run.
- A unique constraint or "shipping_status not null" gate would help.

### O11. Discount consumption + order insert is not transactional
- **Where:** `src/app/api/checkout/route.ts:202-251`
- We `consumeDiscount` (RPC, increments uses_count). If the subsequent `orders` insert fails, we attempt `refundDiscount` (line 249). If the refund RPC fails (network, RPC missing, transient), the discount is permanently consumed for an order that doesn't exist.
- Same risk on `order_items` insert failure path (line 270).
- Either move the consume to *after* the order is inserted, or wrap both in a Supabase function/transaction.

### O12. Checkout postal code not format-validated
- **Where:** `src/app/checkout/CheckoutClient.tsx:147-159`, server validation in `src/app/api/checkout/route.ts:74`
- Required-only. SA postal codes are 4 digits. A typo like `12345` will be accepted, fail at Courier Guy's API (rejected shipment), and the order will sit in "paid + shipping_status=failed" with no automatic recovery.

---

## Medium — Data integrity / correctness

### M1. Email-templates `merchantOrderNotificationHtml` prints `payfast_pf_payment_id` even though we use Paystack
- **Where:** `src/lib/email-templates.ts:242`
- "Payment reference: `payfast_pf_payment_id`" — the column actually stores the Paystack transaction id, but the label still says "PayFast". Operators reading the merchant email will be confused.

### M2. `getProductImages` slug match is substring, not exact
- **Where:** `src/lib/queries.ts:288-297`
- ```ts
  const slug = productName.toLowerCase().replace(/\s+/g, "-");
  const matched = data.filter((file) => file.name.toLowerCase().includes(slug));
  ```
- "Ring" matches both `ring-gold.jpg` and `ring-set-silver.jpg`. Variant images bleed between products with overlapping names.

### M3. `getProductImages` uses anon client to list storage
- **Where:** `src/lib/queries.ts:282`
- Uses `supabase` (anon). If the storage bucket isn't public-list-able, this silently returns `[]`. No log, no error surfaced. Galleries appear empty with no explanation.
- Also: `bucketName = process.env.S3_BUCKET_NAME ?? "Charmistry Assets"` — bucket names with spaces are uncommon for S3-style storage. If env var isn't set the default has a space.

### M4. `getShopProducts` dedupes by name+category — hides legitimate variants
- **Where:** `src/lib/queries.ts:104-114`
- The dedup uses `${name.trim().toLowerCase()}|${category_id}` as key. Two real products that share name and category (e.g. silver/gold variants of the same piece — same name, different `metal`) collapse to one in the shop grid. The product detail page handles variants explicitly, but they don't both surface on `/shop`.

### M5. `shop` page sort can be overridden via URL but `metals` whitelist tolerates noise
- **Where:** `src/app/shop/page.tsx:49-57`
- `parseMetals` silently discards unknown values but accepts a 1MB query string. Trivial DoS via gigantic URLs, but Cloudflare/Vercel will reject before we see it.

### M6. `Testimonials` hardcoded — and one entry has trailing space + wrong `productName`
- **Where:** `src/data/testimonials.ts:36-39`
- `productName: "tarnish-free "` — that's a description fragment, not a product, and has a trailing space.
- Entry `003` capitalisation `"Mila Bracelet"` differs from entry `002`'s `"Mila bracelet"`. Will cause case-sensitive sorting/filtering to mis-group later.

### M7. Brand-vs-content mismatch
- **Where:** `src/components/sections/HeroSection.tsx:68` (`Est. 2025`) vs `src/components/sections/BrandStory.tsx:8-12`
- BrandStory's stats: "15+ Years of Craft", "2,400+ Pieces Created", "98% Client Satisfaction". The brand was established 2025. The 15-year stat is incompatible. (Mitigation: `BrandStory` is dead code — see U1 — so it doesn't ship today, but it'll mislead anyone who reactivates it.)

### M8. Pre-built `track` for testimonials is a module-level constant
- **Where:** `src/components/sections/Testimonials.tsx:7`
- `const track = [...testimonials, ...testimonials];` is evaluated once at module load. Fine for static data, but means hot-edits to testimonials in dev don't re-evaluate without HMR refresh. Trivial.

### M9. PayFast notify route: nothing fires order confirmation if PayFast were used
- **Where:** `src/app/api/payfast/notify/route.ts:100-105`
- After marking paid, only `sendConfirmationEmail` is called. No Courier Guy shipment, no Klaviyo events. If anyone re-wires PayFast as the checkout, the side-effects diverge from the Paystack webhook.

### M10. Discount validate trims but doesn't normalize to upper
- **Where:** `src/app/api/discount/validate/route.ts:21` vs `src/lib/discounts.ts:18, 32`
- The validate route does `body.code.trim()` and forwards. `resolveDiscount` then calls `normalizeCode` (upper-case). Inconsistent with the `subscribe` API which stores codes as upper-case. As long as `resolveDiscount` is the only entry point this is fine — flagged for future regression.

### M11. CheckoutClient does not refresh discount when email changes
- **Where:** `src/app/checkout/CheckoutClient.tsx:161-186`
- User can apply an email-bound code with an empty email field (validates due to C9), then enter the email and submit. Checkout will reject the code at `consumeDiscount` time and show an error — *after* the user thought everything was OK. UX: revalidate when email field changes.

### M12. `import-catalogue.mjs` falls back to anon key
- **Where:** `scripts/import-catalogue.mjs:19`
- `const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;`
- Anon key cannot insert/update if RLS is enabled. Script will appear to work then silently fail with cryptic Supabase errors.

### M13. `import-catalogue.mjs` uses misspelled CSV headers as keys
- **Where:** `scripts/import-catalogue.mjs:120, 181-184`
- Matches against `"catagory"`, `"sellng price"`, `"gold/silver"`. These are CSV-typo-dependent. The repo's CSV (`charmistry_product_descriptions_updated (1).csv`) uses a *different* schema (`Product Name;Description;Material;Length/Size;Image Filename`), so the inventory branch will never match the included CSV — the script is wired for a *different* CSV file that lives outside the repo.

### M14. Import script overrides `in_stock` only when `quantity` is a number
- **Where:** `scripts/import-catalogue.mjs:196, 242-245`
- Computes `inStock` at line 196 but only assigns it inside `if (typeof quantity === "number")`. The variable on line 196 is dead code; the actual update logic shadows it.

### M15. Import script: ilike name match isn't escaped
- **Where:** `scripts/import-catalogue.mjs:229`
- `query.ilike("name", productName)` — if a product name contains `%` or `_`, the wildcard is honoured. Admin tooling so risk is low, but a single rogue product name could update many products.

### M16. Embedded CSV uses replacement character `�` (UTF-8 decoding errors)
- **Where:** `charmistry_product_descriptions_updated (1).csv` lines 2-12
- Smart quotes were saved with a bad encoding. Lines like "you�ll" and "It�s" will import literally. The DB description column will contain U+FFFD. Customer-facing copy will look broken.

---

## Medium — UI / UX bugs

### U1. Five components are exported but never imported anywhere
- **Where:** `src/components/sections/NewsletterCTA.tsx`, `BrandStory.tsx`, `CategoryShowcase.tsx`, `EditorialBanner.tsx`, `FeaturedProducts.tsx`, plus `src/components/ui/BorderBeam.tsx`, `Marquee.tsx`, `ShimmerText.tsx`, `TestimonialCard.tsx`, `GoldSparkles.tsx`, `GrainOverlay.tsx`, `MagneticButton.tsx`, `Button.tsx`, `SectionHeading.tsx`, `CategoryCard.tsx` (the in-section CategoryCard is also unused; `CategoriesGrid` defines its own inline)
- Verified: `FeaturedProducts` is the only one referenced and only by itself. None are imported into pages. Dead code is shipped in the bundle, increasing build size.

### U2. `FeaturedProducts` silently hides itself when fewer than 8 products exist
- **Where:** `src/components/sections/FeaturedProducts.tsx:19`
- `if (products.length < 8) return null;` — store with 7 products → blank section. (Doesn't ship today because it's dead code — see U1.)

### U3. `BestSellers` shows skeleton then nothing if API fails
- **Where:** `src/components/sections/BestSellers.tsx:28-39`
- On `fetch` error we `console.error` and set `loading=false` with `products=[]`. Combined with `if (!loading && products.length === 0) return null;` — the section silently vanishes with no error message.

### U4. ProductDetail `+` button bypasses `maxQty` when `maxQty` is falsy
- **Where:** `src/components/product/ProductDetail.tsx:337-339`
- ```ts
  setQuantity((q) => Math.min(maxQty || q + 1, q + 1));
  ```
- When `maxQty === 0` (which falsy-coerces), this becomes `Math.min(q+1, q+1) = q+1` — unbounded. The button is disabled in that state, but the math is misleading and someone refactoring will be bitten.

### U5. ProductDetail magic-value size mapping
- **Where:** `src/components/product/ProductDetail.tsx:23-25`
- `"0" → "Adjustable"`, `"-1" → "9x10cm"` (jewellery boxes). Hidden contract between DB and UI. If a product gets `-2` it renders literally.

### U6. ProductDetail does not update URL when variant changes
- **Where:** `src/components/product/ProductDetail.tsx:100-104`
- Switching from `silver` to `gold` doesn't update the URL. The user sees the gold variant at `/products/silver-thing`, can't bookmark or share the specific variant they're viewing. SEO impact: every metal-variant page targets the canonical slug only.

### U7. ProductCard wraps a `<button>` inside an `<a>` (Link)
- **Where:** `src/components/ui/ProductCard.tsx:82-176`
- `<Link>...<button onClick={handleAdd}>` — invalid HTML (nested interactive content). Screen readers and HTML validators will complain. Add-to-Bag click works because of `preventDefault/stopPropagation`, but accessibility is degraded.

### U8. ProductCard tilts on mouse-move while card is also a link — touch users miss
- **Where:** `src/components/ui/ProductCard.tsx:43-48`
- Cosmetic 3D tilt requires `onMouseMove`. Mobile users see no animation but also no degraded experience. Fine, just flagged.

### U9. Inline `<style>` blocks in `CategoriesGrid` and `Testimonials`
- **Where:** `src/components/sections/CategoriesGrid.tsx:66-96` and `src/components/sections/Testimonials.tsx:80-91`
- Works, but global CSS in JSX bypasses Tailwind. `.cat-grid` and `.marquee-track` selectors are global — collisions possible if another component reuses the class name.

### U10. `shipping/page.tsx` renders fragments inside `.map` without keys
- **Where:** `src/app/shipping/page.tsx:240-316`
- ```jsx
  {sections.map((section, i) => (
    <>
      {i === divider && <motion.div key="privacy-divider" .../>}
      <motion.div key={section.num} .../>
    </>
  ))}
  ```
- The outer `<>` fragment has no key. React will warn (and re-mount children unnecessarily). Switch to `<React.Fragment key={section.num}>`.

### U11. `EmailClub` form input has no client-side email format validation
- **Where:** `src/components/sections/EmailClub.tsx:12-18`
- `<input type="email" required>` triggers browser validation, but the JS handler only checks truthiness before calling `subscribe`. With `noValidate` patterns or autofill, malformed strings reach the API which then rejects them with `Invalid email address`. The HTML5 default is mostly fine, but the JS guard adds nothing.

### U12. SearchOverlay calls `searchProducts` directly from the client
- **Where:** `src/components/search/SearchOverlay.tsx:67`
- `searchProducts` uses the anon Supabase client (`src/lib/queries.ts`). Bundling that import into a client component means the Supabase client SDK ships in the browser bundle. Fine in practice (anon key is public by design), but it's a sizeable bundle.

### U13. Mobile menu hamburger has no aria-expanded state
- **Where:** `src/components/layout/Navbar.tsx:192-199`
- Button only has `aria-label="Open menu"`. Should toggle `aria-expanded` and the label to "Close menu" when open for AT users.

### U14. Mobile menu doesn't trap focus
- **Where:** `src/components/layout/MobileMenu.tsx`
- ESC doesn't close (no handler), focus isn't restored to the hamburger on close, and Tab cycles past the menu into the page behind. Modal accessibility incomplete (the cart drawer at `CartDrawer.tsx:46-51` does have ESC).

### U15. Footer SOCIAL array dead code with placeholder hrefs
- **Where:** `src/components/layout/Footer.tsx:35-72`
- `const SOCIAL = [{ href: "#" ... }, ...]` is declared but never rendered. Dead code.

### U16. Footer "Unsubscribe" link in welcome email points to homepage
- **Where:** `src/lib/email-templates.ts:341`
- `<a href="${siteUrl}">Unsubscribe</a>` — clicking lands on the home page, not an unsubscribe page. PoPIA/GDPR/CAN-SPAM expects a working unsubscribe.

### U17. Welcome email loads Google Fonts via `<link>`
- **Where:** `src/lib/email-templates.ts:274-275`
- Most email clients strip `<link>` and external CSS. The fonts won't load in Outlook/Gmail; the typography fallback works but visually inconsistent with the website.

### U18. `success` page exposes order id via URL
- **Where:** `src/app/checkout/success/page.tsx:18`
- `const shortId = order ? order.slice(0, 8).toUpperCase() : null;` — anyone with the URL sees the "order id" stub. Not sensitive on its own but be aware that the param isn't validated against ownership.

### U19. CategoryShowcase / CategoryCard link to anchors instead of routes
- **Where:** `src/components/sections/CategoryShowcase.tsx:118` and `src/components/ui/CategoryCard.tsx:15`
- `href={#${category.slug}}` — anchor that goes nowhere on the current page. Should be `/shop?category=${category.slug}`. (Both files are dead code — see U1 — so this isn't user-visible today.)

### U20. `GoldSparkles` calls `ctx.scale(devicePixelRatio, devicePixelRatio)` on every resize
- **Where:** `src/components/ui/GoldSparkles.tsx:58-64`
- Each resize multiplies the scale rather than resetting. On a window that's resized 5 times, the scale grows 5×. Use `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`. (Dead code per U1.)

---

## Low — Code quality / consistency

### L1. `Logo.tsx` is a `"use client"` component just to render a `<span>`
- No state, no effects. Forces a client boundary unnecessarily.

### L2. `src/data/products.ts` and `src/data/categories.ts` are placeholder stubs
- Both files contain only `export {};` with a comment. Could be deleted.

### L3. `payfast.ts` exports `PAYFAST_SOURCE_HOSTS` but no caller uses it
- Comment says "kept as a reference list". Dead.

### L4. `useEmailSubscribe` doesn't reset between attempts
- After a `duplicate` or `error`, calling `subscribe` again moves through `loading → success/duplicate/error`. The `discountCode` state is never reset, so a previous run's stale code can still be displayed when the next `success` arrives.

### L5. Identical confirmation-email logic duplicated in PayFast + Paystack handlers
- `src/app/api/payfast/notify/route.ts:144-185` and `src/app/api/paystack/webhook/route.ts:201-245` are near-identical. Extract to `src/lib/email-flow.ts` or similar.

### L6. `BestSellers` and `/api/bestsellers` duplicate `getBestsellers` logic
- `src/app/api/bestsellers/route.ts` and `src/lib/queries.ts:158` both do the same query with slightly different column selects. The API is called from `BestSellers.tsx`. The lib function is unused outside `queries.ts`. Drop one.

### L7. `Marquee.tsx` uses `[&:hover]:animation-play-state-paused` which isn't a Tailwind utility
- **Where:** `src/components/ui/Marquee.tsx:35`
- That selector doesn't compile to anything. The pause-on-hover prop is silently ignored. (Dead code — U1.)

### L8. `useEmailSubscribe` returns `discountCode` of `null` after a duplicate
- A subscriber who already exists won't see their code. The endpoint correctly 409s, but if the intent is "always show the user *their* code", duplicate handling needs the DB to return the previously-generated code.

### L9. README is the create-next-app boilerplate
- `README.md` has no project-specific info. Operators have nothing to read.

### L10. `.env.example` ships PayFast sandbox credentials in plain text
- These are PayFast's documented public sandbox values, so not strictly a secret. But it's confusing to leave them in a project that doesn't use PayFast.

### L11. Logger calls scattered across API routes
- `console.error/warn` in production logs to stdout. For a Cloudflare deployment, structured logging via `console.log(JSON.stringify(...))` is more useful.

### L12. Hardcoded merchant email fallback to a personal Gmail
- `src/app/api/payfast/notify/route.ts:157` and `src/app/api/paystack/webhook/route.ts:219`
- `process.env.MERCHANT_NOTIFICATION_EMAIL ?? "kyleschaffner39@gmail.com"` — personal email is the fallback if env isn't set. If `.env` isn't loaded in prod, customer orders email a personal account.

### L13. `eslint.config.mjs` removes the default `.next/` ignores then re-adds them
- The override pattern looks like a workaround for an ESLint config bug. Comment why.

### L14. `next.config.ts` allows `*.trycloudflare.com` as dev origin
- Fine in dev. Worth confirming this isn't bundled into prod config.

### L15. `Image` `unoptimized: true`
- `next.config.ts:7` — turns off the Next image optimizer for Cloudflare. Means hero/category/product images all serve unoptimized originals. Large LCP impact if originals aren't sized appropriately upstream.

### L16. `Logo` exports an HTML `<span>` but is consumed via `<Logo />`
- Combined with `import` from `@/components/icons/Logo`, the path is `icons` but the file renders text. Path is misleading.

### L17. `AboutSection` text says "waterproof" but Care/FAQ say "water-resistant"
- **Where:** `src/components/sections/AboutSection.tsx:79` ("Waterproof, tarnish-resistant") vs `src/app/care/page.tsx:25` ("water-resistant and tarnish-resistant") vs `BrandStory.tsx:129` ("waterproof").
- Marketing copy says one thing, T&Cs say another. Customers will hold the strongest claim against you.

### L18. `success` page heading still renders even when `order` param is missing
- Heading reads "Order placed" regardless of whether there's an order id. If someone visits `/checkout/success` directly, the message is misleading.

### L19. `Footer.tsx` has both "Connect" links section *and* a separate dead `SOCIAL` array
- The visible footer renders NAV_COLS (the working one). SOCIAL is leftover.

### L20. `shipping/page.tsx` renders `<motion.div>` for a heading "Privacy & Data" between sections — uses `whileInView` triggered once
- Inside a fragment, the divider's animation only fires the first time it scrolls into view. If you remove and re-add it via re-render, it stays invisible. Edge case.

---

## Verification needed (claims about external state)

These items assume something about the Supabase schema/RPCs that I can't verify from the repo alone:

1. **`redeem_discount_code` and `refund_discount_code` RPCs** must exist in Supabase. The discount flow depends on these returning `boolean` (consumed?) and being race-safe. Failures will be caught and logged, but if they're missing the order flow becomes "discount applied but never decremented".
2. **`orders.payfast_payment_id` / `payfast_pf_payment_id` columns** must allow nullable strings; if they're constrained to a UUID type the Paystack reference (`charr_xxxxxxxxxx`) won't fit.
3. **`discount_codes` unique constraint on `code`** — if missing, see H2 (collision returns generic error).
4. **`products.quantity` column nullability** — see C3. If it's NOT NULL with default 0, the bug fires whenever the merchant forgets to set it.
5. **Supabase Storage bucket name** (`Charmistry Assets`) must be public-list-able or `getProductImages` silently returns `[]` (M3).

---

## Quick wins (most leverage per minute spent)

1. Fix the `title` typo in `src/app/layout.tsx:29` — one-character fix, brand impact.
2. Fix the `chamristryza@gmail.com` typo across faq/shipping/privacy pages — replace with the working email used in Footer.
3. Add `placeholder.webp` to `public/` (or change the fallback to a known asset).
4. Patch the stock check at `src/app/api/checkout/route.ts:145`.
5. Add `PAYSTACK_SECRET_KEY` and the other missing env keys to `.env.example`.
6. Reconcile R600 vs R800 free-shipping copy.
7. Remove the dead PayFast notify route (or write a comment that it's intentionally retained).
8. Either delete the dead section components (`NewsletterCTA`, `BrandStory`, etc.) or wire them up.
9. Replace `Math.random()` in subscribe with `crypto.randomBytes`.
10. Make webhook signature comparison constant-time.
