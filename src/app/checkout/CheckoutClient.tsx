/**
 * Checkout form (client-rendered).
 *
 * The page itself (page.tsx) is a server component that just frames this
 * client component. Everything below — form state, shipping quote polling,
 * discount validation — happens in the browser.
 *
 * Flow:
 *   1. Form mounts, waits for the cart to hydrate from localStorage.
 *   2. The shopper picks a delivery method (Locker-to-Locker or Standard
 *      Economy). Prices come from the shared lib/shipping catalogue, so the line
 *      updates instantly with no round-trip; /api/checkout re-derives the same
 *      cost server-side from the chosen method id.
 *   3. Discount code application calls /api/discount/validate, which
 *      requires the email — the form re-validates the discount if the
 *      email field changes after a code was applied.
 *   4. On submit, POSTs to /api/checkout. Server returns one of:
 *        - `{ paymentUrl, formData }` for a normal PayFast checkout — we
 *          build a hidden POST form and submit it so the browser navigates
 *          to PayFast's hosted page.
 *        - `{ redirectUrl }` for R0 totals (100%-off code) — straight
 *          `window.location.assign()` to the success page.
 *   5. If the redirect is blocked (extension, popup blocker, CSP), a 4s
 *      timeout re-enables the submit button so the user isn't trapped.
 *
 * The cart is NOT cleared here — that happens on the success page only
 * when an `order` query param is present.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCart, selectCartSubtotal } from "@/stores/cart";
import { getAuthBrowserClient } from "@/lib/auth/client";
import { resolveBundleDiscount } from "@/lib/bundles";
import { formatPrice } from "@/lib/utils";
import {
  identifyKlaviyo,
  trackStartedCheckout,
  cartLinesToKlaviyoItems,
} from "@/lib/klaviyo-client";
import {
  SHIPPING_METHODS,
  DEFAULT_SHIPPING_METHOD_ID,
  shippingCostForMethod,
  shippingMethodLabel,
  type ShippingMethodId,
} from "@/lib/shipping";
import type { CheckoutFormData, Profile } from "@/types";

// Where locker shoppers send their preferred locker (mirrors the address used
// on the shipping / terms pages). Kept as a constant so the note and any future
// mailto stay in sync.
const SUPPORT_EMAIL = "charmistryza@gmail.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormErrors = Partial<Record<keyof CheckoutFormData, string>> & {
  form?: string;
};

/**
 * What the API hands back on a successful POST /api/checkout.
 *  - `formPost`: render a hidden form and submit it (PayFast standard flow).
 *  - `redirect`: navigate straight to the URL (zero-total → success page).
 */
type PendingPayment =
  | { kind: "formPost"; url: string; fields: Record<string, string> }
  | { kind: "redirect"; url: string };

const initialForm: CheckoutFormData = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
  country: "ZA",
  notes: "",
};

export default function CheckoutClient() {
  const router = useRouter();
  const hasHydrated = useCart((s) => s.hasHydrated);
  const lines = useCart((s) => s.lines);
  const subtotal = useCart(selectCartSubtotal);
  const cartUpdatedAt = useCart((s) => s.updatedAt);

  // Klaviyo "Started Checkout" fires once per distinct email so we don't spam
  // the metric on every keystroke / re-render.
  const startedCheckoutEmail = useRef<string | null>(null);

  const [form, setForm] = useState<CheckoutFormData>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  const [shippingMethod, setShippingMethod] = useState<ShippingMethodId>(
    DEFAULT_SHIPPING_METHOD_ID,
  );

  // Cart-aware bundle (e.g. the Everyday Edit) — detected from the line items,
  // applied automatically, and recomputed identically in /api/checkout so the
  // shown price and the charged price can't diverge. A bundle takes precedence
  // over a typed code and hides the code field, so the two can't be stacked.
  const bundle = useMemo(
    () =>
      resolveBundleDiscount(
        lines.map((l) => ({
          slug: l.slug,
          category: l.category,
          price: l.price,
          quantity: l.quantity,
        })),
      ),
    [lines],
  );
  const bundleAmount = bundle ? Math.min(bundle.amount, subtotal) : 0;
  const discountAmount = bundle ? bundleAmount : (appliedDiscount?.amount ?? 0);

  // Merchandise total after the discount — the amount the customer actually
  // pays and what the free-shipping threshold is judged on (see below).
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  // Shipping is derived from the shared catalogue on the DISCOUNTED total (what
  // the customer pays for goods) with no round-trip; /api/checkout recomputes
  // the identical value from the method id + discounted total so display and
  // charge can't diverge. `isFreeShipping` reads off that single computed cost
  // (rather than re-deriving the threshold) so the "Free" label can never
  // disagree with the price actually shown/charged — including a fully-covered
  // (100%-off) order, where shipping is free too.
  const shippingCost = useMemo(
    () => shippingCostForMethod(shippingMethod, discountedSubtotal),
    [shippingMethod, discountedSubtotal],
  );
  const isFreeShipping = shippingCost === 0;
  const total = useMemo(
    () => discountedSubtotal + shippingCost,
    [discountedSubtotal, shippingCost],
  );

  // Empty-cart redirect (only after hydration to avoid SSR flash)
  useEffect(() => {
    if (hasHydrated && lines.length === 0 && !pendingPayment) {
      router.replace("/shop");
    }
  }, [hasHydrated, lines.length, pendingPayment, router]);

  // Prefill for signed-in customers from their profile (saved details +
  // default address). Only ever fills fields that are still empty — nothing
  // the shopper has typed is overwritten — and any failure leaves the guest
  // flow exactly as it was. The order itself is linked to the account
  // server-side in /api/checkout, not from anything set here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getAuthBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle<Profile>();
        if (cancelled) return;

        setSignedInEmail(user.email ?? null);
        setForm((prev) => ({
          ...prev,
          email: prev.email || user.email || "",
          firstName: prev.firstName || profile?.first_name || "",
          lastName: prev.lastName || profile?.last_name || "",
          phone: prev.phone || profile?.phone || "",
          addressLine1: prev.addressLine1 || profile?.default_address_line1 || "",
          addressLine2: prev.addressLine2 || profile?.default_address_line2 || "",
          city: prev.city || profile?.default_city || "",
          postalCode: prev.postalCode || profile?.default_postal_code || "",
        }));
      } catch {
        // Signed out or auth unavailable — guest checkout carries on.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Identify the visitor and fire Klaviyo "Started Checkout" once they've
  // entered a valid email. This is Klaviyo's canonical trigger and is what
  // powers abandoned-checkout flows. Debounced so it lands after they finish
  // typing, and guarded by a ref so it fires once per distinct email.
  useEffect(() => {
    if (!hasHydrated || lines.length === 0) return;
    const email = form.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || startedCheckoutEmail.current === email) return;

    const handle = setTimeout(() => {
      startedCheckoutEmail.current = email;
      identifyKlaviyo({
        email,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
      });
      trackStartedCheckout(cartLinesToKlaviyoItems(lines), subtotal, {
        email,
        eventId: `${cartUpdatedAt}-${email}`,
      });
    }, 600);

    return () => clearTimeout(handle);
  }, [
    hasHydrated,
    lines,
    subtotal,
    cartUpdatedAt,
    form.email,
    form.firstName,
    form.lastName,
  ]);

  useEffect(() => {
    if (!pendingPayment) return;
    if (pendingPayment.kind === "redirect") {
      window.location.assign(pendingPayment.url);
    } else {
      // PayFast: build a hidden POST form and submit it so the browser
      // does a real navigation to PayFast's hosted payment page. Using
      // location.assign() with a query-string URL would technically work
      // for GET, but the canonical PayFast flow is POST.
      const formEl = document.createElement("form");
      formEl.method = "POST";
      formEl.action = pendingPayment.url;
      formEl.style.display = "none";
      for (const [key, value] of Object.entries(pendingPayment.fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        formEl.appendChild(input);
      }
      document.body.appendChild(formEl);
      formEl.submit();
    }
    // If the redirect/submit is blocked (popup blocker, CSP, browser
    // extension), re-enable the submit button after a short grace period
    // so the user isn't stuck on a permanently disabled "Redirecting…"
    // state.
    const fallback = setTimeout(() => {
      setSubmitting(false);
      setErrors({
        form:
          "Browser blocked the redirect. Click the button below to retry payment.",
      });
      setPendingPayment(null);
    }, 4000);
    return () => clearTimeout(fallback);
  }, [pendingPayment]);

  function update<K extends keyof CheckoutFormData>(
    key: K,
    value: CheckoutFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
    // If the email changes after a discount was applied, the previously-validated
    // bound code may now mismatch — drop it so the user re-applies with the
    // new email.
    if (key === "email" && appliedDiscount) {
      setAppliedDiscount(null);
      setDiscountInput("");
      setDiscountError(null);
    }
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!form.email.trim()) next.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Invalid email";
    if (!form.firstName.trim()) next.firstName = "Required";
    if (!form.lastName.trim()) next.lastName = "Required";
    if (!form.addressLine1.trim()) next.addressLine1 = "Required";
    if (!form.city.trim()) next.city = "Required";
    const postal = form.postalCode.trim();
    if (!postal) next.postalCode = "Required";
    else if (form.country === "ZA" && !/^\d{4}$/.test(postal))
      next.postalCode = "Must be 4 digits";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function applyDiscount() {
    const code = discountInput.trim();
    const emailValue = form.email.trim().toLowerCase();
    if (!code || discountLoading) return;
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setDiscountError("Enter your email above before applying a code.");
      return;
    }
    setDiscountLoading(true);
    setDiscountError(null);
    try {
      const res = await fetch("/api/discount/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal, email: emailValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        const reason: string = data?.error ?? "not_found";
        setDiscountError(discountErrorMessage(reason));
        setAppliedDiscount(null);
        return;
      }
      setAppliedDiscount({ code: data.code, amount: Number(data.amount) });
      setDiscountInput(data.code);
    } catch {
      setDiscountError("Network error. Try again.");
    } finally {
      setDiscountLoading(false);
    }
  }

  function removeDiscount() {
    setAppliedDiscount(null);
    setDiscountInput("");
    setDiscountError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    if (lines.length === 0) return;

    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          lines: lines.map((l) => ({ id: l.id, quantity: l.quantity })),
          // Bundle is derived server-side from the lines; only a typed code is
          // sent, and only when no bundle is active.
          discountCode: bundle ? undefined : appliedDiscount?.code,
          shippingMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          Array.isArray(data?.details) && data.details.length > 0
            ? data.details.join(". ")
            : data?.error === "out_of_stock"
              ? `${data.product ?? "An item"} is out of stock`
              : data?.error === "insufficient_stock"
                ? `Only ${data.available} of ${data.product} available`
                : data?.error === "product_unavailable"
                  ? "One or more items in your bag are no longer available"
                  : data?.error === "discount_invalid"
                    ? `Discount code is no longer valid (${discountErrorMessage(data?.reason ?? "not_found")}). Please remove it and try again.`
                    : "Something went wrong. Please try again.";
        if (data?.error === "discount_invalid") {
          setAppliedDiscount(null);
          setDiscountError(discountErrorMessage(data?.reason ?? "not_found"));
        }
        setErrors({ form: msg });
        setSubmitting(false);
        return;
      }

      // Zero-total orders skip PayFast — server returns `redirectUrl`
      // straight to the success page. Otherwise the server hands back a
      // `paymentUrl` + `formData` we POST to PayFast.
      if (data.redirectUrl) {
        setPendingPayment({ kind: "redirect", url: data.redirectUrl });
      } else if (data.paymentUrl && data.formData) {
        setPendingPayment({
          kind: "formPost",
          url: data.paymentUrl,
          fields: data.formData,
        });
      } else {
        setErrors({ form: "Unexpected response from payment server." });
        setSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setErrors({ form: "Network error. Please try again." });
      setSubmitting(false);
    }
  }

  if (!hasHydrated) {
    return (
      <div className="py-20 text-center text-ink/50 text-sm">
        Loading your bag…
      </div>
    );
  }

  if (lines.length === 0 && !pendingPayment) {
    return null;
  }

  return (
    <div className="grid lg:grid-cols-[1.3fr_1fr] gap-12 lg:gap-16">
      {/* Customer form */}
      <form onSubmit={onSubmit} noValidate className="space-y-10">
        <Section title="Contact">
          {signedInEmail && (
            <p className="text-[11px] text-ink/45 font-body">
              Signed in as <span className="text-ink/70">{signedInEmail}</span>{" "}
              — this order will appear in your account.
            </p>
          )}
          <Field
            label="Email"
            value={form.email}
            onChange={(v) => update("email", v)}
            type="email"
            error={errors.email}
            autoComplete="email"
            required
          />
          <Field
            label="Phone (optional)"
            value={form.phone}
            onChange={(v) => update("phone", v)}
            type="tel"
            autoComplete="tel"
          />
        </Section>

        <Section title="Shipping Address">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="First name"
              value={form.firstName}
              onChange={(v) => update("firstName", v)}
              error={errors.firstName}
              autoComplete="given-name"
              required
            />
            <Field
              label="Last name"
              value={form.lastName}
              onChange={(v) => update("lastName", v)}
              error={errors.lastName}
              autoComplete="family-name"
              required
            />
          </div>
          <Field
            label="Address line 1"
            value={form.addressLine1}
            onChange={(v) => update("addressLine1", v)}
            error={errors.addressLine1}
            autoComplete="address-line1"
            required
          />
          <Field
            label="Address line 2 (optional)"
            value={form.addressLine2 ?? ""}
            onChange={(v) => update("addressLine2", v)}
            autoComplete="address-line2"
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="City"
              value={form.city}
              onChange={(v) => update("city", v)}
              error={errors.city}
              autoComplete="address-level2"
              required
            />
            <Field
              label="Postal code"
              value={form.postalCode}
              onChange={(v) => update("postalCode", v)}
              error={errors.postalCode}
              autoComplete="postal-code"
              required
            />
          </div>
          <Field
            label="Country"
            value={form.country}
            onChange={(v) => update("country", v)}
            autoComplete="country"
            readOnly
          />
        </Section>

        <Section title="Delivery Method">
          <div
            role="radiogroup"
            aria-label="Delivery method"
            className="space-y-3"
          >
            {SHIPPING_METHODS.map((method) => {
              const selected = shippingMethod === method.id;
              const isPudo = method.id === "pudo_locker";
              return (
                <div
                  key={method.id}
                  className={`border transition-colors duration-200 ${
                    selected
                      ? "border-ink"
                      : "border-ink/15 hover:border-ink/40"
                  }`}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setShippingMethod(method.id)}
                    className="flex w-full items-start gap-4 px-4 py-4 text-left cursor-pointer"
                  >
                    {/* Radio indicator */}
                    <span
                      className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        selected ? "border-ink" : "border-ink/30"
                      }`}
                      aria-hidden
                    >
                      <AnimatePresence>
                        {selected && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ duration: 0.15 }}
                            className="h-2 w-2 rounded-full bg-ink"
                          />
                        )}
                      </AnimatePresence>
                    </span>

                    {/* Label + description + price */}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-display text-[15px] leading-snug text-ink">
                          {method.label}
                        </span>
                        <span className="shrink-0 font-body text-sm text-ink">
                          {isFreeShipping ? (
                            <>
                              <span className="mr-1.5 text-ink/35 line-through">
                                {formatPrice(method.price)}
                              </span>
                              Free
                            </>
                          ) : (
                            formatPrice(method.price)
                          )}
                        </span>
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-ink/45">
                        {method.blurb} · {method.eta}
                      </span>
                    </span>
                  </button>

                  {/* Locker instruction — the sub-header note asking the
                      customer where to send their locker preference. */}
                  {isPudo && (
                    <div className="pb-4 pl-12 pr-4">
                      <p className="border-l border-ink/15 pl-3 text-[11px] leading-relaxed text-ink/55">
                        <span className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-ink/45">
                          Choosing your locker
                        </span>
                        Add your preferred locker in the order notes below, or
                        email it to{" "}
                        <span className="font-medium text-ink">
                          {SUPPORT_EMAIL}
                        </span>
                        . If none is provided, it will be sent to the nearest
                        available locker to your address.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Order notes (optional)">
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full border border-ink/15 bg-paper px-4 py-3 text-sm font-body focus:outline-none focus:border-ink transition-colors resize-none"
            placeholder="Anything we should know?"
          />
        </Section>

        {errors.form && (
          <div className="border border-red-900/30 bg-red-50 px-4 py-3 text-sm text-red-900">
            {errors.form}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || pendingPayment !== null}
          className="w-full py-4 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pendingPayment
            ? pendingPayment.kind === "redirect"
              ? "Redirecting…"
              : "Redirecting to PayFast…"
            : submitting
              ? "Processing…"
              : `Pay ${formatPrice(total)}`}
        </button>

        <p className="text-[11px] text-ink/45 text-center leading-relaxed">
          By placing this order you agree to our terms. Payment is processed
          securely by PayFast — we never store your card details.
        </p>
      </form>

      {/* Summary */}
      <aside className="lg:sticky lg:top-32 h-fit">
        <div className="bg-paper-warm border border-ink/10 p-6 lg:p-8">
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body mb-6">
            Your Order
          </h2>
          <ul className="divide-y divide-ink/10">
            {lines.map((line) => (
              <li
                key={line.id}
                className="flex gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="relative w-16 h-20 shrink-0 overflow-hidden bg-stone">
                  {line.image_url && (
                    <Image
                      src={line.image_url}
                      alt={line.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                  <span className="absolute top-1 right-1 bg-ink text-paper text-[10px] font-body w-5 h-5 rounded-full flex items-center justify-center">
                    {line.quantity}
                  </span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="font-display text-sm leading-snug">
                    {line.name}
                  </p>
                  {line.description && (
                    <p
                      className="text-ink/45 line-clamp-2 leading-snug"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "11px",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {line.description}
                    </p>
                  )}
                  <span className="mt-auto text-sm font-body">
                    {formatPrice(line.price * line.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {bundle ? (
            <div className="mt-6 pt-6 border-t border-ink/10">
              <p className="block text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body mb-1.5">
                Bundle
              </p>
              <div className="flex items-center gap-3 border border-gold/40 bg-gold-muted px-4 py-3.5">
                <svg
                  className="w-4 h-4 shrink-0 text-gold-dark"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-body text-ink truncate">
                    {bundle.label}
                  </span>
                  <span className="text-[11px] text-ink/55">
                    −{formatPrice(bundleAmount)} applied automatically
                  </span>
                </div>
              </div>
            </div>
          ) : (
          <div className="mt-6 pt-6 border-t border-ink/10">
            <label className="block text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body mb-1.5">
              Discount code
            </label>
            {appliedDiscount ? (
              <div className="flex items-center justify-between gap-3 border border-ink/15 bg-paper px-4 py-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-body truncate">
                    {appliedDiscount.code}
                  </span>
                  <span className="text-[11px] text-ink/55">
                    −{formatPrice(appliedDiscount.amount)} applied
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeDiscount}
                  className="text-[11px] tracking-[0.15em] uppercase text-ink/55 hover:text-ink transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={discountInput}
                  onChange={(e) => {
                    setDiscountInput(e.target.value.toUpperCase());
                    if (discountError) setDiscountError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyDiscount();
                    }
                  }}
                  placeholder="CHARM-XXXXXX"
                  className="flex-1 min-w-0 border border-ink/15 bg-paper px-4 py-3 text-sm font-body tracking-[0.1em] focus:outline-none focus:border-ink transition-colors"
                />
                <button
                  type="button"
                  onClick={applyDiscount}
                  disabled={!discountInput.trim() || discountLoading}
                  className="px-5 border border-ink text-ink text-[11px] tracking-[0.2em] uppercase font-body hover:bg-ink hover:text-paper transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {discountLoading ? "…" : "Apply"}
                </button>
              </div>
            )}
            {discountError && (
              <p className="mt-2 text-[11px] text-red-600">{discountError}</p>
            )}
          </div>
          )}

          <div className="mt-6 pt-6 border-t border-ink/10 space-y-2">
            <div className="flex justify-between text-sm text-ink/60">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {bundle ? (
              <div className="flex justify-between text-sm text-ink/60">
                <span>{bundle.label}</span>
                <span>−{formatPrice(bundleAmount)}</span>
              </div>
            ) : appliedDiscount ? (
              <div className="flex justify-between text-sm text-ink/60">
                <span>Discount ({appliedDiscount.code})</span>
                <span>−{formatPrice(appliedDiscount.amount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 text-sm text-ink/60">
              <span className="min-w-0">
                Shipping
                <span className="block text-[11px] text-ink/40 truncate">
                  {shippingMethodLabel(shippingMethod)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {isFreeShipping ? (
                  <>
                    <span className="mr-1.5 text-ink/35 line-through">
                      {formatPrice(
                        SHIPPING_METHODS.find((m) => m.id === shippingMethod)
                          ?.price ?? 0,
                      )}
                    </span>
                    Free
                  </>
                ) : (
                  formatPrice(shippingCost)
                )}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 mt-3 border-t border-ink/15">
              <span className="text-[11px] tracking-[0.2em] uppercase font-body">
                Total
              </span>
              <span className="font-display text-2xl">
                {formatPrice(total)}
              </span>
            </div>
          </div>

          <Link
            href="/shop"
            className="mt-6 block text-center text-[11px] tracking-[0.15em] uppercase text-ink/55 hover:text-ink transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </aside>
    </div>
  );
}

function discountErrorMessage(reason: string): string {
  switch (reason) {
    case "not_found":
      return "Code not found";
    case "inactive":
      return "Code is no longer active";
    case "expired":
      return "Code has expired";
    case "max_uses_reached":
      return "Code has already been used";
    case "min_order_not_met":
      return "Your order doesn't meet the minimum";
    case "email_mismatch":
      return "Code is tied to a different email";
    case "email_required":
      return "Enter your email above before applying a code.";
    default:
      return "Code is invalid";
  }
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  autoComplete?: string;
  required?: boolean;
  readOnly?: boolean;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  error,
  autoComplete,
  required,
  readOnly,
}: FieldProps) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body mb-1.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        readOnly={readOnly}
        className={`w-full border ${error ? "border-red-500" : "border-ink/15"} bg-paper px-4 py-3 text-sm font-body focus:outline-none focus:border-ink transition-colors ${readOnly ? "text-ink/50" : ""}`}
      />
      {error && (
        <span className="mt-1 block text-[11px] text-red-600">{error}</span>
      )}
    </label>
  );
}
