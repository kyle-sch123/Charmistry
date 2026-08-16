/**
 * Instagram feed for the "As Seen On You" section — the latest posts from
 * @charmistry_za, fetched server-side and cached for an hour.
 *
 * Two sources, checked in order, so the section works with whichever
 * integration Kyle sets up (and degrades to placeholders with neither):
 *
 *   1. INSTAGRAM_FEED_URL — a managed feed JSON URL (e.g. Behold.so). The
 *      recommended route: the service owns the Instagram token and its 60-day
 *      refresh dance; we just read a stable JSON endpoint.
 *   2. INSTAGRAM_ACCESS_TOKEN — a long-lived Instagram API token, hitting
 *      graph.instagram.com directly. Zero third parties, but the token
 *      expires every 60 days unless refreshed.
 *
 * Any failure returns [] — the storefront must never break because a social
 * feed is down. The component renders placeholder tiles on [].
 */

export interface InstagramPost {
  id: string;
  /** Direct image URL (CDN-hosted by Instagram or the feed service). */
  image: string;
  /** Link to the post on instagram.com. */
  permalink: string;
  caption?: string;
}

export const INSTAGRAM_HANDLE = "charmistry_za";
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}`;

const REVALIDATE_SECONDS = 3600;

type UnknownRecord = Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

/** Map one raw item (Graph API or feed-service shape) to an InstagramPost. */
function toPost(raw: UnknownRecord): InstagramPost | null {
  const mediaType = str(raw.media_type) ?? str(raw.mediaType);
  // Videos carry their poster frame in thumbnail_url; images carry media_url.
  const image =
    mediaType === "VIDEO"
      ? (str(raw.thumbnail_url) ?? str(raw.thumbnailUrl))
      : (str(raw.media_url) ??
        str(raw.mediaUrl) ??
        str(raw.image) ??
        str(raw.thumbnail_url) ??
        str(raw.thumbnailUrl));
  const permalink = str(raw.permalink) ?? str(raw.link);
  const id = str(raw.id) ?? permalink;
  if (!image || !permalink || !id) return null;
  return {
    id,
    image,
    permalink,
    caption: str(raw.caption) ?? undefined,
  };
}

function extractItems(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) return payload as UnknownRecord[];
  if (payload && typeof payload === "object") {
    const obj = payload as UnknownRecord;
    for (const key of ["data", "posts", "media", "items"]) {
      if (Array.isArray(obj[key])) return obj[key] as UnknownRecord[];
    }
  }
  return [];
}

/** Latest posts, newest first, capped at `limit`. [] on any failure. */
export async function getInstagramPosts(limit = 4): Promise<InstagramPost[]> {
  const feedUrl = process.env.INSTAGRAM_FEED_URL;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  let url: string | null = null;
  if (feedUrl) {
    url = feedUrl;
  } else if (token) {
    const fields = "id,media_type,media_url,thumbnail_url,permalink,caption";
    url = `https://graph.instagram.com/me/media?fields=${fields}&limit=${limit * 3}&access_token=${token}`;
  }
  if (!url) return [];

  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) {
      console.error(`Instagram feed responded ${res.status}`);
      return [];
    }
    const payload = (await res.json()) as unknown;
    return extractItems(payload)
      .map(toPost)
      .filter((p): p is InstagramPost => p !== null)
      .slice(0, limit);
  } catch (err) {
    console.error("Instagram feed fetch failed", err);
    return [];
  }
}
