"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { GA_TRACKING_ID, pageview } from "@/lib/gtag";

const scriptSrc = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;

export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!GA_TRACKING_ID) return;
    pageview(pathname);
  }, [pathname]);

  if (!GA_TRACKING_ID) return null;

  return (
    <>
      <Script src={scriptSrc} strategy="afterInteractive" id="ga-script" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || function(){dataLayer.push(arguments);};
          gtag('js', new Date());
          gtag('config', '${GA_TRACKING_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
