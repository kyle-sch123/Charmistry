/**
 * One visit, start to finish, drawn as a charm chain: a thin gold line runs
 * down the page, page views are hollow squares (links in the chain), actions
 * are gold diamonds (charms), and a purchase is a larger diamond. Each page
 * shows how long it was open and in view, scaled to the longest page in this
 * visit, and how far it was scrolled.
 *
 * "All sessions" lists this visitor's other visits; visits on another device
 * appear only when an order with the same email links them.
 */

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { JourneyResponse } from "@/lib/analytics/api";
import type { JourneyRaw, TimelineItem } from "@/lib/analytics/rpc";
import { SHIPPING_METHODS } from "@/lib/shipping";
import { IconDatabase } from "../../icons";
import { count, dateLong, dateShort, dateTime, duration, money, orderRef, time } from "../../lib/format";
import { ui } from "../../ui";
import { AdminKeyGate, StatePanel, useAdminApi, useAdminKey } from "../../components/core";
import { OutcomeBadge } from "../JourneysClient";

const COUNTRY: Record<string, string> = { ZA: "South Africa" };

function countryName(code: string | null): string | null {
  if (!code) return null;
  if (COUNTRY[code]) return COUNTRY[code];
  try {
    return new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

const PROMO_NAMES: Record<string, string> = {
  rings_stack_banner: "Rings Stack & Save",
  mix_stack_banner: "Mix & Match stack",
  stack_promo_banner: "stack promotion",
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Plain-English line for one event (copy deck §8). */
export function eventLine(name: string, props: Record<string, unknown>): string {
  const item = str(props.name);
  switch (name) {
    case "view_item":
      return `Viewed ${item || "a piece"}`;
    case "add_to_cart": {
      const bits = [str(props.variant), props.size ? `size ${str(props.size)}` : ""].filter(Boolean).join(", ");
      const value = num(props.price) * Math.max(1, num(props.quantity));
      return `Added ${item || "a piece"}${bits ? ` (${bits})` : ""} to bag, ${money(value)}${props.source === "pdp_sticky" ? " (sticky bar)" : ""}`;
    }
    case "remove_from_cart":
      return `Removed ${item || "a piece"} from the bag`;
    case "view_cart":
      return "Opened bag";
    case "begin_checkout":
      return "Started checkout";
    case "checkout_email_entered":
      return "Entered email";
    case "shipping_method_selected": {
      const method = SHIPPING_METHODS.find((m) => m.id === props.method);
      return `Chose ${method ? method.label : "a delivery method"}`;
    }
    case "discount_applied":
      return `Used code ${str(props.code)}`;
    case "discount_rejected":
      return `A code was rejected (${str(props.reason).replace(/_/g, " ")})`;
    case "checkout_submitted":
      return "Clicked Pay";
    case "checkout_error":
      return `Checkout stopped (${str(props.reason).replace(/_/g, " ")})`;
    case "purchase_confirmed":
      return "Saw the order confirmation";
    case "search":
      return `Searched for '${str(props.term)}' (${count(num(props.results))} ${num(props.results) === 1 ? "result" : "results"})`;
    case "promo_click":
      return `Tapped the ${PROMO_NAMES[str(props.promo)] ?? "promotion"} banner`;
    case "newsletter_signup":
      return props.outcome === "success"
        ? "Joined the newsletter"
        : props.outcome === "duplicate"
          ? "Tried to join the newsletter (already subscribed)"
          : "Newsletter sign-up failed";
    case "wishlist_add":
      return "Saved a piece to the wishlist";
    case "wishlist_remove":
      return "Removed a piece from the wishlist";
    case "review_submitted":
      return `Left a ${num(props.rating)}-star review`;
    default:
      return name.replace(/_/g, " ");
  }
}

function TimelineRow({
  item,
  longest,
  last,
}: {
  item: TimelineItem;
  longest: number;
  last: boolean;
}) {
  let node: string = ui.tlNodeEvent;
  let body: React.ReactNode;
  if (item.kind === "page") {
    node = ui.tlNodePage;
    const share = longest > 0 ? item.engaged_ms / longest : 0;
    body = (
      <>
        <p className="text-sm text-ink">{item.title ?? item.path}</p>
        <p className="text-[12px] text-ink-tertiary break-all">{item.path}</p>
        <div className="flex items-center gap-3">
          <span className={ui.tlBarTrack} aria-hidden>
            <span className={ui.tlBarFill} style={{ width: `${Math.max(2, share * 100)}%` }} />
          </span>
          <span className="shrink-0 text-[12px] tabular-nums text-ink-secondary">{duration(item.engaged_ms)}</span>
        </div>
        {item.scroll_pct > 0 && <p className="text-[12px] text-ink-tertiary">Scrolled {item.scroll_pct}%</p>}
      </>
    );
  } else if (item.kind === "event") {
    body = <p className="text-sm text-ink">{eventLine(item.name, item.props)}</p>;
  } else if (item.kind === "touch") {
    const t = item.touch;
    body = (
      <p className="text-sm text-ink">
        Arrived from {t.channel}: {t.source} / {t.medium}
        {t.campaign ? `, ${t.campaign}` : ""}
        {t.inferred ? " (inferred)" : ""}
      </p>
    );
  } else {
    node = ui.tlNodePaid;
    body = (
      <p className="text-sm font-medium text-ink">
        Paid order {orderRef(item.short_id)}, {money(item.total)}
      </p>
    );
  }
  return (
    <li className={ui.tlItem}>
      <span className={ui.tlTime}>{time(item.at)}</span>
      <span className="relative flex justify-center">
        {!last && <span aria-hidden className={ui.tlSpine} />}
        <span aria-hidden className={node} />
      </span>
      <div className="min-w-0">{body}</div>
    </li>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className={ui.legend}>{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function Detail({ j, query }: { j: JourneyRaw; query: string }) {
  const [tab, setTab] = useState<"session" | "all">("session");
  const s = j.session;
  const name = j.visitor.customer_name ?? `Visitor · ${j.visitor.tag}`;
  const paidHere = j.orders.filter((o) => o.session_id === s.id && o.status === "paid");
  const outcome = {
    outcome: paidHere.length > 0 ? ("paid" as const) : j.timeline.some((t) => t.kind === "event" && t.name === "add_to_cart") ? ("bag" as const) : ("browsed" as const),
    paid_total: paidHere.reduce((n, o) => n + Number(o.total), 0),
    bag_value: j.timeline.reduce(
      (n, t) => (t.kind === "event" && t.name === "add_to_cart" ? n + num(t.props.price) * Math.max(1, num(t.props.quantity)) : n),
      0,
    ),
  };
  const longest = Math.max(0, ...j.timeline.map((t) => (t.kind === "page" ? t.engaged_ms : 0)));
  const paidOrders = j.orders.filter((o) => o.status === "paid");
  const firstVisit = [...j.sessions].sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))[0];
  const firstPaid = paidOrders.length ? [...paidOrders].sort((a, b) => Date.parse(a.paid_at ?? "") - Date.parse(b.paid_at ?? ""))[0] : null;
  const daysToBuy =
    firstPaid?.paid_at && j.visitor.first_seen_at
      ? Math.max(0, Math.floor((Date.parse(firstPaid.paid_at) - Date.parse(j.visitor.first_seen_at)) / 86_400_000))
      : null;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className={ui.h1}>{name}</h1>
        <OutcomeBadge row={outcome} />
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Meta label="Source">
          {s.channel}
          <span className="block text-[12px] text-ink-tertiary">
            {s.source} / {s.medium}
            {s.campaign ? `, ${s.campaign}` : ""}
            {s.inferred ? " (inferred)" : ""}
          </span>
        </Meta>
        <Meta label="Device">
          {s.device.charAt(0).toUpperCase() + s.device.slice(1)}
          {s.os || s.browser ? `, ${[s.os, s.browser].filter(Boolean).join(" ")}` : ""}
        </Meta>
        <Meta label="Location">{[countryName(s.country), s.city].filter(Boolean).join(", ") || "Unknown"}</Meta>
        <Meta label="First seen">{j.visitor.first_seen_at ? dateLong(j.visitor.first_seen_at) : "—"}</Meta>
        <Meta label="Sessions">{count(j.visitor.sessions)}</Meta>
        <Meta label="Orders">
          {count(paidOrders.length)}
          {paidOrders.length > 0 ? `, ${money(paidOrders.reduce((n, o) => n + Number(o.total), 0))}` : ""}
        </Meta>
      </dl>

      <div role="tablist" aria-label="Visit views" className={`${ui.viewTabs} border-b border-ink/10`}>
        {(["session", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
            className={ui.viewTab}
          >
            {t === "session" ? "This session" : `All sessions (${count(j.sessions.length)})`}
          </button>
        ))}
      </div>

      {tab === "session" ? (
        <div className="mt-6 max-w-3xl">
          <p className="mb-6 text-sm text-ink-secondary">
            {dateTime(s.started_at)} to {time(s.ended_at)}. {count(s.pages)} {s.pages === 1 ? "page" : "pages"},{" "}
            {duration(s.engaged_ms)} engaged.
            {longest > 0 && <span className="block text-[12px] text-ink-tertiary">Bars compare pages within this visit.</span>}
          </p>
          <ol>
            {j.timeline.map((item, i) => (
              <TimelineRow key={`${item.kind}-${item.at}-${i}`} item={item} longest={longest} last={false} />
            ))}
            <li className={ui.tlItem}>
              <span className={ui.tlTime}>{time(s.ended_at)}</span>
              <span className="relative flex justify-center">
                <span aria-hidden className={ui.tlNodeEnd} />
              </span>
              <p className="text-sm text-ink-tertiary">Session ended</p>
            </li>
          </ol>
        </div>
      ) : (
        <div className="mt-6 max-w-3xl space-y-3">
          {firstVisit && (
            <p className="text-sm text-ink-secondary">
              First visit: {firstVisit.channel}, {firstVisit.source} / {firstVisit.medium}, {dateShort(firstVisit.started_at)}
            </p>
          )}
          {daysToBuy !== null && (
            <p className="text-sm text-ink-secondary">
              {count(daysToBuy)} {daysToBuy === 1 ? "day" : "days"} from first visit to purchase
            </p>
          )}
          <ol className="divide-y divide-ink/10 border border-ink/10 bg-paper-warm">
            {j.sessions.map((v, i) => (
              <li key={v.id} className="relative flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                <span className="text-[12px] tabular-nums text-ink-tertiary">{j.sessions.length - i}</span>
                <span className="text-sm tabular-nums text-ink">{dateTime(v.started_at)}</span>
                <span className="min-w-0 flex-1 text-sm text-ink-secondary">
                  {v.channel}, {v.source} / {v.medium}
                  {v.campaign ? `, ${v.campaign}` : ""}. Landed on <span className="break-all">{v.landing_path}</span>,{" "}
                  {count(v.pages)} {v.pages === 1 ? "page" : "pages"}.
                  {v.stitched && <span className="block text-[12px] text-ink-tertiary">Another device, linked by an order</span>}
                </span>
                <OutcomeBadge row={{ outcome: v.outcome, paid_total: v.paid_total, bag_value: 0 }} />
                {v.id === s.id ? (
                  <span className="text-[12px] text-ink-tertiary">This session</span>
                ) : (
                  <Link
                    href={`/admin/analytics/journeys/${v.id}${query}`}
                    className="text-[12px] underline decoration-ink/30 underline-offset-4 after:absolute after:inset-0 hover:decoration-ink"
                  >
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

export default function JourneyDetailClient({ sessionId }: { sessionId: string }) {
  const params = useSearchParams();
  const query = params.toString() ? `?${params.toString()}` : "";
  const { key, hydrated, setKey } = useAdminKey();
  const [rejected, setRejected] = useState(false);
  const onUnauthorized = useCallback(() => {
    setKey(null);
    setRejected(true);
  }, [setKey]);
  const api = useAdminApi<JourneyResponse>(
    key ? `/api/admin/analytics/journeys/${encodeURIComponent(sessionId)}` : null,
    key,
    onUnauthorized,
  );
  if (!hydrated) return null;

  const crumbs = (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-tertiary">
      <ol className="flex flex-wrap items-center gap-x-2">
        <li>
          <Link href={`/admin/analytics${query}`} className="inline-flex min-h-11 items-center hover:text-ink">
            Analytics
          </Link>
        </li>
        <li aria-hidden>›</li>
        <li>
          <Link href={`/admin/analytics/journeys${query}`} className="inline-flex min-h-11 items-center hover:text-ink">
            Journeys
          </Link>
        </li>
        {api.data?.status === "ok" && (
          <>
            <li aria-hidden>›</li>
            <li aria-current="page" className="text-ink">
              {dateTime(api.data.journey.session.started_at)}
            </li>
          </>
        )}
      </ol>
    </nav>
  );

  if (!key) {
    return (
      <>
        {crumbs}
        <AdminKeyGate rejected={rejected} onUnlock={(k) => { setRejected(false); setKey(k); }} />
      </>
    );
  }

  const data = api.data;
  return (
    <>
      {crumbs}
      {data?.status === "ok" ? (
        <Detail j={data.journey} query={query} />
      ) : data?.status === "not_found" || api.status === 404 ? (
        <div className="mt-8">
          <StatePanel
            title="This visit isn't available."
            body="It may be older than the data that's kept, or the link is incomplete."
            actions={
              <Link href={`/admin/analytics/journeys${query}`} className={ui.btnPrimary}>
                Back to journeys
              </Link>
            }
          />
        </div>
      ) : data?.status === "setup_required" ? (
        <div className="mt-8">
          <StatePanel
            icon={<IconDatabase className="size-6" />}
            title="Analytics isn't set up yet."
            body="Ask your developer to apply the analytics database migration, then check again."
            actions={<button type="button" onClick={api.refresh} className={ui.btnPrimary}>Check again</button>}
          />
        </div>
      ) : api.error ? (
        <div className="mt-8">
          <StatePanel
            title="Couldn't load this visit."
            body="Check the connection and try again."
            actions={<button type="button" onClick={api.refresh} className={ui.btnPrimary}>Try again</button>}
          />
        </div>
      ) : api.slow ? (
        <p className="mt-8 text-sm text-ink-tertiary" aria-busy>
          Loading the visit…
        </p>
      ) : null}
    </>
  );
}
