/**
 * Injects the Klaviyo onsite tracking script for client-side tracking and
 * engagement (signup forms, web tracking, etc). Renders null when the
 * company ID is unset.
 *
 * Server-side marketing events ("Placed Order") are emitted separately via
 * src/lib/klaviyo.ts from the PayFast ITN handler.
 *
 * Split the same way as the GA and Meta tags: the queueing shim is a regular
 * inline <script> so `window.klaviyo` exists from the first byte and every
 * `klaviyo.push(...)` from lib/klaviyo-client.ts lands in `_klOnsite`, while
 * klaviyo.js — by far the biggest third party here, ~15 chunks and ~220ms of
 * main-thread work — loads `lazyOnload`. The real library drains `_klOnsite`
 * when it arrives, so queued events and identifies survive the wait.
 */

"use client";

import Script from "next/script";

const KLAVIYO_COMPANY_ID =
  process.env.NEXT_PUBLIC_KLAVIYO_COMPANY_ID ?? "RDuzmB";

const QUEUE_SHIM = `
!function(){if(!window.klaviyo){window._klOnsite=window._klOnsite||[];try{window.klaviyo=new Proxy({},{get:function(n,i){return"push"===i?function(){var n;(n=window._klOnsite).push.apply(n,arguments)}:function(){for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)o[w]=arguments[w];var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))}));return e}}})}catch(n){window.klaviyo=window.klaviyo||[],window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}}}}();
`;

export default function Klaviyo() {
  if (!KLAVIYO_COMPANY_ID) return null;

  return (
    <>
      <script
        id="klaviyo-init"
        dangerouslySetInnerHTML={{ __html: QUEUE_SHIM }}
      />
      <Script
        id="klaviyo-onsite"
        strategy="lazyOnload"
        src={`https://static.klaviyo.com/onsite/js/${KLAVIYO_COMPANY_ID}/klaviyo.js?company_id=${KLAVIYO_COMPANY_ID}`}
      />
    </>
  );
}
