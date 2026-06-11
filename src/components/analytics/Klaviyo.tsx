/**
 * Injects the Klaviyo onsite tracking script for client-side tracking and
 * engagement (signup forms, web tracking, etc). Renders null when the
 * company ID is unset.
 *
 * Server-side marketing events ("Placed Order") are emitted separately via
 * src/lib/klaviyo.ts from the PayFast ITN handler.
 */

"use client";

import Script from "next/script";

const KLAVIYO_COMPANY_ID =
  process.env.NEXT_PUBLIC_KLAVIYO_COMPANY_ID ?? "RDuzmB";

export default function Klaviyo() {
  if (!KLAVIYO_COMPANY_ID) return null;

  return (
    <>
      <Script
        id="klaviyo-onsite"
        strategy="afterInteractive"
        src={`https://static.klaviyo.com/onsite/js/${KLAVIYO_COMPANY_ID}/klaviyo.js?company_id=${KLAVIYO_COMPANY_ID}`}
      />
      <Script id="klaviyo-init" strategy="afterInteractive">
        {`
          !function(){if(!window.klaviyo){window._klOnsite=window._klOnsite||[];try{window.klaviyo=new Proxy({},{get:function(n,i){return"push"===i?function(){var n;(n=window._klOnsite).push.apply(n,arguments)}:function(){for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)o[w]=arguments[w];var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))}));return e}}})}catch(n){window.klaviyo=window.klaviyo||[],window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}}}}();
        `}
      </Script>
    </>
  );
}
