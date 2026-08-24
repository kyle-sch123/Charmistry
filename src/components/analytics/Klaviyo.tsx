/**
 * Injects the Klaviyo onsite tracking script for client-side tracking and
 * engagement (signup forms, web tracking, etc). Renders null when the
 * company ID is unset.
 *
 * Server-side marketing events ("Placed Order") are emitted separately via
 * src/lib/klaviyo.ts from the PayFast ITN handler.
 *
 * Two halves, deliberately split:
 *
 * 1. The queueing shim is a regular inline <script>, so `window.klaviyo` exists
 *    from the first byte and every `klaviyo.push(...)` from lib/klaviyo-client
 *    lands in `_klOnsite`. Nothing is ever dropped for arriving early.
 * 2. klaviyo.js itself — by far the heaviest third party on the site, ~15
 *    chunks and a few hundred ms of main-thread work — is held back until the
 *    visitor shows intent (first scroll, tap, key or pointer move) or
 *    IDLE_FALLBACK_MS elapses, whichever comes first. The real library drains
 *    `_klOnsite` when it arrives, so queued events, identifies and the signup
 *    form all survive the wait; a visitor who reads without touching anything
 *    is still picked up by the fallback timer.
 */

"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const KLAVIYO_COMPANY_ID =
  process.env.NEXT_PUBLIC_KLAVIYO_COMPANY_ID ?? "RDuzmB";

/**
 * How long to wait for intent before loading Klaviyo anyway. Long enough to
 * stay clear of the page-load main-thread crunch, short enough that a passive
 * reader is still tracked and still sees the signup form. Raising it defers
 * more work but risks losing genuinely instant bounces.
 */
const IDLE_FALLBACK_MS = 5000;

const INTENT_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "touchstart",
  "scroll",
] as const;

export default function Klaviyo() {
  const [loadLibrary, setLoadLibrary] = useState(false);

  useEffect(() => {
    if (!KLAVIYO_COMPANY_ID) return;

    let fired = false;

    // Both are hoisted declarations so they can close over `timer`, which is
    // assigned below — nothing can call them before that line, because
    // listeners and timers only ever run on a later task.
    function fire() {
      if (fired) return;
      fired = true;
      stopListening();
      setLoadLibrary(true);
    }

    function stopListening() {
      for (const event of INTENT_EVENTS) {
        window.removeEventListener(event, fire);
      }
      clearTimeout(timer);
    }

    for (const event of INTENT_EVENTS) {
      window.addEventListener(event, fire, { once: true, passive: true });
    }
    const timer = setTimeout(fire, IDLE_FALLBACK_MS);

    return stopListening;
  }, []);

  if (!KLAVIYO_COMPANY_ID) return null;

  return (
    <>
      <script
        id="klaviyo-init"
        dangerouslySetInnerHTML={{
          __html: `
          !function(){if(!window.klaviyo){window._klOnsite=window._klOnsite||[];try{window.klaviyo=new Proxy({},{get:function(n,i){return"push"===i?function(){var n;(n=window._klOnsite).push.apply(n,arguments)}:function(){for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)o[w]=arguments[w];var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))}));return e}}})}catch(n){window.klaviyo=window.klaviyo||[],window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}}}}();
        `,
        }}
      />
      {loadLibrary && (
        <Script
          id="klaviyo-onsite"
          strategy="afterInteractive"
          src={`https://static.klaviyo.com/onsite/js/${KLAVIYO_COMPANY_ID}/klaviyo.js?company_id=${KLAVIYO_COMPANY_ID}`}
        />
      )}
    </>
  );
}
