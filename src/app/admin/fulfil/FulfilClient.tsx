/**
 * Fulfilment console (client).
 *
 * Auth: the admin key is entered once and kept in localStorage; every request
 * sends it as `x-admin-key`. A 401 clears the stored key and returns to the
 * gate (wrong key, or the Worker secret changed).
 *
 * Flow: list paid-but-unshipped orders (GET /api/admin/fulfil) → expand one →
 * enter courier + tracking → Ship. The API is idempotent: resubmitting after a
 * "Klaviyo failed" outcome is safe (event deduped by order id), and corrects
 * stored tracking fields — though a correction after the event landed reaches
 * the DB only, not Klaviyo.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";

const KEY_STORAGE = "charmistry-admin-key";

interface AdminOrder {
  id: string;
  shortId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  city: string;
  total: number;
  paidAt: string | null;
  shippingMethod: string | null;
  notes: string | null;
  items: { name: string; quantity: number }[];
}

interface FulfilForm {
  courier: string;
  trackingNumber: string;
  trackingUrl: string;
  waybillNumber: string;
}

const emptyForm: FulfilForm = {
  courier: "The Courier Guy",
  trackingNumber: "",
  trackingUrl: "",
  waybillNumber: "",
};

type ShipResult = { klaviyo: "sent" | "failed" | "skipped" };

export default function FulfilClient() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [gateError, setGateError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<FulfilForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [shipped, setShipped] = useState<Record<string, ShipResult>>({});

  const loadOrders = useCallback(async (key: string) => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/admin/fulfil", {
        headers: { "x-admin-key": key },
        cache: "no-store",
      });
      if (res.status === 401) {
        localStorage.removeItem(KEY_STORAGE);
        setAdminKey(null);
        setOrders(null);
        setGateError("That key was rejected. Enter the current admin key.");
        return;
      }
      if (!res.ok) throw new Error(`list failed (${res.status})`);
      const data = (await res.json()) as { orders: AdminOrder[] };
      setOrders(data.orders);
    } catch (err) {
      console.error(err);
      setListError("Couldn't load orders. Check the connection and retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  // One-time hydration gate: localStorage only exists client-side, so the
  // stored key can't be read during render without an SSR mismatch — this is
  // the documented reason the `hydrated` flag exists. The sync setState here
  // is deliberate, not an oversight.
  useEffect(() => {
    const stored = localStorage.getItem(KEY_STORAGE);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    if (stored) {
      setAdminKey(stored);
      loadOrders(stored);
    }
  }, [loadOrders]);

  function unlock(e: React.FormEvent) {
    e.preventDefault();
    const key = keyInput.trim();
    if (!key) return;
    localStorage.setItem(KEY_STORAGE, key);
    setAdminKey(key);
    setGateError(null);
    setKeyInput("");
    loadOrders(key);
  }

  function expand(order: AdminOrder) {
    setExpandedId((cur) => (cur === order.id ? null : order.id));
    setForm(emptyForm);
    setFormError(null);
  }

  async function ship(order: AdminOrder) {
    if (!adminKey || submitting) return;
    if (!form.trackingNumber.trim()) {
      setFormError("Tracking number is required.");
      return;
    }
    if (!form.courier.trim()) {
      setFormError("Courier is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/fulfil", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          orderId: order.id,
          courier: form.courier.trim(),
          trackingNumber: form.trackingNumber.trim(),
          trackingUrl: form.trackingUrl.trim() || undefined,
          waybillNumber: form.waybillNumber.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        localStorage.removeItem(KEY_STORAGE);
        setAdminKey(null);
        setGateError("That key was rejected. Enter the current admin key.");
        return;
      }
      if (!res.ok) {
        setFormError(
          data?.error === "order_not_paid"
            ? `Order is ${data.status}, not paid — refusing to ship.`
            : `Shipping failed (${data?.error ?? res.status}). Try again.`,
        );
        return;
      }
      setShipped((prev) => ({
        ...prev,
        [order.id]: { klaviyo: data.klaviyo },
      }));
      setExpandedId(null);
    } catch (err) {
      console.error(err);
      setFormError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) return null;

  // ---- Key gate -----------------------------------------------------------
  if (!adminKey) {
    return (
      <form onSubmit={unlock} className="max-w-sm space-y-4">
        <label className="block">
          <span className="block text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body mb-1.5">
            Admin key
          </span>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            autoFocus
            className="w-full border border-ink/15 bg-paper px-4 py-3 text-sm font-body focus:outline-none focus:border-ink transition-colors"
          />
        </label>
        {gateError && (
          <p className="text-[12px] text-red-600 font-body">{gateError}</p>
        )}
        <button
          type="submit"
          disabled={!keyInput.trim()}
          className="px-8 py-3 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-50"
        >
          Unlock
        </button>
      </form>
    );
  }

  // ---- Order list ---------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] tracking-[0.2em] uppercase text-ink/45 font-body">
          {orders ? `${orders.length} awaiting shipment` : "Loading…"}
        </p>
        <button
          type="button"
          onClick={() => loadOrders(adminKey)}
          disabled={loading}
          className="text-[11px] tracking-[0.15em] uppercase text-ink/55 hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {listError && (
        <p className="border border-red-900/30 bg-red-50 px-4 py-3 text-sm text-red-900 font-body">
          {listError}
        </p>
      )}

      {orders && orders.length === 0 && (
        <p className="border border-ink/10 bg-paper-warm px-4 py-8 text-center text-sm text-ink/50 font-body">
          Nothing awaiting shipment. 🎉
        </p>
      )}

      {(orders ?? []).map((order) => {
        const result = shipped[order.id];
        const isOpen = expandedId === order.id;
        return (
          <div
            key={order.id}
            className={`border transition-colors ${
              result
                ? "border-green-800/30 bg-green-50/50"
                : isOpen
                  ? "border-ink"
                  : "border-ink/15"
            }`}
          >
            {/* Summary row */}
            <button
              type="button"
              onClick={() => !result && expand(order)}
              className={`w-full px-5 py-4 text-left ${result ? "cursor-default" : "cursor-pointer"}`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-display text-lg text-ink">
                  #{order.shortId} — {order.firstName} {order.lastName}
                </span>
                <span className="shrink-0 font-body text-sm text-ink">
                  {formatPrice(order.total)}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-ink/55 font-body">
                {order.items
                  .map((it) => `${it.quantity}× ${it.name}`)
                  .join(" · ") || "(items unavailable)"}
              </p>
              <p className="mt-1 text-[11px] text-ink/45 font-body">
                {order.email} · {order.city}
                {order.shippingMethod ? ` · ${order.shippingMethod}` : ""}
                {order.paidAt
                  ? ` · paid ${new Date(order.paidAt).toLocaleDateString("en-ZA")}`
                  : ""}
              </p>
              {order.notes && (
                <p className="mt-2 border-l-2 border-amber-600/40 bg-amber-50 pl-3 pr-2 py-1.5 text-[12px] text-ink/75 font-body">
                  <span className="block text-[9px] uppercase tracking-[0.2em] text-amber-800/70">
                    Customer notes
                  </span>
                  {order.notes}
                </p>
              )}
              {result && (
                <p className="mt-2 text-[12px] font-body text-green-900">
                  Shipped ✓
                  {result.klaviyo === "sent" && " — Klaviyo event sent"}
                  {result.klaviyo === "failed" &&
                    " — but the Klaviyo event FAILED; expand server logs, then resubmit (safe)."}
                  {result.klaviyo === "skipped" &&
                    " — Klaviyo not configured, no event sent"}
                </p>
              )}
            </button>

            {/* Fulfil form */}
            {isOpen && !result && (
              <div className="border-t border-ink/10 px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <AdminField
                    label="Courier"
                    value={form.courier}
                    onChange={(v) => setForm((f) => ({ ...f, courier: v }))}
                  />
                  <AdminField
                    label="Tracking number"
                    value={form.trackingNumber}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, trackingNumber: v }))
                    }
                  />
                  <AdminField
                    label="Tracking URL (optional)"
                    value={form.trackingUrl}
                    onChange={(v) => setForm((f) => ({ ...f, trackingUrl: v }))}
                  />
                  <AdminField
                    label="Waybill (optional)"
                    value={form.waybillNumber}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, waybillNumber: v }))
                    }
                  />
                </div>
                {formError && (
                  <p className="text-[12px] text-red-600 font-body">
                    {formError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => ship(order)}
                  disabled={submitting}
                  className="w-full py-3 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-60"
                >
                  {submitting
                    ? "Recording shipment…"
                    : "Mark shipped + notify customer"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AdminField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body mb-1.5">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-ink/15 bg-paper px-3 py-2.5 text-sm font-body focus:outline-none focus:border-ink transition-colors"
      />
    </label>
  );
}
