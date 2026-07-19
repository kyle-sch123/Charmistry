/**
 * Wishlist state (Zustand, NOT persisted — Supabase is the source of truth).
 *
 * Reads/writes go straight from the browser through the cookie-backed auth
 * client; the own-row RLS policies on wishlist_items are the entire security
 * model, so no API route sits in between (it would add code for zero gain).
 *
 * Lifecycle: load() is idempotent and called by every WishlistButton on
 * mount — the first one wins, the rest no-op. toggle() is optimistic with
 * rollback. An auth listener (registered lazily, browser-only) empties the
 * list on sign-out and reloads it on sign-in, so hearts never leak between
 * accounts on a shared device.
 */

"use client";

import { create } from "zustand";
import { getAuthBrowserClient } from "@/lib/auth/client";

type WishlistStatus = "idle" | "loading" | "ready" | "signed-out";

interface WishlistState {
  ids: Set<string>;
  status: WishlistStatus;
  load: () => Promise<void>;
  toggle: (
    productId: string,
  ) => Promise<"added" | "removed" | "unauthenticated" | "error">;
}

let authListenerRegistered = false;

function ensureAuthListener() {
  if (authListenerRegistered || typeof window === "undefined") return;
  authListenerRegistered = true;
  getAuthBrowserClient().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      useWishlist.setState({ ids: new Set(), status: "signed-out" });
    } else if (event === "SIGNED_IN") {
      // Re-pull for the (possibly different) user. load() no-ops if a load
      // is already in flight.
      useWishlist.setState({ status: "idle" });
      void useWishlist.getState().load();
    }
  });
}

export const useWishlist = create<WishlistState>()((set, get) => ({
  ids: new Set<string>(),
  status: "idle",

  load: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    ensureAuthListener();
    set({ status: "loading" });
    try {
      const supabase = getAuthBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        set({ ids: new Set(), status: "signed-out" });
        return;
      }
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("product_id")
        .returns<{ product_id: string }[]>();
      if (error) {
        set({ status: "idle" }); // retryable
        return;
      }
      set({
        ids: new Set((data ?? []).map((r) => r.product_id)),
        status: "ready",
      });
    } catch {
      set({ status: "idle" });
    }
  },

  toggle: async (productId) => {
    // Late-load if a button is clicked before the first load finished.
    if (get().status !== "ready" && get().status !== "signed-out") {
      await get().load();
    }
    if (get().status === "signed-out") return "unauthenticated";
    if (get().status !== "ready") return "error";

    const had = get().ids.has(productId);
    const apply = (present: boolean) =>
      set((state) => {
        const next = new Set(state.ids);
        if (present) next.add(productId);
        else next.delete(productId);
        return { ids: next };
      });

    apply(!had); // optimistic
    try {
      const supabase = getAuthBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        apply(had);
        return "unauthenticated";
      }
      if (had) {
        const { error } = await supabase
          .from("wishlist_items")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        if (error) throw error;
        return "removed";
      }
      const { error } = await supabase
        .from("wishlist_items")
        .upsert(
          { user_id: user.id, product_id: productId },
          { onConflict: "user_id,product_id", ignoreDuplicates: true },
        );
      if (error) throw error;
      return "added";
    } catch {
      apply(had); // rollback
      return "error";
    }
  },
}));
