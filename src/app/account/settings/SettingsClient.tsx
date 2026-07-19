/**
 * Account settings (client): personal details + default address (saved
 * straight to `profiles` under the own-row RLS update policy — no API route
 * needed), the marketing preference (via /api/account/marketing so the
 * Resend audience stays in sync), sign-out, and account deletion with a
 * type-to-confirm modal (via /api/account/delete).
 *
 * Field/Section mirror the checkout form's visual pattern.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { getAuthBrowserClient } from "@/lib/auth/client";
import type { Profile } from "@/types";

interface SettingsClientProps {
  email: string | null;
  profile: Profile | null;
}

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
}

export default function SettingsClient({ email, profile }: SettingsClientProps) {
  const router = useRouter();

  const [form, setForm] = useState<ProfileForm>({
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    phone: profile?.phone ?? "",
    addressLine1: profile?.default_address_line1 ?? "",
    addressLine2: profile?.default_address_line2 ?? "",
    city: profile?.default_city ?? "",
    postalCode: profile?.default_postal_code ?? "",
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const [marketingOptIn, setMarketingOptIn] = useState(
    profile?.marketing_opt_in ?? false,
  );
  const [marketingBusy, setMarketingBusy] = useState(false);
  const [marketingError, setMarketingError] = useState<string | null>(null);

  const [signingOut, setSigningOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function update<K extends keyof ProfileForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (saveState === "saved") setSaveState("idle");
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saveState === "saving") return;

    const postal = form.postalCode.trim();
    if (postal && !/^\d{4}$/.test(postal)) {
      setSaveError("Postal code must be 4 digits.");
      return;
    }

    setSaveState("saving");
    setSaveError(null);
    const supabase = getAuthBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaveState("idle");
      setSaveError("Your session expired — please sign in again.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: form.firstName.trim() || null,
        last_name: form.lastName.trim() || null,
        phone: form.phone.trim() || null,
        default_address_line1: form.addressLine1.trim() || null,
        default_address_line2: form.addressLine2.trim() || null,
        default_city: form.city.trim() || null,
        default_postal_code: postal || null,
      })
      .eq("id", user.id);

    if (error) {
      setSaveState("idle");
      setSaveError("Could not save your details. Please try again.");
      return;
    }
    setSaveState("saved");
  }

  async function toggleMarketing() {
    if (marketingBusy) return;
    const nextValue = !marketingOptIn;
    setMarketingBusy(true);
    setMarketingError(null);
    setMarketingOptIn(nextValue); // optimistic
    try {
      const res = await fetch("/api/account/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn: nextValue }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setMarketingOptIn(!nextValue); // revert
      setMarketingError("Could not update your preference. Try again.");
    } finally {
      setMarketingBusy(false);
    }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await getAuthBrowserClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function deleteAccount() {
    if (deleteBusy || deleteConfirm !== "DELETE") return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      // The server has deleted the user; clear the local session and leave.
      await getAuthBrowserClient().auth.signOut();
      window.location.assign("/");
    } catch {
      setDeleteBusy(false);
      setDeleteError("Could not delete your account. Please try again.");
    }
  }

  return (
    <div className="space-y-12">
      {/* Identity */}
      <section className="space-y-4">
        <h2 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body">
          Signed In As
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-4 border border-ink/10 p-6">
          <p className="text-sm text-ink/70 min-w-0 truncate">{email ?? "—"}</p>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="px-6 py-2.5 border border-ink/25 text-[11px] tracking-[0.2em] uppercase font-body hover:border-ink transition-colors cursor-pointer disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>

      {/* Details + default address */}
      <form onSubmit={saveProfile} className="space-y-10">
        <Section title="Personal Details">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="First name"
              value={form.firstName}
              onChange={(v) => update("firstName", v)}
              autoComplete="given-name"
            />
            <Field
              label="Last name"
              value={form.lastName}
              onChange={(v) => update("lastName", v)}
              autoComplete="family-name"
            />
          </div>
          <Field
            label="Phone (optional)"
            value={form.phone}
            onChange={(v) => update("phone", v)}
            type="tel"
            autoComplete="tel"
          />
        </Section>

        <Section title="Default Shipping Address">
          <p className="text-[11px] text-ink/45 leading-relaxed -mt-1">
            Saved here, filled in for you at checkout.
          </p>
          <Field
            label="Address line 1"
            value={form.addressLine1}
            onChange={(v) => update("addressLine1", v)}
            autoComplete="address-line1"
          />
          <Field
            label="Address line 2 (optional)"
            value={form.addressLine2}
            onChange={(v) => update("addressLine2", v)}
            autoComplete="address-line2"
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="City"
              value={form.city}
              onChange={(v) => update("city", v)}
              autoComplete="address-level2"
            />
            <Field
              label="Postal code"
              value={form.postalCode}
              onChange={(v) => update("postalCode", v)}
              autoComplete="postal-code"
            />
          </div>
        </Section>

        {saveError && (
          <div className="border border-red-900/30 bg-red-50 px-4 py-3 text-sm text-red-900">
            {saveError}
          </div>
        )}

        <button
          type="submit"
          disabled={saveState === "saving"}
          className="px-10 py-3.5 bg-ink text-paper text-[11px] tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-60"
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved ✓"
              : "Save changes"}
        </button>
      </form>

      {/* Marketing preference */}
      <section className="space-y-4">
        <h2 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body">
          Email Preferences
        </h2>
        <div className="border border-ink/10 p-6">
          <button
            type="button"
            role="switch"
            aria-checked={marketingOptIn}
            onClick={toggleMarketing}
            disabled={marketingBusy}
            className="flex w-full items-center justify-between gap-4 text-left cursor-pointer disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="block font-display text-[15px]">
                New pieces & offers
              </span>
              <span className="mt-1 block text-[11px] text-ink/45 leading-relaxed">
                Occasional emails about new arrivals and member offers. No
                spam, unsubscribe any time.
              </span>
            </span>
            <span
              className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
                marketingOptIn ? "bg-ink border-ink" : "bg-paper border-ink/30"
              }`}
              aria-hidden
            >
              <span
                className={`absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full transition-all ${
                  marketingOptIn ? "right-0.5 bg-paper" : "left-0.5 bg-ink/40"
                }`}
              />
            </span>
          </button>
          {marketingError && (
            <p className="mt-3 text-[11px] text-red-600">{marketingError}</p>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section className="space-y-4">
        <h2 className="text-[11px] tracking-[0.3em] uppercase text-ink/55 font-body">
          Delete Account
        </h2>
        <div className="border border-ink/10 p-6">
          <p className="text-[11px] text-ink/45 leading-relaxed mb-4">
            Permanently removes your account, saved details, and wishlist.
            Records of past orders are kept for accounting, but they will no
            longer be linked to you.
          </p>
          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true);
              setDeleteConfirm("");
              setDeleteError(null);
            }}
            className="px-6 py-2.5 border border-red-900/40 text-red-900 text-[11px] tracking-[0.2em] uppercase font-body hover:bg-red-50 transition-colors cursor-pointer"
          >
            Delete my account
          </button>
        </div>
      </section>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
            onClick={() => !deleteBusy && setDeleteOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-paper p-8"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
            >
              <h3
                id="delete-account-title"
                className="font-display text-xl mb-3"
              >
                Delete your account?
              </h3>
              <p className="text-sm text-ink/60 leading-relaxed mb-6">
                This can&apos;t be undone. Type{" "}
                <span className="font-medium text-ink">DELETE</span> to
                confirm.
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full border border-ink/15 bg-paper px-4 py-3 text-sm font-body tracking-[0.1em] focus:outline-none focus:border-ink transition-colors mb-4"
              />
              {deleteError && (
                <p className="mb-4 text-[11px] text-red-600">{deleteError}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleteBusy}
                  className="flex-1 py-3 border border-ink/25 text-[11px] tracking-[0.2em] uppercase font-body hover:border-ink transition-colors cursor-pointer disabled:opacity-60"
                >
                  Keep account
                </button>
                <button
                  type="button"
                  onClick={deleteAccount}
                  disabled={deleteBusy || deleteConfirm !== "DELETE"}
                  className="flex-1 py-3 bg-red-900 text-paper text-[11px] tracking-[0.2em] uppercase font-body hover:bg-red-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleteBusy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
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
        className="w-full border border-ink/15 bg-paper px-4 py-3 text-sm font-body focus:outline-none focus:border-ink transition-colors"
      />
    </label>
  );
}
