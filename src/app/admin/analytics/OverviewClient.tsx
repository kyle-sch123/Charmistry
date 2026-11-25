/**
 * The analytics overview: one date range and device filter for every
 * section, so all the numbers on the page agree.
 *
 * Data comes from /api/admin/analytics/overview (one request, one database
 * call per section) and, in parallel, /api/admin/analytics/integrations for
 * the Tracking section. Filters live in the URL. Before migration 014 is
 * applied the page shows "Analytics isn't set up yet" instead of an error.
 */

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IntegrationsResponse, OverviewResponse, OverviewOk } from "@/lib/analytics/api";
import type { FunnelStepKey } from "@/lib/analytics/events";
import { SMALL_SAMPLE_SESSIONS } from "@/lib/analytics/types";
import { IconAlert, IconDatabase } from "./icons";
import { count, dateTime, duration, money, percent } from "./lib/format";
import { apiQuery, readBase, toQuery, type BaseFilters } from "./lib/url-state";
import { ui } from "./ui";
import { FunnelChart, KpiStrip, TrafficCharts, ViewAsTable, type KpiTileDef } from "./components/charts";
import {
  AdminKeyGate,
  AnalyticsHeader,
  Delta,
  FilterRow,
  SectionFrame,
  Skeleton,
  SmallSample,
  StatePanel,
  useAdminApi,
  useAdminKey,
} from "./components/core";
import {
  Acquisition,
  Devices,
  Geography,
  Pages,
  Products,
  Promotions,
  Search,
  SectionBody,
  Tracking,
  trackingRows,
  When,
  ZeroForFilters,
} from "./components/sections";

const SECTIONS = [
  ["summary", "Summary"],
  ["funnel", "Funnel"],
  ["traffic", "Traffic"],
  ["acquisition", "Acquisition"],
  ["products", "Products"],
  ["promotions", "Promotions"],
  ["devices", "Devices"],
  ["pages", "Pages"],
  ["search", "Search"],
  ["when", "When"],
  ["geography", "Geography"],
  ["tracking", "Tracking"],
] as const;
type SectionKey = (typeof SECTIONS)[number][0];

function lede(data: OverviewOk | null, filters: BaseFilters): string {
  if (!data || !data.sections.summary.ok) return "How people find the shop, what they look at and what they buy.";
  const s = data.sections.summary.data;
  const visitors = data.sections.traffic.ok ? data.sections.traffic.data.engagement.uniqueVisitors.value : s.sessions.value;
  const period =
    filters.range === "today"
      ? "Today so far"
      : filters.range === "custom"
        ? "In this range"
        : `In the last ${filters.range === "7d" ? 7 : filters.range === "90d" ? 90 : 30} days`;
  const prefix = filters.device ? `On ${filters.device}, ${period.charAt(0).toLowerCase()}${period.slice(1)}` : period;
  const people = `${count(visitors)} ${visitors === 1 ? "person" : "people"}`;
  if (s.orders.value === 0) {
    return `${prefix}, ${people} visited. No orders have been paid yet.`;
  }
  const verb = filters.range === "today" ? "have visited and" : "visited and";
  return `${prefix}, ${people} ${verb} ${count(s.orders.value)} ${s.orders.value === 1 ? "order was" : "orders were"} paid, bringing in ${money(s.revenue.value)}.`;
}

export default function OverviewClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useMemo(() => readBase(params), [params]);
  const { key, hydrated, setKey } = useAdminKey();
  const [rejected, setRejected] = useState(false);
  const [showTable, setShowTable] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<SectionKey>("summary");
  const [freshIntegrations, setFreshIntegrations] = useState(0);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const onUnauthorized = useCallback(() => {
    setKey(null);
    setRejected(true);
  }, [setKey]);

  const overview = useAdminApi<OverviewResponse>(
    key ? `/api/admin/analytics/overview${apiQuery(filters)}` : null,
    key,
    onUnauthorized,
  );
  const integrations = useAdminApi<IntegrationsResponse>(
    key ? `/api/admin/analytics/integrations${apiQuery(filters, freshIntegrations ? { fresh: "1", n: String(freshIntegrations) } : {})}` : null,
    key,
    onUnauthorized,
  );

  const setFilters = useCallback(
    (next: Partial<BaseFilters>) => {
      router.replace(`${pathname}${toQuery({ ...filters, ...next })}`, { scroll: false });
    },
    [router, pathname, filters],
  );

  // Highlight the section in view in the chip bar / rail.
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;
    // The active section is the last one whose top has passed just below the
    // sticky filters; observers only tell us when to re-check.
    const pick = () => {
      let current: SectionKey = SECTIONS[0][0];
      for (const el of els) {
        if (el.getBoundingClientRect().top <= 140) current = el.id as SectionKey;
      }
      setActive(current);
    };
    const io = new IntersectionObserver(pick, { rootMargin: "0px 0px -50% 0px", threshold: [0, 1] });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [overview.data]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Keep the active chip visible in the horizontally scrolling chip bar
  // (scrolls the bar only, never the page).
  const chipNav = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = chipNav.current;
    const chip = nav?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!nav || !chip) return;
    const left = chip.offsetLeft - nav.offsetLeft - 16;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nav.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  const body = overview.data;
  const ok = body && body.status === "ok" ? body : null;
  const setup = body && body.status === "setup_required" ? body : null;
  const health = ok?.health;
  const firstRun = health?.ok && !health.data.ever;
  const lastAt = health?.ok && health.data.last_at ? Date.parse(health.data.last_at) : NaN;
  const stale = health?.ok && health.data.ever && Number.isFinite(lastAt) && now - lastAt > 86_400_000;
  const tracking = trackingRows(health, integrations.data?.integrations ?? null, now);
  const issues = tracking.filter((r) => r.tone === "limited" || r.tone === "bad").length;
  const journeysQuery = (extra: { step?: FunnelStepKey; channel?: string; campaign?: string }) =>
    `/admin/analytics/journeys${toQuery({ ...filters, ...extra })}`;
  const retry = overview.refresh;
  const toggle = (k: string) => setShowTable((s) => ({ ...s, [k]: !s[k] }));
  const sessionsTotal = ok?.sections.summary.ok ? ok.sections.summary.data.sessions.value : 0;
  const zero = ok && sessionsTotal === 0 && !firstRun;
  const zeroPanel = (
    <div className={ui.frame}>
      <ZeroForFilters
        device={filters.device}
        onAllDevices={() => setFilters({ device: null })}
        onLast30={() => setFilters({ range: "30d", from: null, to: null })}
      />
    </div>
  );

  if (!hydrated) return null;

  const header = (
    <AnalyticsHeader view={key ? "overview" : null} lede={lede(ok, filters)} ledeDisplay query={toQuery(filters)} />
  );

  if (!key) {
    return (
      <>
        {header}
        <AdminKeyGate
          rejected={rejected}
          onUnlock={(k) => {
            setRejected(false);
            setKey(k);
          }}
        />
      </>
    );
  }

  const nav = (variant: "chips" | "rail") =>
    SECTIONS.map(([id, label]) => (
      <a
        key={id}
        href={`#${id}`}
        aria-current={active === id ? "location" : undefined}
        className={variant === "chips" ? ui.chip : ui.railItem}
        onClick={(e) => {
          e.preventDefault();
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
          setActive(id);
        }}
      >
        {id === "tracking" && issues > 0 ? `Tracking (${issues} ${issues === 1 ? "issue" : "issues"})` : label}
      </a>
    ));

  const filterRow = (
    <FilterRow
      filters={filters}
      range={ok?.range ?? null}
      onChange={setFilters}
      disabled={Boolean(setup)}
      updatedAt={overview.completedAt}
      updating={overview.loading}
      onRefresh={() => {
        overview.refresh();
        setFreshIntegrations((n) => n + 1);
      }}
    />
  );

  return (
    <>
      {header}
      {filterRow}

      {setup ? (
        <div className="mt-8">
          <StatePanel
            icon={<IconDatabase className="size-6" />}
            title="Analytics isn't set up yet."
            body="The analytics tables haven't been added to the database yet, so nothing is being recorded. Ask your developer to apply the analytics database migration, then check again."
            actions={
              <>
                <button type="button" onClick={retry} className={ui.btnPrimary}>
                  Check again
                </button>
                <button
                  type="button"
                  className={ui.btnSecondary}
                  onClick={() => {
                    const details = `Migration: ${setup.migration}\nMissing: ${setup.missing.join(", ")}\nChecked: ${new Date().toISOString()}`;
                    void navigator.clipboard?.writeText(details).then(() => setCopied(true), () => undefined);
                  }}
                >
                  {copied ? "Copied" : "Copy setup details"}
                </button>
              </>
            }
          />
        </div>
      ) : overview.error && !ok ? (
        <div className="mt-8">
          <StatePanel
            title="Couldn't load the analytics."
            body="Check the connection and try again."
            actions={
              <button type="button" onClick={retry} className={ui.btnPrimary}>
                Try again
              </button>
            }
          />
        </div>
      ) : !ok ? (
        <div className="mt-8 space-y-6" aria-busy>
          <span className="sr-only">Loading analytics…</span>
          {overview.slow && (
            <>
              <div className={`${ui.kpiGrid}`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className={ui.kpiTile}>
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="mt-3 h-7 w-28" />
                    <Skeleton className="mt-2 h-3 w-16" />
                    <Skeleton className="mt-3 h-6 w-full" />
                  </div>
                ))}
              </div>
              <div className={ui.frame}>
                {[100, 70, 45, 30, 20, 12, 8].map((w) => (
                  <div key={w} className="py-3">
                    <Skeleton className="h-3.5 w-32" />
                    <div className={`${ui.skel} mt-2 h-3`} style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : firstRun ? (
        <div className="mt-8">
          <StatePanel
            title="No visits recorded yet."
            body="Visits appear here a few minutes after someone browses the shop."
            actions={
              <>
                <button type="button" onClick={retry} className={ui.btnPrimary}>
                  Check again
                </button>
                <a href="/" target="_blank" rel="noopener" className={ui.btnSecondary}>
                  Open the shop
                </a>
              </>
            }
          />
          <div className="mt-12">
            <SectionFrame id="tracking" title="Tracking" description="Whether each tracking connection is working.">
              <Tracking rows={tracking} loading={integrations.loading} />
            </SectionFrame>
          </div>
        </div>
      ) : (
        <>
          <div className={`${ui.chipBar} mt-4`}>
            <nav ref={chipNav} aria-label="Sections on this page" className={ui.chipList}>
              {nav("chips")}
            </nav>
          </div>
          <div className="mt-8 xl:grid xl:grid-cols-[11rem_minmax(0,1fr)] xl:gap-10">
            <aside className={ui.rail}>
              <div className={ui.railInner}>
                <p className={ui.legend}>On this page</p>
                <nav aria-label="Sections on this page" className={`${ui.railList} flex flex-col`}>
                  {nav("rail")}
                </nav>
              </div>
            </aside>
            <div className={`min-w-0 space-y-12 md:space-y-16 ${overview.stale ? ui.refetching : ""}`} aria-busy={overview.loading || undefined}>
              {stale && health?.ok && health.data.last_at && (
                <div role="status" className={ui.bannerWarn}>
                  <IconAlert className="mt-0.5 size-4 shrink-0" />
                  <p>
                    No visits recorded since {dateTime(health.data.last_at)}. Figures after that time are incomplete.{" "}
                    <a href="#tracking" className="underline underline-offset-4">
                      See tracking health
                    </a>
                  </p>
                </div>
              )}

              <SectionFrame id="summary" title="Summary" srTitle>
                <SectionBody result={ok.sections.summary} what="the summary" onRetry={retry}>
                  {(s) => {
                    const tiles: KpiTileDef[] = [
                      { label: "Revenue", definition: "The total of orders paid in this period, after discounts. The same as the order totals customers paid.", kpi: s.revenue, kind: "money", format: money },
                      { label: "Orders", definition: "Orders paid in this period. Unpaid and cancelled orders aren't counted.", kpi: s.orders, kind: "count", format: count },
                      { label: "Conversion rate", definition: "Paid orders from these visits, divided by visits.", kpi: s.conversionRate, kind: "rate", format: (v) => percent(v), rate: true },
                      { label: "Avg order value", definition: "Revenue divided by paid orders.", kpi: s.aov, kind: "money", format: money },
                      { label: "Sessions", definition: "Visits. A visit ends after 30 minutes without activity.", kpi: s.sessions, kind: "count", format: count },
                    ];
                    return (
                      <>
                        <KpiStrip tiles={tiles} compare={filters.compare} />
                        {s.sessions.value > 0 && s.sessions.value < SMALL_SAMPLE_SESSIONS && (
                          <p className="mt-2 text-[12px] text-ink-tertiary">* Small sample: fewer than 30 sessions</p>
                        )}
                        {filters.device && (
                          <p className="mt-2 text-[12px] text-ink-tertiary">Orders without visit data are left out when a device is selected.</p>
                        )}
                      </>
                    );
                  }}
                </SectionBody>
              </SectionFrame>

              <SectionFrame
                id="funnel"
                title="Funnel"
                description="How far visits got, from first page to paid order."
                actions={<ViewAsTable shown={!!showTable.funnel} onToggle={() => toggle("funnel")} controls="funnel-body" />}
              >
                {zero ? zeroPanel : (
                  <SectionBody result={ok.sections.funnel} what="the funnel" onRetry={retry}>
                    {(f) => (
                      <FunnelChart
                        data={f}
                        compare={filters.compare}
                        showTable={!!showTable.funnel}
                        tableId="funnel-body"
                        drillHref={(step) => journeysQuery({ step })}
                      />
                    )}
                  </SectionBody>
                )}
              </SectionFrame>

              <SectionFrame
                id="traffic"
                title="Traffic"
                description={filters.range === "today" ? "Visits and paid revenue per hour." : "Visits and paid revenue per day."}
                actions={<ViewAsTable shown={!!showTable.traffic} onToggle={() => toggle("traffic")} controls="traffic-body" />}
              >
                {zero ? zeroPanel : (
                <SectionBody result={ok.sections.traffic} what="traffic" onRetry={retry}>
                  {(t) => (
                    <div className={ui.frame}>
                      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {[
                          { label: "Unique visitors", k: t.engagement.uniqueVisitors, v: count(t.engagement.uniqueVisitors.value), kind: "count" as const, up: true, rate: false },
                          { label: "Add-to-bag rate", k: t.engagement.addToBagRate, v: percent(t.engagement.addToBagRate.value), kind: "rate" as const, up: true, rate: true },
                          { label: "Avg engaged time", k: t.engagement.avgEngagedMs, v: duration(t.engagement.avgEngagedMs.value), kind: "time" as const, up: true, rate: false },
                          { label: "Bounce rate", k: t.engagement.bounceRate, v: percent(t.engagement.bounceRate.value, 0), kind: "rate" as const, up: false, rate: true },
                        ].map((e) => (
                          <div key={e.label}>
                            <dt className="text-sm text-ink-secondary">{e.label}</dt>
                            <dd className="mt-1 text-xl font-medium leading-tight text-ink">
                              {e.v}
                              <SmallSample show={e.rate && e.k.sample > 0 && e.k.sample < SMALL_SAMPLE_SESSIONS} />
                            </dd>
                            {filters.compare && (
                              <dd className="mt-1 text-[12px]">
                                <Delta value={e.k.value} previous={e.k.previous} kind={e.kind} upIsGood={e.up} />
                              </dd>
                            )}
                          </div>
                        ))}
                      </dl>
                      <TrafficCharts data={t} compare={filters.compare} showTable={!!showTable.traffic} tableId="traffic-body" />
                    </div>
                  )}
                </SectionBody>
                )}
              </SectionFrame>

              <SectionFrame id="acquisition" title="Acquisition" description="Where visits came from, and which sources lead to orders.">
                <SectionBody result={ok.sections.acquisition} what="acquisition" onRetry={retry}>
                  {(a) => (
                    <Acquisition
                      data={a}
                      hasSessions={a.totals.sessions > 0}
                      drill={(p) => journeysQuery(p)}
                    />
                  )}
                </SectionBody>
              </SectionFrame>

              <SectionFrame id="products" title="Products" description="How each piece is viewed, added and bought.">
                <SectionBody result={ok.sections.products} what="products" onRetry={retry}>
                  {(p) => <Products data={p} />}
                </SectionBody>
              </SectionFrame>

              <SectionFrame id="promotions" title="Promotions" description="Bundles, stacks and codes: how often they're used and what they're worth.">
                <SectionBody result={ok.sections.promotions} what="promotions" onRetry={retry}>
                  {(p) => <Promotions data={p} />}
                </SectionBody>
              </SectionFrame>

              <div className="grid grid-cols-1 gap-12 md:gap-16 xl:grid-cols-2 xl:gap-10">
                <SectionFrame id="devices" title="Devices" description="Phones, tablets and computers compared.">
                  {zero ? zeroPanel : (
                    <SectionBody result={ok.sections.devices} what="devices" onRetry={retry}>
                      {(d) => <Devices data={d} device={filters.device} onAllDevices={() => setFilters({ device: null })} />}
                    </SectionBody>
                  )}
                </SectionFrame>
                <SectionFrame id="search" title="Search" description="What people search for, including searches that found nothing.">
                  <SectionBody result={ok.sections.search} what="search" onRetry={retry}>
                    {(s) => <Search data={s} />}
                  </SectionBody>
                </SectionFrame>
              </div>

              <SectionFrame id="pages" title="Pages" description="The most viewed pages, and where people leave.">
                <SectionBody result={ok.sections.pages} what="pages" onRetry={retry}>
                  {(p) => <Pages data={p} />}
                </SectionBody>
              </SectionFrame>

              <SectionFrame
                id="when"
                title="When"
                description="When people visit, by day and hour (SAST)."
                actions={<ViewAsTable shown={!!showTable.when} onToggle={() => toggle("when")} controls="when-body" />}
              >
                <SectionBody result={ok.sections.when} what="visit times" onRetry={retry}>
                  {(w) => <When data={w} showTable={!!showTable.when} tableId="when-body" />}
                </SectionBody>
              </SectionFrame>

              <SectionFrame id="geography" title="Geography" description="Where visitors browse from.">
                <SectionBody result={ok.sections.geography} what="geography" onRetry={retry}>
                  {(g) => <Geography data={g} />}
                </SectionBody>
              </SectionFrame>

              <SectionFrame id="tracking" title="Tracking" description="Whether each tracking connection is working.">
                <Tracking rows={tracking} loading={integrations.loading} />
              </SectionFrame>
            </div>
          </div>
        </>
      )}
    </>
  );
}
