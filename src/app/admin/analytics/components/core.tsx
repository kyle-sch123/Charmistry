/**
 * Shared pieces of the admin analytics pages: the admin key (read with
 * useSyncExternalStore, so no effect sets state), a small data hook with
 * abortable requests and delayed loaders, the page header with its view tabs,
 * the filter row, section frames, state panels, comparisons and definition
 * tooltips.
 *
 * The key behaves exactly like the other admin tools: stored under
 * KEY_STORAGE, sent as `x-admin-key`, and a 401 clears it and shows
 * "That key was rejected. Enter the current admin key."
 */

"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { KEY_STORAGE } from "../../catalogue/shared";
import { IconArrowDown, IconArrowUp, IconMinus, IconRefresh } from "../icons";
import { computeDelta, type DeltaKind } from "../lib/delta";
import { ago, rangeCaption } from "../lib/format";
import type { BaseFilters } from "../lib/url-state";
import { ui } from "../ui";
import type { RangeKey, ResolvedRange } from "@/lib/analytics/range";
import type { DeviceClass } from "@/lib/analytics/types";

// ---- admin key ------------------------------------------------------------

const keyListeners = new Set<() => void>();
function subscribeKey(cb: () => void) {
  keyListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    keyListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function readKey(): string | null {
  try {
    return window.localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}
const noopSubscribe = () => () => undefined;

export function useAdminKey() {
  const key = useSyncExternalStore(subscribeKey, readKey, () => null);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const setKey = useCallback((value: string | null) => {
    try {
      if (value) window.localStorage.setItem(KEY_STORAGE, value);
      else window.localStorage.removeItem(KEY_STORAGE);
    } catch {
      // private mode: the key lasts for this page only
    }
    keyListeners.forEach((l) => l());
  }, []);
  return { key, hydrated, setKey };
}

export function AdminKeyGate({ rejected, onUnlock }: { rejected: boolean; onUnlock: (key: string) => void }) {
  const [value, setValue] = useState("");
  const id = useId();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onUnlock(value.trim());
      }}
      className="mt-8 max-w-sm space-y-4"
    >
      <div>
        <label htmlFor={id} className={ui.label}>
          Admin key
        </label>
        <input
          id={id}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          autoComplete="current-password"
          aria-invalid={rejected || undefined}
          className={ui.input}
        />
        {rejected && (
          <p role="alert" className={ui.fieldError}>
            That key was rejected. Enter the current admin key.
          </p>
        )}
      </div>
      <button type="submit" disabled={!value.trim()} className={ui.btnPrimary}>
        Unlock
      </button>
    </form>
  );
}

// ---- data ------------------------------------------------------------------

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  status: number;
  /** a request is in flight for the current inputs */
  loading: boolean;
  /** that request has taken more than 100ms (show loaders) */
  slow: boolean;
  /** the data shown belongs to earlier inputs (dim it) */
  stale: boolean;
  refresh: () => void;
  completedAt: string | null;
}

/**
 * GET JSON from an admin analytics API. Aborts on input change; loaders only
 * appear after 100ms; the previous data stays on screen while refetching.
 */
export function useAdminApi<T>(url: string | null, key: string | null, onUnauthorized: () => void): ApiState<T> {
  const [nonce, setNonce] = useState(0);
  const requestId = url && key ? `${url}#${nonce}` : null;
  const [result, setResult] = useState<{
    id: string | null;
    url: string | null;
    data: T | null;
    error: string | null;
    status: number;
    at: string | null;
  }>({ id: null, url: null, data: null, error: null, status: 0, at: null });
  const [slowId, setSlowId] = useState<string | null>(null);

  useEffect(() => {
    if (!url || !key || !requestId) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => setSlowId(requestId), 100);
    fetch(url, { headers: { "x-admin-key": key }, cache: "no-store", signal: ctrl.signal })
      .then(async (res) => {
        if (res.status === 401) {
          onUnauthorized();
          return;
        }
        const body = (await res.json().catch(() => null)) as T | null;
        setResult({
          id: requestId,
          url,
          data: res.ok || res.status === 404 ? body : null,
          error: res.ok ? null : `http_${res.status}`,
          status: res.status,
          at: new Date().toISOString(),
        });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setResult({ id: requestId, url, data: null, error: "network", status: 0, at: new Date().toISOString() });
        }
      })
      .finally(() => clearTimeout(timer));
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [url, key, requestId, onUnauthorized]);

  const loading = requestId !== null && result.id !== requestId;
  return {
    data: result.data,
    error: result.id === requestId ? result.error : null,
    status: result.status,
    loading,
    slow: loading && slowId === requestId,
    stale: loading && result.data !== null,
    refresh: () => setNonce((n) => n + 1),
    completedAt: result.at,
  };
}

// ---- header ---------------------------------------------------------------

export type AnalyticsView = "overview" | "journeys" | "links";

export function AnalyticsHeader({
  view,
  lede,
  ledeDisplay = false,
  query = "",
  children,
}: {
  view: AnalyticsView | null;
  lede: ReactNode;
  ledeDisplay?: boolean;
  query?: string;
  children?: ReactNode;
}) {
  const tabs: { key: AnalyticsView; label: string; href: string }[] = [
    { key: "overview", label: "Overview", href: `/admin/analytics${query}` },
    { key: "journeys", label: "Journeys", href: `/admin/analytics/journeys${query}` },
    { key: "links", label: "Link builder", href: "/admin/analytics/links" },
  ];
  return (
    <header className="border-b border-ink/10">
      <h1 className={ui.h1}>Analytics</h1>
      <p className={ledeDisplay ? ui.ledeDisplay : ui.lede}>{lede}</p>
      {children}
      {view && (
        <nav aria-label="Analytics views" className={ui.viewTabs}>
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} aria-current={t.key === view ? "page" : undefined} className={ui.viewTab}>
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

// ---- controls --------------------------------------------------------------

export function SegmentedControl<T extends string>({
  legend,
  options,
  value,
  onChange,
  disabled = false,
}: {
  legend: string;
  options: { value: T; label: string; short?: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }
  const legendId = useId();
  return (
    <div>
      <p id={legendId} className={ui.legend}>
        {legend}
      </p>
      <div role="radiogroup" aria-labelledby={legendId} className={ui.segGroup} onKeyDown={onKey}>
        {options.map((o, i) => (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            aria-label={o.short ? o.label : undefined}
            tabIndex={o.value === value ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={ui.segItem}
          >
            {o.short ? (
              <>
                <span className="md:hidden">{o.short}</span>
                <span className="hidden md:inline">{o.label}</span>
              </>
            ) : (
              o.label
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

const RANGE_OPTIONS: { value: RangeKey; label: string; short?: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days", short: "7d" },
  { value: "30d", label: "30 days", short: "30d" },
  { value: "90d", label: "90 days", short: "90d" },
  { value: "custom", label: "Custom" },
];
const DEVICE_OPTIONS: { value: "all" | DeviceClass; label: string; short?: string }[] = [
  { value: "all", label: "All devices", short: "All" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
  { value: "desktop", label: "Desktop" },
];

function CustomRange({
  from,
  to,
  onApply,
}: {
  from: string | null;
  to: string | null;
  onApply: (from: string, to: string) => void;
}) {
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ?? "");
  const [error, setError] = useState<string | null>(null);
  const fromId = useId();
  const toId = useId();
  function apply() {
    if (!f || !t) {
      setError("Choose a start and an end date.");
      return;
    }
    if (t < f) {
      setError("Choose an end date on or after the start date.");
      return;
    }
    const days = (Date.parse(`${t}T00:00:00Z`) - Date.parse(`${f}T00:00:00Z`)) / 86_400_000 + 1;
    if (days > 366) {
      setError("Choose a range of 366 days or less.");
      return;
    }
    setError(null);
    onApply(f, t);
  }
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={fromId} className={ui.label}>
          From
        </label>
        <input id={fromId} type="date" value={f} onChange={(e) => setF(e.target.value)} className={`${ui.input} w-auto`} />
      </div>
      <div>
        <label htmlFor={toId} className={ui.label}>
          To
        </label>
        <input
          id={toId}
          type="date"
          value={t}
          onChange={(e) => setT(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={`${ui.input} w-auto`}
        />
      </div>
      <button type="button" onClick={apply} className={ui.btnSecondary}>
        Apply range
      </button>
      {error && (
        <p role="alert" className={`${ui.fieldError} w-full`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function FilterRow({
  filters,
  range,
  onChange,
  disabled = false,
  updatedAt,
  updating,
  onRefresh,
  showCompare = true,
}: {
  filters: BaseFilters;
  range: ResolvedRange | null;
  onChange: (next: Partial<BaseFilters>) => void;
  disabled?: boolean;
  updatedAt: string | null;
  updating: boolean;
  onRefresh?: () => void;
  showCompare?: boolean;
}) {
  const compareId = useId();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={`${ui.filterRow} mt-6`}>
      <SegmentedControl
        legend="Date range"
        options={RANGE_OPTIONS}
        value={filters.range}
        disabled={disabled}
        onChange={(v) => onChange(v === "custom" ? { range: v } : { range: v, from: null, to: null })}
      />
      <SegmentedControl
        legend="Device"
        options={DEVICE_OPTIONS}
        value={filters.device ?? "all"}
        disabled={disabled}
        onChange={(v) => onChange({ device: v === "all" ? null : v })}
      />
      {filters.range === "custom" && (
        <CustomRange
          from={filters.from}
          to={filters.to}
          onApply={(from, to) => onChange({ range: "custom", from, to })}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 md:flex-1">
        {showCompare && (
          <label htmlFor={compareId} className={ui.checkbox}>
            <input
              id={compareId}
              type="checkbox"
              className="size-4 accent-ink"
              checked={filters.compare}
              disabled={disabled}
              onChange={(e) => onChange({ compare: e.target.checked })}
            />
            Compare with previous period
          </label>
        )}
        {onRefresh && (
          <div className="ml-auto flex items-center gap-1 text-[12px] text-ink-tertiary">
            <span aria-live="off">{updating ? "Updating…" : updatedAt ? `Updated ${ago(updatedAt, now)}` : ""}</span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={updating || disabled}
              aria-label="Refresh data"
              className={ui.iconBtn}
            >
              <IconRefresh className={`size-4 ${updating ? "motion-safe:animate-spin" : ""}`} />
              <span role="tooltip" className={ui.tooltip}>
                Refresh data
              </span>
            </button>
          </div>
        )}
      </div>
      {range && (
        <p className={`${ui.rangeCaption} w-full md:mt-0`}>
          {rangeCaption(range.fromDate, range.toDate)}
          {showCompare && range.prevFromDate && range.prevToDate
            ? `, compared with ${rangeCaption(range.prevFromDate, range.prevToDate)}`
            : ""}
          . Times in SAST.
        </p>
      )}
    </div>
  );
}

// ---- states and frames ------------------------------------------------------

export function StatePanel({
  icon,
  title,
  body,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  body: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={ui.statePanel}>
      {icon && <div className="mx-auto flex justify-center text-ink-tertiary">{icon}</div>}
      <p className={ui.stateTitle}>{title}</p>
      <div className={ui.stateBody}>{body}</div>
      {actions && <div className={ui.stateActions}>{actions}</div>}
    </div>
  );
}

export function Delta({
  value,
  previous,
  kind,
  upIsGood = true,
}: {
  value: number;
  previous: number | null;
  kind: DeltaKind;
  upIsGood?: boolean;
}) {
  const d = computeDelta(value, previous, kind, upIsGood);
  if (d.direction === "none") return <span className={ui.deltaFlat}>No comparison</span>;
  const cls = d.tone === "good" ? ui.deltaGood : d.tone === "bad" ? ui.deltaBad : ui.deltaFlat;
  const Icon = d.direction === "up" ? IconArrowUp : d.direction === "down" ? IconArrowDown : IconMinus;
  return (
    <span className={cls}>
      <Icon className="size-3" />
      <span aria-hidden>{d.text.replace(/^[▲▼—]\s*/, "")}</span>
      <span className="sr-only">{d.sr}</span>
    </span>
  );
}

/** A term with a definition: tooltip on hover and focus, toggled by tap. */
export function DefinitionTip({ term, definition }: { term: string; definition: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={id}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="group cursor-help text-left underline decoration-ink/30 decoration-dotted underline-offset-4"
      >
        {term}
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute left-0 top-full z-30 mt-1 w-64 bg-ink px-3 py-2 text-[12px] font-normal normal-case tracking-normal text-paper group-hover:block group-focus-visible:block ${open ? "block" : "hidden"}`}
        >
          {definition}
        </span>
      </button>
    </span>
  );
}

/** Trailing marker for a rate with fewer than 30 sessions (or views) behind it. */
export function SmallSample({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <>
      <span aria-hidden>*</span>
      <span className="sr-only"> (small sample)</span>
    </>
  );
}

export function SectionFrame({
  id,
  title,
  description,
  actions,
  srTitle = false,
  busy = false,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  srTitle?: boolean;
  busy?: boolean;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} aria-busy={busy || undefined} className={ui.section}>
      {srTitle ? (
        <h2 id={headingId} className="sr-only">
          {title}
        </h2>
      ) : (
        <div className={ui.sectionHead}>
          <div>
            <h2 id={headingId} className={ui.h2}>
              {title}
            </h2>
            {description && <p className={ui.sectionDesc}>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={busy ? ui.refetching : undefined}>{children}</div>
    </section>
  );
}

export function SectionError({ what, onRetry, details }: { what: string; onRetry: () => void; details: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={ui.frame}>
      <StatePanel
        title={`Couldn't load ${what}.`}
        body="Check the connection and try again."
        actions={
          <>
            <button type="button" onClick={onRetry} className={ui.btnPrimary}>
              Try again
            </button>
            <button
              type="button"
              className={ui.btnSecondary}
              onClick={() => {
                void navigator.clipboard?.writeText(details).then(() => setCopied(true), () => undefined);
              }}
            >
              {copied ? "Copied" : "Copy error details"}
            </button>
          </>
        }
      />
    </div>
  );
}

export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={`${ui.skel} ${className}`} />;
}
