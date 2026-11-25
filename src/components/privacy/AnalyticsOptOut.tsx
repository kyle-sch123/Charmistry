/**
 * "Don't record my visits": the visitor's right to object (POPIA s11(3)) to
 * first-party visit statistics on this browser.
 *
 * Switching it on stores a flag the tracker checks before doing anything,
 * stops the tracker for the current page, and deletes the tracker's stored
 * state from this device. It is read with useSyncExternalStore, so the server
 * render and the first client render agree and no effect has to set state.
 */

"use client";

import { useState, useSyncExternalStore, type ChangeEvent } from "react";
import { disableTracking } from "@/lib/analytics/tracker";
import { OPT_OUT_KEY } from "@/lib/analytics/types";

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readOptOut(): boolean {
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export default function AnalyticsOptOut() {
  const optedOut = useSyncExternalStore(subscribe, readOptOut, () => false);
  const [message, setMessage] = useState("");

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const on = e.target.checked;
    try {
      if (on) window.localStorage.setItem(OPT_OUT_KEY, "1");
      else window.localStorage.removeItem(OPT_OUT_KEY);
    } catch {
      setMessage("This browser won't let us save the setting. Private browsing can block it.");
      return;
    }
    if (on) disableTracking();
    listeners.forEach((l) => l());
    setMessage(
      on
        ? "Your visits won't be recorded on this browser."
        : "Visit statistics are back on for this browser from your next page.",
    );
  }

  return (
    <div className="mt-5">
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-ink">
        <input
          type="checkbox"
          className="size-4 accent-ink"
          checked={optedOut}
          onChange={onChange}
        />
        <span>Don&apos;t record my visits</span>
      </label>
      <p role="status" className="mt-1 min-h-5 text-[13px] text-ink-secondary">
        {message}
      </p>
    </div>
  );
}
