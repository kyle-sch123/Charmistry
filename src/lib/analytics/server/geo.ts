/**
 * Coarse visitor location for analytics: country, and city where Cloudflare
 * provides it. Server only.
 *
 * Why only these two: the Geography section needs "where do visitors browse
 * from", not who they are. Cloudflare already resolves the country into the
 * `cf-ipcountry` header (and the city into the request's `cf` object), so the
 * IP address itself is never read or stored (POPIA data minimisation).
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface Geo {
  country: string | null;
  city: string | null;
}

const COUNTRY_RE = /^[A-Z]{2}$/;

export function readGeo(request: Request): Geo {
  const header = request.headers.get("cf-ipcountry")?.trim().toUpperCase() ?? "";
  const country =
    COUNTRY_RE.test(header) && header !== "XX" && header !== "T1" ? header : null;

  let city: string | null = null;
  try {
    // Throws outside the Workers runtime (local `next dev`, tests).
    const cf = getCloudflareContext<{ city?: unknown }>().cf;
    if (cf && typeof cf.city === "string" && cf.city.trim()) {
      city = cf.city.trim().slice(0, 80);
    }
  } catch {
    city = null;
  }
  return { country, city };
}
