"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, selectCartSubtotal } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";
import type { CheckoutFormData } from "@/types";

type FormErrors = Partial<Record<keyof CheckoutFormData, string>> & { form?: string };

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
  const payfastFormRef = useRef<HTMLFormElement>(null);
  const [payfastPayload, setPayfastPayload] = useState<{
    action: string;
    fields: Record<string, string>;
  } | null>(null);

  const shippingCost = 0;
  const total = useMemo(() => subtotal + shippingCost, [subtotal]);

  // Empty-cart redirect (only after hydration to avoid SSR flash)
  useEffect(() => {
    if (hasHydrated && lines.length === 0 && !payfastPayload) {
      router.replace("/shop");
    }
  }, [hasHydrated, lines.length, payfastPayload, router]);

  // Once we have PayFast fields, auto-submit the hidden form to redirect.
  useEffect(() => {
    if (payfastPayload && payfastFormRef.current) {
      payfastFormRef.current.submit();
    }
  }, [payfastPayload]);

  function update<K extends keyof CheckoutFormData>(key: K, value: CheckoutFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!form.email.trim()) next.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Invalid email";
    if (!form.firstName.trim()) next.firstName = "Required";
    if (!form.lastName.trim()) next.lastName = "Required";
    if (!form.addressLine1.trim()) next.addressLine1 = "Required";
    if (!form.city.trim()) next.city = "Required";
    if (!form.postalCode.trim()) next.postalCode = "Required";
    setErrors(next);
    return Object.keys(next).length === 0;
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = Array.isArray(data?.details) && data.details.length > 0
          ? data.details.join(". ")
          : data?.error === "out_of_stock"
            ? `${data.product ?? "An item"} is out of stock`
            : data?.error === "insufficient_stock"
              ? `Only ${data.available} of ${data.product} available`
              : data?.error === "product_unavailable"
                ? "One or more items in your bag are no longer available"
                : "Something went wrong. Please try again.";
        setErrors({ form: msg });
        setSubmitting(false);
        return;
      }

      setPayfastPayload({ action: data.action, fields: data.fields });
    } catch (err) {
      console.error(err);
      setErrors({ form: "Network error. Please try again." });
      setSubmitting(false);
    }
  }

  if (!hasHydrated) {
    return (
      <div className="py-20 text-center text-ink/50 text-sm">Loading your bag…</div>
    );
  }

  if (lines.length === 0 && !payfastPayload) {
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
          disabled={submitting || payfastPayload !== null}
          className="w-full py-4 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {payfastPayload ? "Redirecting to PayFast…" : submitting ? "Processing…" : `Pay ${formatPrice(total)}`}
        </button>

        <p className="text-[11px] text-ink/45 text-center leading-relaxed">
          By placing this order you agree to our terms. Payment is processed securely by PayFast —
          we never store your card details.
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
              <li key={line.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <div className="relative w-16 h-20 shrink-0 overflow-hidden bg-stone">
                  {line.image_url && (
                    <Image src={line.image_url} alt={line.name} fill sizes="64px" className="object-cover" />
                  )}
                  <span className="absolute top-1 right-1 bg-ink text-paper text-[10px] font-body w-5 h-5 rounded-full flex items-center justify-center">
                    {line.quantity}
                  </span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <p className="font-display text-sm leading-snug line-clamp-2">{line.name}</p>
                  <span className="mt-auto text-sm font-body">
                    {formatPrice(line.price * line.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 pt-6 border-t border-ink/10 space-y-2">
            <div className="flex justify-between text-sm text-ink/60">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-ink/60">
              <span>Shipping</span>
              <span>{shippingCost === 0 ? "Free" : formatPrice(shippingCost)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 mt-3 border-t border-ink/15">
              <span className="text-[11px] tracking-[0.2em] uppercase font-body">Total</span>
              <span className="font-display text-2xl">{formatPrice(total)}</span>
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

      {/* Hidden PayFast redirect form */}
      {payfastPayload && (
        <form ref={payfastFormRef} action={payfastPayload.action} method="POST" className="hidden">
          {Object.entries(payfastPayload.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body">{title}</h2>
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

function Field({ label, value, onChange, type = "text", error, autoComplete, required, readOnly }: FieldProps) {
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
      {error && <span className="mt-1 block text-[11px] text-red-600">{error}</span>}
    </label>
  );
}
