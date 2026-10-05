/**
 * Shipping prices — the flat price of each delivery method, as charged at
 * checkout. Loads on mount (two rows) so the collapsed header shows the live
 * prices at a glance; editing sits behind the toggle like the category manager.
 *
 * Saving writes /api/admin/shipping. The checkout page and /api/checkout both
 * read the stored prices on every request, so a change applies to the next
 * shopper who opens checkout — no deploy.
 *
 * The free-delivery thresholds are NOT editable here (they're code constants
 * the cart drawer renders from); the panel says so, so nobody expects a price
 * change to move them.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";
import {
  FREE_DOOR_THRESHOLD,
  FREE_LOCKER_THRESHOLD,
  MAX_SHIPPING_PRICE,
  parseShippingPrice,
  type ShippingMethodId,
} from "@/lib/shipping";
import { inputCls, labelCls } from "./shared";

type AdminRequest = (input: string, init?: RequestInit) => Promise<Response>;

interface AdminShippingMethod {
  id: ShippingMethodId;
  label: string;
  carrier: string;
  eta: string;
  price: number;
  defaultPrice: number;
}

interface ShippingResponse {
  configured: boolean;
  methods: AdminShippingMethod[];
}

/** Compact names for the collapsed header summary. */
const SHORT_LABEL: Record<ShippingMethodId, string> = {
  pudo_locker: "Locker",
  courier_economy: "Economy",
};

const PRICE_ERROR = `Enter a price above R0, up to ${formatPrice(MAX_SHIPPING_PRICE)}.`;

type Drafts = Partial<Record<ShippingMethodId, string>>;

function draftsFrom(methods: AdminShippingMethod[]): Drafts {
  return Object.fromEntries(methods.map((m) => [m.id, String(m.price)]));
}

export default function ShippingManager({ request }: { request: AdminRequest }) {
  const [open, setOpen] = useState(false);
  const [methods, setMethods] = useState<AdminShippingMethod[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [drafts, setDrafts] = useState<Drafts>({});
  // Errors show after a field is left (blur) or a save is attempted, never
  // while the owner is still typing — and clear the instant the value is valid.
  const [touched, setTouched] = useState<Partial<Record<ShippingMethodId, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const apply = useCallback((data: ShippingResponse) => {
    setMethods(data.methods);
    setConfigured(data.configured);
    setDrafts(draftsFrom(data.methods));
    setTouched({});
    setAttempted(false);
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await request("/api/admin/shipping", { cache: "no-store" });
      if (res.status === 401) return;
      if (!res.ok) throw new Error(`shipping load failed (${res.status})`);
      apply((await res.json()) as ShippingResponse);
    } catch (err) {
      console.error(err);
      setLoadError("Couldn’t load the shipping prices. Check the connection and retry.");
    }
  }, [request, apply]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const changed = (methods ?? []).filter(
    (m) => parseShippingPrice(drafts[m.id]) !== m.price,
  );
  const invalid = (methods ?? []).filter(
    (m) => parseShippingPrice(drafts[m.id]) === null,
  );

  function edit(id: ShippingMethodId, value: string) {
    setDrafts((cur) => ({ ...cur, [id]: value }));
    setSaved(false);
    setSaveError(null);
  }

  async function save() {
    setAttempted(true);
    if (invalid.length > 0 || changed.length === 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const res = await request("/api/admin/shipping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prices: Object.fromEntries(
            changed.map((m) => [m.id, parseShippingPrice(drafts[m.id])]),
          ),
        }),
      });
      if (res.status === 401) return;
      const data = (await res.json().catch(() => null)) as
        | (Partial<ShippingResponse> & { error?: string })
        | null;
      if (!res.ok) {
        if (data?.error === "setup_required") {
          setConfigured(false);
          setSaveError("Saving isn’t switched on yet — see the note above.");
        } else if (data?.error === "invalid_price") {
          setSaveError(PRICE_ERROR);
        } else {
          setSaveError("Couldn’t save the shipping prices. Check the connection and try again.");
        }
        return;
      }
      if (data?.methods && data.configured !== undefined) {
        apply(data as ShippingResponse);
      } else {
        await load();
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`border ${open ? "border-ink" : "border-ink/15"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left cursor-pointer"
      >
        <span className="text-[11px] tracking-[0.2em] uppercase text-ink/60 font-body">
          Shipping prices
        </span>
        <span className="flex items-center gap-4">
          <span className="font-body text-[12px] text-ink/55 tabular-nums">
            {methods
              ? methods.map((m) => `${SHORT_LABEL[m.id]} ${formatPrice(m.price)}`).join(" · ")
              : loadError
                ? "Not loaded"
                : "Loading…"}
            {saved && <span className="text-green-800"> · saved ✓</span>}
          </span>
          <span className="text-ink/40 text-sm" aria-hidden>
            {open ? "–" : "+"}
          </span>
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-ink/10 px-5 py-5">
          {loadError && (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-red-900/30 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-900 font-body">{loadError}</p>
              <button
                type="button"
                onClick={load}
                className="text-[11px] tracking-[0.15em] uppercase text-red-900 underline underline-offset-4 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {!configured && (
            <p className="border border-amber-700/30 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900 font-body">
              Saving is switched off until the shipping prices table is set up in the
              database (migration <code className="text-[11px]">013_shipping_rates.sql</code>).
              Until then checkout charges the default prices shown here.
            </p>
          )}

          {methods && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {methods.map((m) => {
                const inputId = `shipping-price-${m.id}`;
                const noteId = `${inputId}-note`;
                const showError =
                  (touched[m.id] || attempted) &&
                  parseShippingPrice(drafts[m.id]) === null;
                return (
                  <div key={m.id} className="border border-ink/10 p-4">
                    <p className="font-display text-[15px] leading-snug text-ink">
                      {m.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink/45 font-body">
                      {m.carrier} · {m.eta}
                    </p>

                    <label htmlFor={inputId} className={`${labelCls} mt-4`}>
                      <span className="sr-only">{m.label} </span>Price
                    </label>
                    <div className="relative">
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink/45 font-body"
                      >
                        R
                      </span>
                      <input
                        id={inputId}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={drafts[m.id] ?? ""}
                        disabled={!configured}
                        onChange={(e) => edit(m.id, e.target.value)}
                        onBlur={() => setTouched((cur) => ({ ...cur, [m.id]: true }))}
                        aria-invalid={showError || undefined}
                        aria-describedby={noteId}
                        className={`${inputCls} pl-7 tabular-nums disabled:bg-paper-warm/60 disabled:text-ink/50 ${
                          showError ? "border-red-600 focus:border-red-600" : ""
                        }`}
                      />
                    </div>
                    <p
                      id={noteId}
                      className={`mt-1.5 text-[11px] font-body ${
                        showError ? "text-red-600" : "text-ink/45"
                      }`}
                    >
                      {showError ? PRICE_ERROR : `Default ${formatPrice(m.defaultPrice)}`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-ink/50 font-body">
            Free delivery still applies from {formatPrice(FREE_LOCKER_THRESHOLD)} (locker)
            and {formatPrice(FREE_DOOR_THRESHOLD)} (any method) — those thresholds aren’t
            changed here. Prices quoted in the site’s wording (the scrolling top banner,
            the FAQ) are page text and won’t update on their own.
          </p>

          {saveError && <p className="text-[12px] text-red-600 font-body">{saveError}</p>}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={save}
              disabled={saving || !configured || !methods || changed.length === 0}
              className="bg-ink px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-paper hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save shipping prices"}
            </button>
            {saved && (
              <span className="text-[12px] text-green-800 font-body">
                Saved — checkout now charges these prices.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
