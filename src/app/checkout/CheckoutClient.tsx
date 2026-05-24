"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, selectCartSubtotal } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";
import type { CheckoutFormData } from "@/types";

type FormErrors = Partial<Record<keyof CheckoutFormData, string>> & {
  form?: string;
};

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

  const [form, setForm] = useState<CheckoutFormData>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  const shippingCost = 0;
  const discountAmount = appliedDiscount?.amount ?? 0;
  const total = useMemo(
    () => Math.max(0, subtotal + shippingCost - discountAmount),
    [subtotal, discountAmount],
  );

  // Empty-cart redirect (only after hydration to avoid SSR flash)
  useEffect(() => {
    if (hasHydrated && lines.length === 0 && !paymentUrl) {
      router.replace("/shop");
    }
  }, [hasHydrated, lines.length, paymentUrl, router]);

  useEffect(() => {
    if (paymentUrl) {
      window.location.assign(paymentUrl);
    }
  }, [paymentUrl]);

  function update<K extends keyof CheckoutFormData>(
    key: K,
    value: CheckoutFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
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
    if (!form.postalCode.trim()) next.postalCode = "Required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function applyDiscount() {
    const code = discountInput.trim();
    if (!code || discountLoading) return;
    setDiscountLoading(true);
    setDiscountError(null);
    try {
      const res = await fetch("/api/discount/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal, email: form.email.trim() }),
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
          discountCode: appliedDiscount?.code,
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

      setPaymentUrl(data.authorizationUrl);
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

  if (lines.length === 0 && !paymentUrl) {
    return null;
  }

  return (
    <div className="grid lg:grid-cols-[1.3fr_1fr] gap-12 lg:gap-16">
      {/* Customer form */}
      <form onSubmit={onSubmit} noValidate className="space-y-10">
        <Section title="Contact">
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
          disabled={submitting || paymentUrl !== null}
          className="w-full py-4 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {paymentUrl
            ? "Redirecting to Paystack…"
            : submitting
              ? "Processing…"
              : `Pay ${formatPrice(total)}`}
        </button>

        <p className="text-[11px] text-ink/45 text-center leading-relaxed">
          By placing this order you agree to our terms. Payment is processed
          securely by Paystack — we never store your card details.
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

          <div className="mt-6 pt-6 border-t border-ink/10 space-y-2">
            <div className="flex justify-between text-sm text-ink/60">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {appliedDiscount && (
              <div className="flex justify-between text-sm text-ink/60">
                <span>Discount ({appliedDiscount.code})</span>
                <span>−{formatPrice(appliedDiscount.amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-ink/60">
              <span>Shipping</span>
              <span>
                {shippingCost === 0 ? "Free" : formatPrice(shippingCost)}
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
