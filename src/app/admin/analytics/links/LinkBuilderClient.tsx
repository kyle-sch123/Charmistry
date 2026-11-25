/**
 * Campaign link builder: makes a correctly tagged link for a post, story,
 * email or QR code, so its visits and orders show up under Campaigns.
 *
 * It follows the Charmistry UTM convention (lowercase; month-first campaign
 * names such as 2026-12_christmas-gifting; klaviyo / email, insert / qr ...)
 * and previews "Shows as" with the same classifier the tracking uses, so the
 * channel promised here is the channel the dashboard will show. The link uses
 * this site's own address, so it is right on whichever domain the admin runs.
 * The draft survives a refresh (sessionStorage) and the last five links are
 * kept on this device (localStorage).
 */

"use client";

import { useId, useState, useSyncExternalStore } from "react";
import {
  buildCampaignUrl,
  CAMPAIGN_RE,
  campaignPrefix,
  defaultMediumFor,
  MEDIUM_PRESETS,
  slugifyTag,
  SOURCE_PRESETS,
} from "@/lib/analytics/campaign-presets";
import { classify } from "@/lib/analytics/channel";
import { IconCopy } from "../icons";
import { ui } from "../ui";
import { AnalyticsHeader } from "../components/core";

const DRAFT_KEY = "charmistry-link-draft";
const RECENT_KEY = "charmistry-link-recent";
const PATHS = ["/", "/shop", "/best-sellers", "/collections", "/collections/everyday", "/collections/daily-affair"];

interface Draft {
  path: string;
  source: string;
  otherSource: string;
  medium: string;
  campaign: string;
  content: string;
}
interface Recent {
  url: string;
  campaign: string;
  source: string;
}

function loadDraft(): Draft {
  const fallback: Draft = {
    path: "/",
    source: "instagram",
    otherSource: "",
    medium: "social",
    campaign: campaignPrefix(new Date()),
    content: "",
  };
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Draft>) } : fallback;
  } catch {
    return fallback;
  }
}

const recentListeners = new Set<() => void>();
let recentCache: { raw: string | null; list: Recent[] } = { raw: null, list: [] };
function readRecent(): Recent[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RECENT_KEY);
  } catch {
    raw = null;
  }
  if (raw === recentCache.raw) return recentCache.list;
  let list: Recent[] = [];
  try {
    list = raw ? (JSON.parse(raw) as Recent[]).slice(0, 5) : [];
  } catch {
    list = [];
  }
  recentCache = { raw, list };
  return list;
}
function subscribeRecent(cb: () => void) {
  recentListeners.add(cb);
  return () => recentListeners.delete(cb);
}
const EMPTY: Recent[] = [];
const noopSubscribe = () => () => undefined;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function LinkBuilderClient() {
  const [draft, setDraftState] = useState<Draft>(() =>
    typeof window === "undefined"
      ? { path: "/", source: "instagram", otherSource: "", medium: "social", campaign: "", content: "" }
      : loadDraft(),
  );
  const recent = useSyncExternalStore(subscribeRecent, readRecent, () => EMPTY);
  // The draft comes from this browser's storage, so render only on the client
  // (the server and the first client render then agree).
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [touched, setTouched] = useState<{ path?: boolean; campaign?: boolean }>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const ids = { path: useId(), source: useId(), other: useId(), medium: useId(), campaign: useId(), content: useId(), list: useId() };

  function setDraft(next: Partial<Draft>) {
    setDraftState((d) => {
      const merged = { ...d, ...next };
      try {
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(merged));
      } catch {
        // drafts are a convenience
      }
      return merged;
    });
  }

  const source = draft.source === "other" ? slugifyTag(draft.otherSource) : draft.source;
  const pathOk = draft.path.startsWith("/");
  const campaignOk = CAMPAIGN_RE.test(draft.campaign);
  const content = slugifyTag(draft.content);
  const ready = pathOk && campaignOk && Boolean(source);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = ready
    ? buildCampaignUrl({ origin, path: draft.path.trim(), source, medium: draft.medium, campaign: draft.campaign, content: content || null })
    : "";
  const shows = ready
    ? classify({ utmSource: source, utmMedium: draft.medium, utmCampaign: draft.campaign, clickIdType: null, referrerHost: null, inApp: null })
    : null;

  async function copy(text: string, label: string, entry?: Recent) {
    const ok = await copyText(text);
    setCopyFailed(!ok);
    if (!ok) return;
    setCopied(label);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
    if (entry) {
      const next = [entry, ...readRecent().filter((r) => r.url !== entry.url)].slice(0, 5);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      recentListeners.forEach((l) => l());
    }
  }

  if (!hydrated) return null;

  const preview = (
    <div className={`${ui.frame} mt-6`}>
      <p className={ui.legend}>Your link</p>
      {ready ? (
        <>
          <p className="break-all text-sm text-ink">{url}</p>
          {shows && (
            <p className="mt-2 text-sm text-ink-secondary">
              Shows as: {shows.channel}, {shows.source} / {shows.medium}, campaign {shows.campaign}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-tertiary">Fill in the page, source and campaign to build the link.</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={ui.btnPrimary}
          disabled={!ready}
          onClick={() => void copy(url, "main", { url, campaign: draft.campaign, source })}
        >
          <IconCopy />
          {copied === "main" ? "Copied" : "Copy link"}
        </button>
        <span role="status" aria-live="polite" className="text-[12px] text-ink-tertiary">
          {copied === "main" ? "Link copied." : ""}
        </span>
      </div>
      {copyFailed && <p className={ui.fieldError}>Couldn&apos;t copy automatically. Select the link and copy it.</p>}
    </div>
  );

  return (
    <>
      <AnalyticsHeader
        view="links"
        lede="Make a tagged link for a post, story or email, so its visits and orders show up under Campaigns."
      />
      <form className="mt-6 max-w-[40rem] space-y-5 pb-28 md:pb-0" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor={ids.path} className={ui.label}>Page</label>
          <input
            id={ids.path}
            className={ui.input}
            list={ids.list}
            value={draft.path}
            onChange={(e) => setDraft({ path: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, path: true }))}
            aria-invalid={touched.path && !pathOk ? true : undefined}
            aria-describedby={`${ids.path}-help`}
            autoComplete="off"
          />
          <datalist id={ids.list}>
            {PATHS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          {touched.path && !pathOk ? (
            <p id={`${ids.path}-help`} role="alert" className={ui.fieldError}>
              Start the page with /, like /collections/daily-affair.
            </p>
          ) : (
            <p id={`${ids.path}-help`} className={ui.help}>
              The page the link opens, like / or /products/belle-ring-gold.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label htmlFor={ids.source} className={ui.label}>Source</label>
            <select
              id={ids.source}
              className={ui.input}
              value={draft.source}
              onChange={(e) => setDraft({ source: e.target.value, medium: defaultMediumFor(e.target.value) })}
            >
              {SOURCE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.medium} className={ui.label}>Medium</label>
            <select id={ids.medium} className={ui.input} value={draft.medium} onChange={(e) => setDraft({ medium: e.target.value })}>
              {MEDIUM_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {draft.source === "other" && (
          <div>
            <label htmlFor={ids.other} className={ui.label}>Other source</label>
            <input
              id={ids.other}
              className={ui.input}
              value={draft.otherSource}
              onChange={(e) => setDraft({ otherSource: e.target.value })}
              onBlur={() => setDraft({ otherSource: slugifyTag(draft.otherSource) })}
              aria-describedby={`${ids.other}-help`}
            />
            <p id={`${ids.other}-help`} className={ui.help}>
              One word for where the link is shared, like newsletter-partner.
            </p>
          </div>
        )}

        <div>
          <label htmlFor={ids.campaign} className={ui.label}>Campaign</label>
          <input
            id={ids.campaign}
            className={ui.input}
            value={draft.campaign}
            onChange={(e) => setDraft({ campaign: e.target.value })}
            onBlur={() => {
              setDraft({ campaign: slugifyTag(draft.campaign) });
              setTouched((t) => ({ ...t, campaign: true }));
            }}
            aria-invalid={touched.campaign && !campaignOk ? true : undefined}
            aria-describedby={`${ids.campaign}-help`}
            autoComplete="off"
          />
          {touched.campaign && !campaignOk ? (
            <p id={`${ids.campaign}-help`} role="alert" className={ui.fieldError}>
              Use lowercase letters, numbers, hyphens and underscores, like 2026-12_christmas-gifting.
            </p>
          ) : (
            <p id={`${ids.campaign}-help`} className={ui.help}>
              Month then theme, like 2026-12_christmas-gifting. Use always-on_&lt;name&gt; for links that never expire.
            </p>
          )}
        </div>

        <div>
          <label htmlFor={ids.content} className={ui.label}>Content (optional)</label>
          <input
            id={ids.content}
            className={ui.input}
            value={draft.content}
            onChange={(e) => setDraft({ content: e.target.value })}
            onBlur={() => setDraft({ content: slugifyTag(draft.content) })}
            aria-describedby={`${ids.content}-help`}
            autoComplete="off"
          />
          <p id={`${ids.content}-help`} className={ui.help}>
            Where the link sits, like story_sticker or bio_link.
          </p>
        </div>

        <div className="hidden md:block">{preview}</div>

        {recent.length > 0 && (
          <div>
            <p className={ui.legend}>Recent on this device</p>
            <ul className="divide-y divide-ink/10 border border-ink/10 bg-paper-warm">
              {recent.map((r) => (
                <li key={r.url} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="min-w-0 text-sm text-ink">
                    {r.campaign}, {r.source}
                    <span className="block truncate text-[12px] text-ink-tertiary">{r.url}</span>
                  </span>
                  <button type="button" className={ui.btnSecondary} onClick={() => void copy(r.url, r.url)}>
                    {copied === r.url ? "Copied" : "Copy"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>

      {/* Narrow screens: the finished link and Copy stay in reach at the bottom. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-paper px-4 py-3 md:hidden">
        <p className="truncate text-[12px] text-ink-secondary">{ready ? url : "Fill in the page, source and campaign."}</p>
        <button
          type="button"
          className={`${ui.btnPrimary} mt-2 w-full`}
          disabled={!ready}
          onClick={() => void copy(url, "main", { url, campaign: draft.campaign, source })}
        >
          {copied === "main" ? "Copied" : "Copy link"}
        </button>
      </div>
    </>
  );
}
