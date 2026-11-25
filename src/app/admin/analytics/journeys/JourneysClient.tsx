/**
 * Journeys: every visit to the shop, newest first, filterable by outcome,
 * channel, campaign and funnel step, or found by order number or email (a
 * search looks across all dates). Each visit opens its full timeline.
 *
 * Narrow screens get a card list; from 768px a table. Filters sit in a
 * native <dialog> slide-over (focus is trapped and returned by the browser).
 */

"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import type { JourneysResponse } from "@/lib/analytics/api";
import { FUNNEL_STEPS, type FunnelStepKey } from "@/lib/analytics/events";
import type { JourneyRowRaw } from "@/lib/analytics/rpc";
import { IconChevronLeft, IconChevronRight, IconClose, IconDatabase, IconFilter, IconSearch } from "../icons";
import { count, dateTime, duration, money, orderRef } from "../lib/format";
import { apiQuery, readJourneys, toQuery, type JourneyFilters, type Outcome } from "../lib/url-state";
import { ui } from "../ui";
import { FUNNEL_LABELS } from "../components/charts";
import { AdminKeyGate, AnalyticsHeader, FilterRow, StatePanel, useAdminApi, useAdminKey } from "../components/core";

const OUTCOME_LABEL: Record<Outcome, string> = {
  any: "Any outcome",
  paid: "Purchased",
  bag: "Added to bag",
  browsed: "Browsed",
};

export function OutcomeBadge({ row }: { row: Pick<JourneyRowRaw, "outcome" | "paid_total" | "bag_value"> }) {
  if (row.outcome === "paid") {
    return <span className={`${ui.badge} ${ui.badgePaid}`}>Paid {money(row.paid_total)}</span>;
  }
  if (row.outcome === "bag") {
    return <span className={`${ui.badge} ${ui.badgeBag}`}>Bag {money(row.bag_value)} · abandoned</span>;
  }
  return <span className={`${ui.badge} ${ui.badgeBrowsed}`}>Browsed</span>;
}

export function visitorName(row: { customer_name: string | null; visitor_tag: string }) {
  return row.customer_name ?? `Visitor · ${row.visitor_tag}`;
}

export default function JourneysClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useMemo(() => readJourneys(params), [params]);
  const { key, hydrated, setKey } = useAdminKey();
  const [rejected, setRejected] = useState(false);
  const [q, setQ] = useState(filters.q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const filtersBtnRef = useRef<HTMLButtonElement>(null);
  const searchId = useId();

  const onUnauthorized = useCallback(() => {
    setKey(null);
    setRejected(true);
  }, [setKey]);
  const api = useAdminApi<JourneysResponse>(
    key ? `/api/admin/analytics/journeys${apiQuery(filters)}` : null,
    key,
    onUnauthorized,
  );

  const setFilters = useCallback(
    (next: Partial<JourneyFilters>) => {
      const merged = { ...filters, ...next };
      if (!("page" in next)) merged.page = 1;
      router.replace(`${pathname}${toQuery(merged)}`, { scroll: false });
    },
    [router, pathname, filters],
  );

  // "/" focuses search (not while typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!hydrated) return null;
  const lede = "Every visit to the shop, newest first. Open one to see the path it took.";
  const query = toQuery({ range: filters.range, from: filters.from, to: filters.to, device: filters.device, compare: filters.compare });
  if (!key) {
    return (
      <>
        <AnalyticsHeader view={null} lede={lede} />
        <AdminKeyGate rejected={rejected} onUnlock={(k) => { setRejected(false); setKey(k); }} />
      </>
    );
  }

  const data = api.data;
  const ok = data && data.status === "ok" ? data : null;
  const setup = data && data.status === "setup_required";
  const totalPages = ok ? Math.max(1, Math.ceil(ok.total / ok.pageSize)) : 1;

  const chips: { label: string; clear: Partial<JourneyFilters> }[] = [];
  if (filters.q) chips.push({ label: `Search: ${filters.q}`, clear: { q: null } });
  if (filters.outcome !== "any") chips.push({ label: `Outcome: ${OUTCOME_LABEL[filters.outcome]}`, clear: { outcome: "any" } });
  if (filters.channel) chips.push({ label: `Channel: ${filters.channel}`, clear: { channel: null } });
  if (filters.campaign) chips.push({ label: `Campaign: ${filters.campaign}`, clear: { campaign: null } });
  if (filters.step) chips.push({ label: `Reached: ${FUNNEL_LABELS[filters.step]}`, clear: { step: null } });
  const activeCount = chips.length - (filters.q ? 1 : 0);
  const detailHref = (id: string) => `/admin/analytics/journeys/${id}${query}`;

  return (
    <>
      <AnalyticsHeader view="journeys" lede={lede} query={query} />
      <FilterRow
        filters={filters}
        range={ok?.range ?? null}
        onChange={(next) => setFilters(next)}
        disabled={Boolean(setup) || Boolean(filters.q)}
        updatedAt={api.completedAt}
        updating={api.loading}
        onRefresh={api.refresh}
        showCompare={false}
      />

      {setup ? (
        <div className="mt-8">
          <StatePanel
            icon={<IconDatabase className="size-6" />}
            title="Analytics isn't set up yet."
            body="The analytics tables haven't been added to the database yet, so nothing is being recorded. Ask your developer to apply the analytics database migration, then check again."
            actions={<button type="button" onClick={api.refresh} className={ui.btnPrimary}>Check again</button>}
          />
        </div>
      ) : (
        <>
          <form
            role="search"
            className="mt-6 flex items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters({ q: q.trim() || null });
            }}
          >
            <div className="relative flex-1">
              <label htmlFor={searchId} className={ui.label}>
                Search
              </label>
              <div className="relative">
                <IconSearch className={ui.searchIcon} />
                <input
                  id={searchId}
                  ref={searchRef}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="#ABCD1234 or name@example.com"
                  className={`${ui.input} pl-9`}
                />
              </div>
            </div>
            <button
              ref={filtersBtnRef}
              type="button"
              className={ui.btnSecondary}
              onClick={() => sheetRef.current?.showModal()}
            >
              <IconFilter />
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
          </form>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={ui.activeChip}
                  aria-label={`Remove filter: ${c.label}`}
                  onClick={() => {
                    if ("q" in c.clear) setQ("");
                    setFilters(c.clear);
                  }}
                >
                  {c.label}
                  <IconClose className="size-3.5" />
                </button>
              ))}
              <button
                type="button"
                className={ui.textBtn}
                onClick={() => {
                  setQ("");
                  setFilters({ q: null, outcome: "any", channel: null, campaign: null, step: null });
                }}
              >
                Clear all
              </button>
            </div>
          )}

          <div className={`mt-4 ${api.stale ? ui.refetching : ""}`} aria-busy={api.loading || undefined}>
            {api.error && !ok ? (
              <StatePanel
                title="Couldn't load the visits."
                body="Check the connection and try again."
                actions={<button type="button" onClick={api.refresh} className={ui.btnPrimary}>Try again</button>}
              />
            ) : !ok ? (
              api.slow ? <p className="text-sm text-ink-tertiary">Loading visits…</p> : null
            ) : ok.total === 0 ? (
              filters.q ? (
                <StatePanel
                  title={`No sessions found for ${filters.q}.`}
                  body="Check the order number, or search by the customer's email instead."
                  actions={<button type="button" className={ui.btnSecondary} onClick={() => { setQ(""); setFilters({ q: null }); }}>Clear search</button>}
                />
              ) : (
                <StatePanel
                  title="No sessions match these filters."
                  body="Try a longer date range or remove a filter."
                  actions={<button type="button" className={ui.btnSecondary} onClick={() => setFilters({ outcome: "any", channel: null, campaign: null, step: null })}>Clear all filters</button>}
                />
              )
            ) : (
              <>
                <p className="mb-2 text-sm text-ink-secondary" aria-live="polite">
                  {count(ok.total)} {ok.total === 1 ? "session" : "sessions"}
                  {filters.q ? " for this customer, across all dates" : ""}
                </p>
                <ul className={ui.stackList}>
                  {ok.rows.map((r) => (
                    <li key={r.session_id} className="relative px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Link href={detailHref(r.session_id)} className="text-sm font-medium text-ink after:absolute after:inset-0">
                          {visitorName(r)}
                        </Link>
                        <OutcomeBadge row={r} />
                      </div>
                      <p className="mt-1 text-sm text-ink-secondary">
                        {r.channel}, {r.source} / {r.medium}
                        {r.inferred ? " (inferred)" : ""}
                      </p>
                      {r.campaign && <p className="text-sm text-ink-secondary">{r.campaign}</p>}
                      <p className="mt-1 text-[12px] text-ink-tertiary break-all">
                        {dateTime(r.started_at)}, {r.landing_path}
                      </p>
                      <p className="flex items-center justify-between text-[12px] text-ink-tertiary">
                        {count(r.pages)} {r.pages === 1 ? "page" : "pages"}, {duration(r.engaged_ms)} engaged
                        <IconChevronRight className="size-4" />
                      </p>
                    </li>
                  ))}
                </ul>
                <div className={`hidden md:block ${ui.tableRegion}`} role="region" tabIndex={0} aria-label="Visits">
                  <table className={ui.table}>
                    <caption className="sr-only">Visits, newest first</caption>
                    <thead>
                      <tr>
                        <th scope="col" className={ui.th}>Started</th>
                        <th scope="col" className={ui.th}>Visitor</th>
                        <th scope="col" className={ui.th}>Source</th>
                        <th scope="col" className={`${ui.th} hidden xl:table-cell`}>Landing</th>
                        <th scope="col" className={ui.thNum}>Pages</th>
                        <th scope="col" className={ui.thNum}>Engaged</th>
                        <th scope="col" className={ui.th}>Outcome</th>
                      </tr>
                    </thead>
                    <tbody className={ui.tbody}>
                      {ok.rows.map((r) => (
                        <tr key={r.session_id} className="relative hover:bg-ink/[0.03]">
                          <td className={`${ui.td} whitespace-nowrap tabular-nums`}>{dateTime(r.started_at)}</td>
                          <td className={ui.td}>
                            <Link href={detailHref(r.session_id)} className="font-medium after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-ink">
                              {visitorName(r)}
                            </Link>
                            {r.order_short_id && (
                              <span className="block text-[12px] text-ink-tertiary">{orderRef(r.order_short_id)}</span>
                            )}
                          </td>
                          <td className={ui.td}>
                            {r.channel}
                            <span className="block text-[12px] text-ink-tertiary">
                              {r.source} / {r.medium}
                              {r.inferred ? " (inferred)" : ""}
                              {r.campaign ? `, ${r.campaign}` : ""}
                            </span>
                            <span className="block text-[12px] text-ink-tertiary break-all xl:hidden">{r.landing_path}</span>
                          </td>
                          <td className={`${ui.td} hidden break-all xl:table-cell`}>{r.landing_path}</td>
                          <td className={ui.tdNum}>{count(r.pages)}</td>
                          <td className={ui.tdNum}>{duration(r.engaged_ms)}</td>
                          <td className={ui.td}>
                            <span className="flex items-center justify-between gap-2">
                              <OutcomeBadge row={r} />
                              <IconChevronRight className="size-4 text-ink-tertiary" />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <nav aria-label="Pages" className={ui.pager}>
                  <button
                    type="button"
                    className={ui.pagerBtn}
                    disabled={filters.page <= 1}
                    onClick={() => setFilters({ page: filters.page - 1 })}
                  >
                    <IconChevronLeft /> Previous
                  </button>
                  <span className="text-sm text-ink-secondary">
                    Page {count(filters.page)} of {count(totalPages)}
                  </span>
                  <button
                    type="button"
                    className={ui.pagerBtn}
                    disabled={filters.page >= totalPages}
                    onClick={() => setFilters({ page: filters.page + 1 })}
                  >
                    Next <IconChevronRight />
                  </button>
                </nav>
              </>
            )}
          </div>

          <FiltersSheet
            key={toQuery(filters)}
            sheetRef={sheetRef}
            filters={filters}
            facets={ok?.facets ?? { channels: [], campaigns: [] }}
            total={ok?.total ?? null}
            onApply={(next) => {
              sheetRef.current?.close();
              setFilters(next);
              filtersBtnRef.current?.focus();
            }}
            onClose={() => filtersBtnRef.current?.focus()}
          />
        </>
      )}
    </>
  );
}

function FiltersSheet({
  sheetRef,
  filters,
  facets,
  total,
  onApply,
  onClose,
}: {
  sheetRef: RefObject<HTMLDialogElement | null>;
  filters: JourneyFilters;
  facets: { channels: string[]; campaigns: string[] };
  total: number | null;
  onApply: (next: Partial<JourneyFilters>) => void;
  onClose: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome>(filters.outcome);
  const [channel, setChannel] = useState(filters.channel ?? "");
  const [campaign, setCampaign] = useState(filters.campaign ?? "");
  const [step, setStep] = useState<FunnelStepKey | "">(filters.step ?? "");
  const ids = { o: useId(), ch: useId(), ca: useId(), st: useId(), title: useId() };
  return (
    <dialog
      ref={sheetRef}
      aria-labelledby={ids.title}
      className={ui.sheet}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) sheetRef.current?.close();
      }}
    >
      <div className="flex min-h-full flex-col">
        <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
          <h2 id={ids.title} className={ui.h2}>
            Filters
          </h2>
          <button type="button" aria-label="Close filters" className={ui.iconBtn} onClick={() => sheetRef.current?.close()}>
            <IconClose />
            <span role="tooltip" className={ui.tooltip}>Close filters</span>
          </button>
        </div>
        <div className="flex-1 space-y-5 px-4 py-5">
          <div>
            <label htmlFor={ids.o} className={ui.label}>Outcome</label>
            <select id={ids.o} className={ui.input} value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
              {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
                <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.ch} className={ui.label}>Channel</label>
            <select id={ids.ch} className={ui.input} value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">Any channel</option>
              {Array.from(new Set([...facets.channels, ...(filters.channel ? [filters.channel] : [])])).sort().map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.ca} className={ui.label}>Campaign</label>
            <select id={ids.ca} className={ui.input} value={campaign} onChange={(e) => setCampaign(e.target.value)}>
              <option value="">Any campaign</option>
              {Array.from(new Set([...facets.campaigns, ...(filters.campaign ? [filters.campaign] : [])])).sort().map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.st} className={ui.label}>Reached step</label>
            <select id={ids.st} className={ui.input} value={step} onChange={(e) => setStep(e.target.value as FunnelStepKey | "")}>
              <option value="">Any step</option>
              {FUNNEL_STEPS.slice(1).map((s) => (
                <option key={s} value={s}>{FUNNEL_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={ui.sheetFoot}>
          <button
            type="button"
            className={ui.textBtn}
            onClick={() => {
              setOutcome("any");
              setChannel("");
              setCampaign("");
              setStep("");
            }}
          >
            Clear all
          </button>
          <button
            type="button"
            className={ui.btnPrimary}
            onClick={() =>
              onApply({ outcome, channel: channel || null, campaign: campaign || null, step: step || null })
            }
          >
            {total !== null ? "Show sessions" : "Apply filters"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
