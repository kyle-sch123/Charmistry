/**
 * The overview's detail sections. Each takes one section result from the
 * overview API and renders it in its frame, or an empty / error state inside
 * that same frame (a failing section never blanks the page).
 *
 * Rates are always computed from the raw counts here, a "*" marks rates with
 * fewer than 30 sessions (or views) behind them, and every table can scroll
 * sideways inside its own region without scrolling the page.
 */

"use client";

import Link from "next/link";
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import type { IntegrationStatus, ProductsData, SectionResult } from "@/lib/analytics/api";
import type {
  AcquisitionRaw,
  ClassifiedTouch,
  DevicesRaw,
  GeographyRaw,
  HealthRaw,
  MergedRow,
  OrderTouchRow,
  PagesRaw,
  PromotionsRaw,
  SearchRaw,
  WhenRaw,
} from "@/lib/analytics/rpc";
import { SMALL_SAMPLE_SESSIONS, type DeviceClass } from "@/lib/analytics/types";
import { IconAlert, IconCheck, IconEye, IconMinus, IconTrend } from "../icons";
import { count, dateShort, dateTime, duration, money, orderRef, percent } from "../lib/format";
import { ui } from "../ui";
import { BarInCell, DataTable, Heatmap, Meter, type Column } from "./charts";
import { SectionError, SmallSample, StatePanel } from "./core";

const safe = (n: number, d: number) => (d > 0 ? n / d : 0);
const FOOTNOTE = "* Small sample: fewer than 30 sessions";

function Footnote({ show, text = FOOTNOTE }: { show: boolean; text?: string }) {
  return show ? <p className="mt-2 text-[12px] text-ink-tertiary">{text}</p> : null;
}

function Rate({ n, d, digits = 1 }: { n: number; d: number; digits?: number }) {
  if (d <= 0) return <>—</>;
  return (
    <>
      {percent(safe(n, d), digits)}
      <SmallSample show={d < SMALL_SAMPLE_SESSIONS} />
    </>
  );
}

function Definitions({ items }: { items: [string, string][] }) {
  return (
    <details className={ui.definitions}>
      <summary className={`${ui.textBtn} list-none`}>What these columns mean</summary>
      <dl className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        {items.map(([t, d]) => (
          <div key={t}>
            <dt className="font-medium text-ink">{t}</dt>
            <dd className="text-ink-secondary">{d}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Render a section result: error panel, empty panel, or the content. */
export function SectionBody<T>({
  result,
  what,
  onRetry,
  isEmpty,
  empty,
  children,
}: {
  result: SectionResult<T> | undefined;
  what: string;
  onRetry: () => void;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (!result) return null;
  if (!result.ok) {
    return <SectionError what={what} onRetry={onRetry} details={`${what}: ${result.error.code}`} />;
  }
  if (isEmpty?.(result.data)) return <div className={ui.frame}>{empty}</div>;
  return <>{children(result.data)}</>;
}

export function ZeroForFilters({
  device,
  onAllDevices,
  onLast30,
}: {
  device: DeviceClass | null;
  onAllDevices: () => void;
  onLast30: () => void;
}) {
  return (
    <StatePanel
      title={device ? `No ${device} sessions in this range.` : "No sessions in this range."}
      body="Try a longer range or all devices."
      actions={
        <>
          <button type="button" onClick={onLast30} className={ui.btnSecondary}>
            Show last 30 days
          </button>
          {device && (
            <button type="button" onClick={onAllDevices} className={ui.btnSecondary}>
              Show all devices
            </button>
          )}
        </>
      }
    />
  );
}

function touchLabel(t: ClassifiedTouch | null): ReactNode {
  if (!t) return <span className="text-ink-tertiary">Direct</span>;
  return (
    <span>
      {t.channel}
      <span className="block text-[12px] text-ink-tertiary">
        {t.source} / {t.medium}
        {t.campaign ? `, ${t.campaign}` : ""}
        {t.inferred ? " (inferred)" : ""}
      </span>
    </span>
  );
}

// ---- Acquisition --------------------------------------------------------------

type AcqTab = "channels" | "source_medium" | "campaigns" | "landing" | "orders";
const ACQ_TABS: { key: AcqTab; label: string }[] = [
  { key: "channels", label: "Channels" },
  { key: "source_medium", label: "Source / medium" },
  { key: "campaigns", label: "Campaigns" },
  { key: "landing", label: "Landing pages" },
  { key: "orders", label: "Orders" },
];

export function Acquisition({
  data,
  drill,
  hasSessions,
}: {
  data: AcquisitionRaw;
  drill: (params: { channel?: string; campaign?: string }) => string;
  hasSessions: boolean;
}) {
  const [tab, setTab] = useState<AcqTab>("channels");
  const baseId = useId();
  const totalSessions = data.totals.sessions;
  const index = ACQ_TABS.findIndex((t) => t.key === tab);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const next =
      e.key === "ArrowRight" ? (index + 1) % ACQ_TABS.length
      : e.key === "ArrowLeft" ? (index - 1 + ACQ_TABS.length) % ACQ_TABS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? ACQ_TABS.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(ACQ_TABS[next].key);
    document.getElementById(`${baseId}-tab-${ACQ_TABS[next].key}`)?.focus();
  }

  const mergedColumns = (first: string, link?: (r: MergedRow) => string | null): Column<MergedRow>[] => [
    {
      key: "key",
      header: first,
      sticky: true,
      render: (r) => {
        const href = link?.(r);
        return (
          <span className="block min-w-28">
            {r.key}
            {href && r.sessions > 0 && (
              <Link href={href} className="block text-[12px] text-ink-tertiary underline decoration-ink/30 underline-offset-4 hover:text-ink">
                View sessions
              </Link>
            )}
          </span>
        );
      },
      sortValue: (r) => r.key,
    },
    { key: "sessions", header: "Sessions", numeric: true, render: (r) => count(r.sessions), sortValue: (r) => r.sessions },
    {
      key: "share",
      header: "Share",
      numeric: true,
      render: (r) => <BarInCell fraction={safe(r.sessions, totalSessions)} label={percent(safe(r.sessions, totalSessions), 0)} />,
      sortValue: (r) => r.sessions,
    },
    { key: "conv", header: "Conv. rate", numeric: true, render: (r) => <Rate n={r.orders} d={r.sessions} />, sortValue: (r) => safe(r.orders, r.sessions) },
    { key: "orders", header: "Orders", numeric: true, render: (r) => count(r.orders), sortValue: (r) => r.orders },
    { key: "revenue", header: "Revenue", numeric: true, render: (r) => money(r.revenue), sortValue: (r) => r.revenue },
    { key: "aov", header: "AOV", numeric: true, render: (r) => (r.orders ? money(r.revenue / r.orders) : "—"), sortValue: (r) => safe(r.revenue, r.orders) },
    {
      key: "rps",
      header: "Revenue / session",
      numeric: true,
      render: (r) => (r.sessions ? money(r.revenue / r.sessions) : "—"),
      sortValue: (r) => safe(r.revenue, r.sessions),
    },
  ];

  const notTracked =
    data.not_tracked.orders > 0 ? (
      <tfoot>
        <tr className={ui.tfootRow}>
          <td className={`${ui.td} ${ui.stickyCell}`}>Not tracked</td>
          <td className={ui.tdNum}>—</td>
          <td className={ui.tdNum}>—</td>
          <td className={ui.tdNum}>—</td>
          <td className={ui.tdNum}>{count(data.not_tracked.orders)}</td>
          <td className={ui.tdNum}>{money(data.not_tracked.revenue)}</td>
          <td className={ui.tdNum}>—</td>
          <td className={ui.tdNum}>—</td>
        </tr>
      </tfoot>
    ) : undefined;
  const small = (rows: MergedRow[]) => rows.some((r) => r.sessions > 0 && r.sessions < SMALL_SAMPLE_SESSIONS);

  let panel: ReactNode;
  if (tab === "channels") {
    panel = (
      <>
        <DataTable
          caption="Sessions, orders and revenue by channel"
          columns={mergedColumns("Channel", (r) => drill({ channel: r.key }))}
          rows={data.channels}
          rowKey={(r) => r.key}
          defaultSort={{ key: "sessions", dir: "desc" }}
          footer={notTracked}
        />
        <Footnote show={small(data.channels)} />
      </>
    );
  } else if (tab === "source_medium") {
    panel = (
      <>
        <DataTable
          caption="Sessions, orders and revenue by source and medium"
          columns={mergedColumns("Source / medium")}
          rows={data.source_medium}
          rowKey={(r) => r.key}
          defaultSort={{ key: "sessions", dir: "desc" }}
          footer={notTracked}
        />
        <Footnote show={small(data.source_medium)} />
      </>
    );
  } else if (tab === "campaigns") {
    panel =
      data.campaigns.length === 0 ? (
        <div className={ui.frame}>
          <StatePanel
            title="No campaign visits yet."
            body="Visits from tagged links appear here, so you can see which posts and emails bring in orders."
            actions={
              <Link href="/admin/analytics/links" className={ui.btnPrimary}>
                Build a campaign link
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            caption="Campaigns"
            rows={data.campaigns}
            rowKey={(r) => r.key}
            defaultSort={{ key: "revenue", dir: "desc" }}
            columns={[
              {
                key: "key",
                header: "Campaign",
                sticky: true,
                sortValue: (r) => r.key,
                render: (r) => (
                  <span className="block min-w-32">
                    {r.key}
                    {r.sessions > 0 && (
                      <Link href={drill({ campaign: r.key })} className="block text-[12px] text-ink-tertiary underline decoration-ink/30 underline-offset-4 hover:text-ink">
                        View sessions
                      </Link>
                    )}
                  </span>
                ),
              },
              { key: "sm", header: "Source / medium", render: (r) => r.source_medium, sortValue: (r) => r.source_medium },
              { key: "sessions", header: "Sessions", numeric: true, render: (r) => count(r.sessions), sortValue: (r) => r.sessions },
              { key: "adds", header: "Add-to-bag", numeric: true, render: (r) => count(r.adds), sortValue: (r) => r.adds },
              { key: "orders", header: "Orders", numeric: true, render: (r) => count(r.orders), sortValue: (r) => r.orders },
              { key: "revenue", header: "Revenue", numeric: true, render: (r) => money(r.revenue), sortValue: (r) => r.revenue },
              { key: "conv", header: "Conv. rate", numeric: true, render: (r) => <Rate n={r.orders} d={r.sessions} />, sortValue: (r) => safe(r.orders, r.sessions) },
            ]}
          />
          <Footnote show={small(data.campaigns)} />
        </>
      );
  } else if (tab === "landing") {
    panel = (
      <>
        <ul className={ui.stackList}>
          {data.landing.map((r) => (
            <li key={r.key} className={ui.stackRow}>
              <p className={ui.stackTitle}>{r.key}</p>
              <p className={ui.stackMeta}>
                {count(r.sessions)} sessions, bounce <Rate n={r.bounces} d={r.sessions} digits={0} />, conv.{" "}
                <Rate n={r.orders} d={r.sessions} />
              </p>
            </li>
          ))}
        </ul>
        <div className="hidden md:block">
          <DataTable
            caption="Landing pages"
            rows={data.landing}
            rowKey={(r) => r.key}
            defaultSort={{ key: "sessions", dir: "desc" }}
            columns={[
              { key: "key", header: "Page", render: (r) => <span className="break-all">{r.key}</span>, sortValue: (r) => r.key },
              { key: "sessions", header: "Sessions", numeric: true, render: (r) => count(r.sessions), sortValue: (r) => r.sessions },
              { key: "bounce", header: "Bounce rate", numeric: true, render: (r) => <Rate n={r.bounces} d={r.sessions} digits={0} />, sortValue: (r) => safe(r.bounces, r.sessions) },
              { key: "conv", header: "Conv. rate", numeric: true, render: (r) => <Rate n={r.orders} d={r.sessions} />, sortValue: (r) => safe(r.orders, r.sessions) },
            ]}
          />
        </div>
        <Footnote show={small(data.landing)} />
      </>
    );
  } else {
    panel =
      data.orders.length === 0 ? (
        <div className={ui.frame}>
          <StatePanel title="No paid orders in this range." body="Orders appear here with the campaign that brought each one in." />
        </div>
      ) : (
        <DataTable<OrderTouchRow>
          caption="Paid orders and how each customer found the shop"
          rows={data.orders}
          rowKey={(r) => r.order_id}
          defaultSort={{ key: "paid", dir: "desc" }}
          columns={[
            {
              key: "ref",
              header: "Order #",
              sticky: true,
              sortValue: (r) => r.short_id,
              render: (r) =>
                r.tracked && r.session_id ? (
                  <Link href={`/admin/analytics/journeys/${r.session_id}`} className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
                    {orderRef(r.short_id)}
                  </Link>
                ) : (
                  orderRef(r.short_id)
                ),
            },
            { key: "paid", header: "Date paid", render: (r) => dateShort(r.paid_at), sortValue: (r) => r.paid_at },
            { key: "total", header: "Total", numeric: true, render: (r) => money(r.total), sortValue: (r) => r.total },
            { key: "first", header: "First touch", render: (r) => (r.tracked ? touchLabel(r.first_touch) : <span className="text-ink-tertiary">Not tracked</span>) },
            { key: "last", header: "Last non-direct touch", render: (r) => (r.tracked ? touchLabel(r.last_touch) : <span className="text-ink-tertiary">Not tracked</span>) },
            { key: "touches", header: "Touches", numeric: true, render: (r) => (r.tracked ? count(r.touches) : "—"), sortValue: (r) => r.touches },
            {
              key: "days",
              header: "Days to purchase",
              numeric: true,
              render: (r) => (r.days_to_purchase === null ? "—" : count(r.days_to_purchase)),
              sortValue: (r) => r.days_to_purchase ?? -1,
            },
          ]}
        />
      );
  }

  return (
    <div>
      <div role="tablist" aria-label="Acquisition views" onKeyDown={onKey} className={`${ui.chipList} mb-3`}>
        {ACQ_TABS.map((t) => (
          <button
            key={t.key}
            id={`${baseId}-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            aria-controls={`${baseId}-panel`}
            tabIndex={t.key === tab ? 0 : -1}
            onClick={() => setTab(t.key)}
            className={`${ui.chip} aria-selected:border-ink aria-selected:bg-ink aria-selected:text-paper`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`}>
        {!hasSessions && tab !== "orders" && data.orders.length === 0 ? (
          <div className={ui.frame}>
            <StatePanel title="No visits in this range." body="Try a longer date range." />
          </div>
        ) : (
          panel
        )}
      </div>
      <Definitions
        items={[
          ["Source / medium", "Where a visit came from (instagram, google) and how (social, email, cpc). Taken from campaign tags, or from the referring site."],
          ["Share", "This row's share of all sessions in the range."],
          ["Conv. rate", "Paid orders from these visits, divided by visits."],
          ["Revenue / session", "Revenue divided by sessions: what an average visit from this source is worth."],
          ["Landing page", "The first page of a visit."],
          ["Orders and revenue", "Each paid order is credited to the last campaign or site that brought the customer in within 90 days, not counting direct visits."],
          ["Not tracked", "Paid orders with no visit data, for example when the browser blocked tracking."],
          ["Other platforms", "Meta, Klaviyo and TikTok each claim their own credit for sales, so their numbers won't match these."],
        ]}
      />
    </div>
  );
}

// ---- Products -----------------------------------------------------------------

export function Products({ data }: { data: ProductsData }) {
  const callout = (title: string, sub: string, icon: ReactNode, items: ProductsData["flags"]["promote"], tone: string) => (
    <div className={ui.frame}>
      <h3 className={`${ui.h3} flex items-center gap-2`}>
        <span className={tone}>{icon}</span>
        {title}
      </h3>
      <p className="mt-1 text-[12px] text-ink-tertiary">{sub}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-secondary">
          {data.eligible < 3
            ? "Not enough views yet. Pieces are flagged once they reach 20 views in this range."
            : "Nothing stands out in this range."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink/10">
          {items.map((f) => (
            <li key={f.key} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
              <span className="text-sm text-ink">{f.name}</span>
              <span className="text-[12px] tabular-nums text-ink-secondary">
                {count(f.views)} views, {percent(f.viewToPurchase)} bought; shop median{" "}
                {percent(data.medianViewToPurchase ?? 0)}
              </span>
              {f.slug && (
                <a
                  href={`/products/${f.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="text-[12px] text-ink-tertiary underline decoration-ink/30 underline-offset-4 hover:text-ink"
                >
                  View piece
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  const smallViews = data.rows.some((r) => r.views > 0 && r.views < SMALL_SAMPLE_SESSIONS);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {callout("Promote these", "Converts well, under-exposed", <IconTrend />, data.flags.promote, "text-green-800")}
        {callout("Worth a closer look", "High interest, low conversion", <IconEye />, data.flags.closerLook, "text-amber-800")}
      </div>
      {data.rows.length === 0 ? (
        <div className={ui.frame}>
          <StatePanel title="No product views in this range." body="Pieces appear here once people view or buy them." />
        </div>
      ) : (
        <DataTable
          caption="Products: views, adds and sales"
          rows={data.rows}
          rowKey={(r) => r.key}
          defaultSort={{ key: "revenue", dir: "desc" }}
          columns={[
            { key: "name", header: "Piece", sticky: true, render: (r) => <span className="block min-w-32">{r.name}</span>, sortValue: (r) => r.name },
            { key: "views", header: "Views", numeric: true, render: (r) => count(r.views), sortValue: (r) => r.views },
            { key: "adds", header: "Adds to bag", numeric: true, render: (r) => count(r.adds), sortValue: (r) => r.adds },
            { key: "addRate", header: "Add rate", numeric: true, render: (r) => <Rate n={r.adds} d={r.views} />, sortValue: (r) => safe(r.adds, r.views) },
            { key: "units", header: "Units sold", numeric: true, render: (r) => count(r.units), sortValue: (r) => r.units },
            { key: "revenue", header: "Revenue", numeric: true, render: (r) => money(r.revenue), sortValue: (r) => r.revenue },
            { key: "vtp", header: "View → purchase", numeric: true, render: (r) => <Rate n={r.view_purchases} d={r.views} />, sortValue: (r) => safe(r.view_purchases, r.views) },
          ]}
        />
      )}
      <Footnote show={smallViews} text="* Small sample: fewer than 30 views" />
      <Definitions
        items={[
          ["Views", "Sessions that viewed this piece's page."],
          ["Add rate", "Of the sessions that viewed this piece, the share that added it to the bag."],
          ["View → purchase", "Of the sessions that viewed this piece, the share that bought it."],
          ["Flags", "Pieces with at least 20 views are compared with the shop's median view → purchase rate."],
        ]}
      />
    </div>
  );
}

// ---- Promotions ---------------------------------------------------------------

const PROMO_LABELS: Record<string, string> = {
  "EVERYDAY-EDIT": "The Everyday Edit (bundle)",
  "DAILY-AFFAIR": "The Daily Affair (bundle)",
  "RINGS-STACK": "Rings Stack & Save (15% stack)",
  "MIX-STACK": "Mix & Match Stack (15% stack)",
  WELCOME: "Welcome codes (CHARM-…)",
};

export function Promotions({ data }: { data: PromotionsRaw }) {
  const noPromoAov = safe(data.no_promo.revenue, data.no_promo.orders);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={ui.frame}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className={ui.h3}>Welcome codes redeemed</h3>
            <span className="text-xl font-medium text-ink">{percent(safe(data.welcome.redeemed, data.welcome.issued), 0)}</span>
          </div>
          <Meter fraction={safe(data.welcome.redeemed, data.welcome.issued)} />
          <p className="mt-2 text-sm text-ink-secondary">
            {count(data.welcome.redeemed)} of {count(data.welcome.issued)} codes issued in this range used on a paid order.
          </p>
        </div>
        <div className={ui.frame}>
          <h3 className={ui.h3}>Promo banner clicks</h3>
          <p className="mt-2 text-sm text-ink-secondary">
            {count(data.banners.clicks)} clicks from {count(data.banners.sessions)} visits, leading to{" "}
            {count(data.banners.orders)} orders worth {money(data.banners.revenue)}.
          </p>
        </div>
      </div>
      {data.rows.length === 0 ? (
        <div className={ui.frame}>
          <StatePanel title="No promotions used in this range." body="Bundles, stacks and codes appear here once a paid order uses one." />
        </div>
      ) : (
        <DataTable
          caption="Promotions used on paid orders"
          rows={data.rows}
          rowKey={(r) => r.code}
          defaultSort={{ key: "orders", dir: "desc" }}
          footer={
            <tfoot>
              <tr className={ui.tfootRow}>
                <td className={`${ui.td} ${ui.stickyCell}`} colSpan={7}>
                  Orders without a promotion: {count(data.no_promo.orders)}, AOV {data.no_promo.orders ? money(noPromoAov) : "—"}
                </td>
              </tr>
            </tfoot>
          }
          columns={[
            {
              key: "code",
              header: "Promotion",
              sticky: true,
              render: (r) => <span className="block min-w-40">{PROMO_LABELS[r.code] ?? r.code}</span>,
              sortValue: (r) => r.code,
            },
            { key: "orders", header: "Orders", numeric: true, render: (r) => count(r.orders), sortValue: (r) => r.orders },
            {
              key: "share",
              header: "Share of orders",
              numeric: true,
              render: (r) => percent(safe(r.orders, data.total_orders), 0),
              sortValue: (r) => r.orders,
            },
            { key: "revenue", header: "Revenue", numeric: true, render: (r) => money(r.revenue), sortValue: (r) => r.revenue },
            { key: "discount", header: "Discount given", numeric: true, render: (r) => money(r.discount), sortValue: (r) => r.discount },
            { key: "aov", header: "AOV", numeric: true, render: (r) => money(safe(r.revenue, r.orders)), sortValue: (r) => safe(r.revenue, r.orders) },
            {
              key: "vs",
              header: "vs non-promo AOV",
              numeric: true,
              render: (r) =>
                data.no_promo.orders && noPromoAov
                  ? `${safe(r.revenue, r.orders) >= noPromoAov ? "+" : "−"}${percent(Math.abs(safe(r.revenue, r.orders) / noPromoAov - 1), 0)}`
                  : "—",
            },
          ]}
        />
      )}
      <p className="text-[12px] text-ink-tertiary">An order uses at most one promotion: a bundle or stack replaces any typed code.</p>
    </div>
  );
}

// ---- Devices --------------------------------------------------------------------

const DEVICE_LABEL: Record<DeviceClass, string> = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" };

export function Devices({
  data,
  device,
  onAllDevices,
}: {
  data: DevicesRaw;
  device: DeviceClass | null;
  onAllDevices: () => void;
}) {
  const total = data.rows.reduce((n, r) => n + Number(r.sessions), 0);
  const stickyShare = safe(data.sticky.sticky_adds, data.sticky.mobile_adds);
  return (
    <div className="space-y-4">
      {device && (
        <p className="text-sm text-ink-secondary">
          Showing {device} only.{" "}
          <button type="button" onClick={onAllDevices} className={ui.textBtn}>
            Show all devices
          </button>
        </p>
      )}
      <DataTable
        caption="Sessions and orders by device"
        rows={data.rows}
        rowKey={(r) => r.device}
        columns={[
          { key: "d", header: "Device", render: (r) => DEVICE_LABEL[r.device] ?? r.device },
          {
            key: "s",
            header: "Sessions",
            numeric: true,
            render: (r) => <BarInCell fraction={safe(r.sessions, total)} label={count(r.sessions)} />,
          },
          { key: "c", header: "Conv. rate", numeric: true, render: (r) => <Rate n={r.orders} d={r.sessions} /> },
          { key: "a", header: "AOV", numeric: true, render: (r) => (r.orders ? money(r.revenue / r.orders) : "—") },
        ]}
      />
      <div className={ui.frame}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className={ui.h3}>Sticky add-to-bag bar</h3>
          <span className="text-xl font-medium text-ink">{percent(stickyShare, 0)}</span>
        </div>
        <Meter fraction={stickyShare} />
        <p className="mt-2 text-sm text-ink-secondary">
          {count(data.sticky.sticky_adds)} of {count(data.sticky.mobile_adds)} phone and tablet add-to-bags were made with the bar
          that stays at the bottom of product pages.
        </p>
      </div>
    </div>
  );
}

// ---- Pages ------------------------------------------------------------------------

export function Pages({ data }: { data: PagesRaw }) {
  if (data.rows.length === 0) {
    return (
      <div className={ui.frame}>
        <StatePanel title="No page views in this range." body="Try a longer date range." />
      </div>
    );
  }
  return (
    <>
      <ul className={ui.stackList}>
        {data.rows.slice(0, 30).map((r) => (
          <li key={r.path} className={ui.stackRow}>
            <p className={ui.stackTitle}>{r.title ?? r.path}</p>
            <p className="text-[12px] text-ink-tertiary break-all">{r.path}</p>
            <p className={ui.stackMeta}>
              {count(r.views)} views, {duration(safe(r.engaged_ms, r.views))} avg, exit {percent(safe(r.exits, r.views), 0)}
            </p>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <DataTable
          caption="Most viewed pages"
          rows={data.rows}
          rowKey={(r) => r.path}
          defaultSort={{ key: "views", dir: "desc" }}
          columns={[
            {
              key: "page",
              header: "Page",
              sortValue: (r) => r.title ?? r.path,
              render: (r) => (
                <span>
                  {r.title ?? r.path}
                  <span className="block text-[12px] text-ink-tertiary break-all">{r.path}</span>
                </span>
              ),
            },
            { key: "views", header: "Views", numeric: true, render: (r) => count(r.views), sortValue: (r) => r.views },
            { key: "time", header: "Avg time on page", numeric: true, render: (r) => duration(safe(r.engaged_ms, r.views)), sortValue: (r) => safe(r.engaged_ms, r.views) },
            { key: "exit", header: "Exit rate", numeric: true, render: (r) => percent(safe(r.exits, r.views), 0), sortValue: (r) => safe(r.exits, r.views) },
          ]}
        />
      </div>
    </>
  );
}

// ---- Search -----------------------------------------------------------------------

export function Search({ data }: { data: SearchRaw }) {
  // Side by side on tablets; stacked at xl, where Search shares a row with Devices.
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
      <div>
        <h3 className={`${ui.h3} mb-2`}>Top searches</h3>
        {data.top.length === 0 ? (
          <div className={ui.frame}>
            <p className="text-sm text-ink-secondary">No searches in this range.</p>
          </div>
        ) : (
          <DataTable
            caption="Top searches"
            rows={data.top}
            rowKey={(r) => r.term}
            columns={[
              { key: "t", header: "Term", render: (r) => r.term },
              { key: "s", header: "Searches", numeric: true, render: (r) => count(r.searches) },
              { key: "l", header: "Led to a product view", numeric: true, render: (r) => percent(safe(r.led_to_view, r.searches), 0) },
            ]}
          />
        )}
      </div>
      <div>
        <h3 className={`${ui.h3} mb-2`}>Found nothing</h3>
        {data.no_results.length === 0 ? (
          <div className={ui.frame}>
            <p className="text-sm text-ink-secondary">Every search found something.</p>
          </div>
        ) : (
          <DataTable
            caption="Searches that found nothing"
            rows={data.no_results}
            rowKey={(r) => r.term}
            columns={[
              { key: "t", header: "Term", render: (r) => r.term },
              { key: "s", header: "Searches", numeric: true, render: (r) => count(r.searches) },
              { key: "d", header: "Last searched", render: (r) => dateTime(r.last_at) },
            ]}
          />
        )}
        <p className="mt-2 text-[12px] text-ink-tertiary">
          Searches that found nothing are worth adding as product keywords, or as pieces to stock.
        </p>
      </div>
    </div>
  );
}

// ---- When ---------------------------------------------------------------------------

export function When({ data, showTable, tableId }: { data: WhenRaw; showTable: boolean; tableId: string }) {
  return <Heatmap cells={data.cells} showTable={showTable} tableId={tableId} />;
}

// ---- Geography ------------------------------------------------------------------------

const COUNTRY_NAMES: Record<string, string> = {
  ZA: "South Africa",
  NA: "Namibia",
  BW: "Botswana",
  ZW: "Zimbabwe",
  GB: "United Kingdom",
  US: "United States",
  ZZ: "Unknown",
};
function countryName(code: string): string {
  if (COUNTRY_NAMES[code]) return COUNTRY_NAMES[code];
  try {
    return new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function Geography({ data }: { data: GeographyRaw }) {
  const [view, setView] = useState<"countries" | "cities">("countries");
  const top = data.countries.slice(0, 10);
  const rest = data.countries.slice(10);
  const other = rest.reduce(
    (a, r) => ({ sessions: a.sessions + r.sessions, orders: a.orders + r.orders, revenue: a.revenue + Number(r.revenue) }),
    { sessions: 0, orders: 0, revenue: 0 },
  );
  const maxSessions = Math.max(1, ...data.countries.map((r) => r.sessions));
  const countryRows = rest.length > 0 ? [...top, { code: "OTHER", ...other }] : top;
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Geography view" className={ui.segGroup}>
        {(["countries", "cities"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            disabled={v === "cities" && !data.cities}
            onClick={() => setView(v)}
            className={ui.segItem}
          >
            {v === "countries" ? "Countries" : "Cities"}
          </button>
        ))}
      </div>
      {!data.cities && <p className={ui.help}>City data isn&apos;t collected yet.</p>}
      {view === "countries" || !data.cities ? (
        <DataTable
          caption="Sessions and orders by country"
          rows={countryRows}
          rowKey={(r) => r.code}
          columns={[
            { key: "c", header: "Country", render: (r) => (r.code === "OTHER" ? "Other" : countryName(r.code)) },
            { key: "s", header: "Sessions", numeric: true, render: (r) => <BarInCell fraction={r.sessions / maxSessions} label={count(r.sessions)} /> },
            { key: "o", header: "Orders", numeric: true, render: (r) => count(r.orders) },
            { key: "r", header: "Revenue", numeric: true, render: (r) => money(Number(r.revenue)) },
          ]}
        />
      ) : (
        <DataTable
          caption="Sessions and orders by city"
          rows={data.cities}
          rowKey={(r) => `${r.name}-${r.country}`}
          columns={[
            { key: "c", header: "City", render: (r) => `${r.name}, ${countryName(r.country)}` },
            { key: "s", header: "Sessions", numeric: true, render: (r) => count(r.sessions) },
            { key: "o", header: "Orders", numeric: true, render: (r) => count(r.orders) },
            { key: "r", header: "Revenue", numeric: true, render: (r) => money(Number(r.revenue)) },
          ]}
        />
      )}
    </div>
  );
}

// ---- Tracking -----------------------------------------------------------------------

type Tone = "ok" | "limited" | "off" | "bad";
const TONE_CLASS: Record<Tone, string> = {
  ok: ui.statusOk,
  limited: ui.statusLimited,
  off: ui.statusOff,
  bad: ui.statusBad,
};
const TONE_ICON: Record<Tone, ReactNode> = {
  ok: <IconCheck />,
  limited: <IconAlert />,
  off: <IconMinus />,
  bad: <IconAlert />,
};

interface TrackingRow {
  name: string;
  tone: Tone;
  status: string;
  reason: string;
}

export function trackingRows(
  health: SectionResult<HealthRaw> | undefined,
  integrations: IntegrationStatus[] | null,
  now: number,
): TrackingRow[] {
  const rows: TrackingRow[] = [];
  if (health?.ok) {
    const h = health.data;
    const last = h.last_at ? Date.parse(h.last_at) : NaN;
    const fresh = Number.isFinite(last) && now - last < 86_400_000;
    rows.push(
      fresh
        ? {
            name: "First-party tracking",
            tone: "ok",
            status: "Connected",
            reason: `${count(h.events_24h + h.page_views_24h)} events in the last 24 hours. Last event at ${dateTime(h.last_at!)}.`,
          }
        : {
            name: "First-party tracking",
            tone: h.ever ? "bad" : "off",
            status: h.ever ? "Not receiving data" : "Not receiving data",
            reason: h.ever && h.last_at
              ? `No events since ${dateTime(h.last_at)}. Visits after that aren't counted.`
              : "No visits recorded yet. Visits appear a few minutes after someone browses the shop.",
          },
    );
  }
  for (const i of integrations ?? []) {
    if (i.key === "ga4") {
      rows.push(
        i.state === "connected"
          ? { name: "Google Analytics 4", tone: "ok", status: "Connected", reason: "Measurement ID is set. Its reports live in Google Analytics, not here." }
          : { name: "Google Analytics 4", tone: "off", status: "Not configured", reason: "No measurement ID is set, so GA4 isn't collecting." },
      );
    } else if (i.key === "meta") {
      rows.push(
        i.state === "connected"
          ? { name: "Meta Pixel and Conversions API", tone: "ok", status: "Connected", reason: "Pixel and server events are both on." }
          : i.state === "limited"
            ? { name: "Meta Pixel and Conversions API", tone: "limited", status: "Limited access", reason: "The Pixel is on, but server events (Conversions API) aren't set up, so Meta may miss some purchases." }
            : { name: "Meta Pixel and Conversions API", tone: "off", status: "Not configured", reason: "No Pixel ID is set, so Meta isn't measuring the shop." },
      );
    } else if (i.key === "klaviyo") {
      rows.push(
        i.state === "connected"
          ? { name: "Klaviyo", tone: "ok", status: "Connected", reason: `Sending events. Email-attributed revenue in this range: ${money(i.metrics.emailRevenue ?? 0)}.` }
          : i.state === "not_configured"
            ? { name: "Klaviyo", tone: "off", status: "Not configured", reason: "No API key is set, so orders aren't sent to Klaviyo." }
            : i.reason === "timeout"
              ? { name: "Klaviyo", tone: "limited", status: "Limited access", reason: "Klaviyo didn't answer in time, so email revenue isn't shown. Try Refresh." }
              : { name: "Klaviyo", tone: "limited", status: "Limited access", reason: "The key can send events but can't read metrics, so email revenue isn't shown. A key with metrics read access fixes this." },
      );
    } else if (i.key === "resend") {
      rows.push(
        i.state === "connected"
          ? {
              name: "Resend (shop emails)",
              tone: "ok",
              status: "Connected",
              reason: i.metrics.emailsCapped
                ? "More than 200 emails sent in the last 24 hours."
                : `${count(i.metrics.emailsSent24h ?? 0)} emails sent in the last 24 hours.`,
            }
          : i.state === "not_configured"
            ? { name: "Resend (shop emails)", tone: "off", status: "Not configured", reason: "No API key is set, so shop emails aren't sent through Resend." }
            : { name: "Resend (shop emails)", tone: "limited", status: "Limited access", reason: i.reason === "timeout" ? "Resend didn't answer in time. Try Refresh." : "The key can send email but can't read the send log, so the count isn't shown." },
      );
    }
  }
  return rows;
}

export function Tracking({ rows, loading }: { rows: TrackingRow[]; loading: boolean }) {
  return (
    <ul className="divide-y divide-ink/10 border border-ink/10 bg-paper-warm" aria-busy={loading || undefined}>
      {rows.map((r) => (
        <li key={r.name} className={ui.statusRow}>
          <span className="text-sm font-medium text-ink">{r.name}</span>
          <span className={TONE_CLASS[r.tone]}>
            {TONE_ICON[r.tone]}
            {r.status}
          </span>
          <span className="col-span-2 text-sm text-ink-secondary md:col-span-1">{r.reason}</span>
        </li>
      ))}
      {loading && rows.length <= 1 && (
        <li className="px-4 py-4 text-sm text-ink-tertiary">Checking connections…</li>
      )}
    </ul>
  );
}
