/**
 * Injects the Meta (Facebook) Pixel base code and fires a PageView on every
 * client-side route change. Renders null when NEXT_PUBLIC_FB_PIXEL_ID is unset.
 *
 * The base snippet is rendered as a REGULAR inline <script> (not next/script)
 * deliberately: client components are server-rendered, so the snippet lands in
 * the initial HTML payload and executes before hydration. next/script's
 * afterInteractive strategy injects it only after hydration, which (a) delayed
 * the first PageView and (b) made Meta's "scan website for pixel" checker —
 * which parses the raw HTML, not the hydrated page — report that no pixel was
 * installed. The snippet is idempotent (`if(f.fbq)return`), so running twice
 * is harmless.
 */

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { FB_PIXEL_ID, pageview } from "@/lib/fpixel";

const BASE_SNIPPET = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${FB_PIXEL_ID}');
fbq('track', 'PageView');
`;

export default function MetaPixel() {
  const pathname = usePathname();
  const mounted = useRef(false);

  useEffect(() => {
    if (!FB_PIXEL_ID) return;
    // The base snippet already tracks the first PageView on load; only fire on
    // subsequent client-side navigations.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    pageview();
  }, [pathname]);

  if (!FB_PIXEL_ID) return null;

  return (
    <>
      <script
        id="fb-pixel"
        dangerouslySetInnerHTML={{ __html: BASE_SNIPPET }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
