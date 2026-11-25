/**
 * Hand-built charts for the analytics overview (no chart library: no new
 * dependencies). Every chart prints its key numbers as text or offers "View
 * as table", gold is used only for data marks, the previous period is a grey
 * line or tick backed up by the legend and table, and nothing animates in.
 */

"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { Kpi, TrafficData } from "@/lib/analytics/api";
import { FUNNEL_STEPS, type FunnelStepKey } from "@/lib/analytics/events";
import type { FunnelRaw } from "@/lib/analytics/rpc";
import { SMALL_SAMPLE_SESSIONS } from "@/lib/analytics/types";
import { count, duration, money, moneyCompact, percent } from "../lib/format";
import type { DeltaKind } from "../lib/delta";
import { ui } from "../ui";
import { DefinitionTip, Delta, SmallSample } from "./core";

const GOLD_DARK = "#9a7b2f";
const ASH = "#b8b5b0";
const SMOKE = "#8a8a8e";
const STONE = "#e0ddd8";
const INK_TERTIARY = "#6b6b6b";

// ---- sizing -----------------------------------------------------------------

export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0);
      setWidth((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// ---- KPI strip --------------------------------------------------------------

export function Sparkline({ series }: { series: number[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const h = 24;
  const max = Math.max(1, ...series);
  const n = series.length;
  const pts =
    width > 8 && n > 1
      ? series.map((v, i) => [4 + (i * (width - 8)) / (n - 1), h - 4 - (v / max) * (h - 8)] as const)
      : [];
  return (
    <div ref={ref} className={ui.spark} aria-hidden>
      {pts.length > 1 && (
        <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
          <polyline
            points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke={SMOKE}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={4} fill={GOLD_DARK} stroke="#f5f3ef" strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}

export interface KpiTileDef {
  label: string;
  definition: string;
  kpi: Kpi;
  kind: DeltaKind;
  format: (v: number) => string;
  rate?: boolean;
  upIsGood?: boolean;
}

export function KpiStrip({ tiles, compare }: { tiles: KpiTileDef[]; compare: boolean }) {
  return (
    <dl className={ui.kpiGrid}>
      {tiles.map((t) => (
        <div key={t.label} className={ui.kpiTile}>
          <dt className={ui.kpiLabel}>
            <DefinitionTip term={t.label} definition={t.definition} />
          </dt>
          <dd className={ui.kpiValue}>
            {t.format(t.kpi.value)}
            <SmallSample show={Boolean(t.rate) && t.kpi.sample > 0 && t.kpi.sample < SMALL_SAMPLE_SESSIONS} />
          </dd>
          {compare && (
            <dd className={ui.kpiDeltaRow}>
              <Delta value={t.kpi.value} previous={t.kpi.previous} kind={t.kind} upIsGood={t.upIsGood ?? true} />
              <span className="text-ink-tertiary">vs previous period</span>
            </dd>
          )}
          <dd>
            <Sparkline series={t.kpi.series} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ---- view as table ----------------------------------------------------------

export function ViewAsTable({ shown, onToggle, controls }: { shown: boolean; onToggle: () => void; controls: string }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={shown} aria-controls={controls} className={ui.textBtn}>
      {shown ? "View as chart" : "View as table"}
    </button>
  );
}

// ---- generic table ----------------------------------------------------------

export interface Column<R> {
  key: string;
  header: ReactNode;
  numeric?: boolean;
  render: (row: R) => ReactNode;
  sortValue?: (row: R) => number | string;
  sticky?: boolean;
}

export function DataTable<R>({
  caption,
  columns,
  rows,
  rowKey,
  defaultSort,
  footer,
  labelledBy,
}: {
  caption: string;
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R, i: number) => string;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  footer?: ReactNode;
  labelledBy?: string;
}) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);
  const captionId = useId();
  return (
    <div role="region" tabIndex={0} aria-labelledby={labelledBy ?? captionId} className={ui.tableRegion}>
      <table className={ui.table}>
        <caption id={captionId} className="sr-only">
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const ariaSort = active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined;
              const cls = `${c.numeric ? ui.thNum : ui.th} ${c.sticky ? ui.stickyCell : ""}`;
              return (
                <th key={c.key} scope="col" aria-sort={ariaSort} className={cls}>
                  {c.sortValue ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 cursor-pointer items-center gap-1 uppercase hover:text-ink"
                      onClick={() =>
                        setSort((s) =>
                          s?.key === c.key
                            ? { key: c.key, dir: s.dir === "desc" ? "asc" : "desc" }
                            : { key: c.key, dir: c.numeric ? "desc" : "asc" },
                        )
                      }
                    >
                      {c.header}
                      {active && <span aria-hidden>{sort!.dir === "desc" ? "↓" : "↑"}</span>}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={ui.tbody}>
          {sorted.map((r, i) => (
            <tr key={rowKey(r, i)}>
              {columns.map((c) => (
                <td key={c.key} className={`${c.numeric ? ui.tdNum : ui.td} ${c.sticky ? ui.stickyCell : ""}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  );
}

export function BarInCell({ fraction, label }: { fraction: number; label: string }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="tabular-nums">{label}</span>
      <span className={ui.cellBar} aria-hidden>
        <span className={ui.cellBarFill} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

export function Meter({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className={ui.meterTrack} aria-hidden>
      <div className={ui.meterFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---- funnel -----------------------------------------------------------------

export const FUNNEL_LABELS: Record<FunnelStepKey, string> = {
  sessions: "Sessions",
  viewed_product: "Viewed a product",
  added_to_bag: "Added to bag",
  reached_checkout: "Reached checkout",
  entered_email: "Entered email",
  clicked_pay: "Clicked Pay",
  paid: "Paid",
};

export function FunnelChart({
  data,
  compare,
  showTable,
  tableId,
  drillHref,
}: {
  data: FunnelRaw;
  compare: boolean;
  showTable: boolean;
  tableId: string;
  drillHref: (step: FunnelStepKey) => string;
}) {
  const cur = data.current.map(Number);
  const prev = data.previous ? data.previous.map(Number) : null;
  const sessions = cur[0] || 0;
  const prevSessions = prev?.[0] || 0;
  let biggest = -1;
  let biggestDrop = 0;
  for (let i = 1; i < cur.length; i++) {
    const drop = cur[i - 1] - cur[i];
    if (drop > biggestDrop) {
      biggestDrop = drop;
      biggest = i;
    }
  }
  const small = sessions < SMALL_SAMPLE_SESSIONS;

  if (showTable) {
    return (
      <div id={tableId}>
        <DataTable
          caption="Funnel steps"
          rows={FUNNEL_STEPS.map((step, i) => ({ step, i }))}
          rowKey={(r) => r.step}
          columns={[
            { key: "step", header: "Step", render: (r) => FUNNEL_LABELS[r.step], sticky: true },
            { key: "n", header: "Sessions", numeric: true, render: (r) => count(cur[r.i] ?? 0) },
            { key: "pct", header: "% of sessions", numeric: true, render: (r) => percent((cur[r.i] ?? 0) / (sessions || 1)) },
            {
              key: "conv",
              header: "Step conversion",
              numeric: true,
              render: (r) => (r.i === 0 ? "—" : percent((cur[r.i] ?? 0) / (cur[r.i - 1] || 1))),
            },
            {
              key: "drop",
              header: "Dropped off",
              numeric: true,
              render: (r) => (r.i === 0 ? "—" : count((cur[r.i - 1] ?? 0) - (cur[r.i] ?? 0))),
            },
            {
              key: "prev",
              header: "Previous %",
              numeric: true,
              render: (r) => (prev ? percent((prev[r.i] ?? 0) / (prevSessions || 1)) : "—"),
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div id={tableId} className={ui.frame}>
      <ol className="divide-y divide-ink/10">
        {FUNNEL_STEPS.map((step, i) => {
          const n = cur[i] ?? 0;
          const share = sessions ? n / sessions : 0;
          const prevShare = prev && prevSessions ? (prev[i] ?? 0) / prevSessions : null;
          const continued = i > 0 ? (cur[i - 1] ? n / cur[i - 1] : 0) : null;
          const dropped = i > 0 ? (cur[i - 1] ?? 0) - n : null;
          return (
            <li key={step} className={ui.funnelRow}>
              <div className="flex items-baseline justify-between gap-3 md:block">
                <span className="text-sm text-ink">{FUNNEL_LABELS[step]}</span>
                <span className="text-sm tabular-nums text-ink-secondary md:hidden">
                  {count(n)} · {percent(share, 0)}
                </span>
              </div>
              <div className={ui.funnelTrack} aria-hidden>
                <div className={ui.funnelFill} style={{ width: `${share * 100}%` }} />
                {compare && prevShare !== null && (
                  <span className={ui.funnelTick} style={{ left: `calc(${prevShare * 100}% - 1px)` }} />
                )}
              </div>
              <div className="hidden text-right text-sm tabular-nums text-ink md:block">
                {count(n)} <span className="text-ink-secondary">{percent(share, 0)}</span>
                <SmallSample show={small} />
              </div>
              {i > 0 && continued !== null && dropped !== null && (
                <p className={ui.funnelLink}>
                  <span aria-hidden>↓</span>
                  <span>
                    {percent(continued, 0)} continued, {count(dropped)} dropped off
                  </span>
                  {i === biggest && <span className={ui.biggestDrop}>Biggest drop</span>}
                  {n > 0 && (
                    <Link href={drillHref(step)} className="ml-auto underline decoration-ink/30 underline-offset-4 hover:text-ink">
                      View sessions
                    </Link>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {compare && prev && (
        <p className="mt-3 flex flex-wrap gap-x-4 text-[12px] text-ink-tertiary">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-3 bg-gold-dark" /> This period
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-0.5 bg-ink-tertiary" /> Previous period
          </span>
        </p>
      )}
      {small && <p className="mt-2 text-[12px] text-ink-tertiary">* Small sample: fewer than 30 sessions</p>}
    </div>
  );
}

// ---- traffic charts ---------------------------------------------------------

function niceMax(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [0, 2, 4] };
  const rough = max / 3;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { top, ticks };
}

function LinePlot({
  width,
  height,
  current,
  previous,
  active,
  label,
  tickFormat,
}: {
  width: number;
  height: number;
  current: number[];
  previous: number[] | null;
  active: number | null;
  label: string;
  tickFormat: (v: number) => string;
}) {
  const left = 48;
  const right = 12;
  const top = 8;
  const plotW = Math.max(1, width - left - right);
  const plotH = height - top - 4;
  const all = [...current, ...(previous ?? [])];
  const { top: yTop, ticks } = niceMax(Math.max(0, ...all));
  const n = current.length;
  const x = (i: number) => left + (n > 1 ? (i * plotW) / (n - 1) : plotW / 2);
  const y = (v: number) => top + plotH - (v / yTop) * plotH;
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = n > 1 ? `${path(current)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke={STONE} strokeWidth={1} />
          <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={INK_TERTIARY} className="tabular-nums">
            {tickFormat(t)}
          </text>
        </g>
      ))}
      {area && <path d={area} fill="rgb(154 123 47 / 0.10)" />}
      {previous && n > 1 && <path d={path(previous)} fill="none" stroke={ASH} strokeWidth={2} />}
      {n > 1 && <path d={path(current)} fill="none" stroke={GOLD_DARK} strokeWidth={2} strokeLinejoin="round" />}
      {n === 1 && <circle cx={x(0)} cy={y(current[0])} r={4} fill={GOLD_DARK} />}
      {active !== null && (
        <line x1={x(active)} x2={x(active)} y1={top} y2={top + plotH} stroke="rgb(10 10 10 / 0.4)" strokeWidth={1} />
      )}
    </svg>
  );
}

export function TrafficCharts({
  data,
  compare,
  showTable,
  tableId,
}: {
  data: TrafficData;
  compare: boolean;
  showTable: boolean;
  tableId: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = data.current.length;
  const prev = compare ? data.previous : null;
  const narrow = width < 600;
  const plotH = narrow ? 160 : 200;
  const left = 48;
  const right = 12;
  const plotW = Math.max(1, width - left - right);
  const xOf = (i: number) => left + (n > 1 ? (i * plotW) / (n - 1) : plotW / 2);
  const maxTicks = narrow ? 4 : 8;
  const tickEvery = Math.max(1, Math.ceil(n / maxTicks));
  const live = useId();

  function indexFromX(clientX: number, target: Element) {
    const rect = target.getBoundingClientRect();
    const px = clientX - rect.left;
    const i = Math.round(((px - left) / plotW) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  }
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(n - 1);
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }
  const a = active !== null ? active : null;
  const announce =
    a !== null
      ? `${data.longLabels[a]}: ${count(data.current[a].sessions)} sessions${prev ? `, previous ${count(prev[a]?.sessions ?? 0)}` : ""}; ${money(data.current[a].revenue)} revenue`
      : "";

  if (showTable) {
    return (
      <div id={tableId} className="mt-6">
        <DataTable
          caption="Sessions and paid revenue per period"
          rows={data.current.map((c, i) => ({ c, i }))}
          rowKey={(r) => String(r.i)}
          columns={[
            { key: "d", header: data.granularity === "hour" ? "Hour" : "Date", render: (r) => data.longLabels[r.i], sticky: true },
            { key: "s", header: "Sessions", numeric: true, render: (r) => count(r.c.sessions) },
            { key: "ps", header: "Previous", numeric: true, render: (r) => (prev ? count(prev[r.i]?.sessions ?? 0) : "—") },
            { key: "r", header: "Revenue", numeric: true, render: (r) => money(r.c.revenue) },
            { key: "pr", header: "Previous", numeric: true, render: (r) => (prev ? money(prev[r.i]?.revenue ?? 0) : "—") },
            { key: "o", header: "Orders", numeric: true, render: (r) => count(r.c.orders) },
          ]}
        />
      </div>
    );
  }

  return (
    <div id={tableId} className="mt-6">
      <p className="mb-2 flex flex-wrap gap-x-4 text-[12px] text-ink-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 bg-gold-dark" /> This period
        </span>
        {prev && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-4 bg-ash" /> Previous period
          </span>
        )}
      </p>
      <div
        ref={ref}
        className="relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        tabIndex={0}
        role="group"
        aria-label="Sessions and paid revenue chart. Use the left and right arrow keys to move between days."
        aria-describedby={live}
        onKeyDown={onKey}
        onPointerMove={(e) => setActive(indexFromX(e.clientX, e.currentTarget))}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        onPointerDown={(e) => setActive(indexFromX(e.clientX, e.currentTarget))}
      >
        {width > 0 && (
          <>
            <h3 className={`${ui.h3} mb-1`}>{data.granularity === "hour" ? "Sessions per hour" : "Sessions per day"}</h3>
            <LinePlot
              width={width}
              height={plotH}
              current={data.current.map((p) => p.sessions)}
              previous={prev ? prev.map((p) => p.sessions) : null}
              active={a}
              label="Sessions over time"
              tickFormat={(v) => count(v)}
            />
            <h3 className={`${ui.h3} mb-1 mt-4`}>
              {data.granularity === "hour" ? "Paid revenue per hour" : "Paid revenue per day"}
            </h3>
            <LinePlot
              width={width}
              height={plotH}
              current={data.current.map((p) => p.revenue)}
              previous={prev ? prev.map((p) => p.revenue) : null}
              active={a}
              label="Paid revenue over time"
              tickFormat={moneyCompact}
            />
            <svg width={width} height={24} viewBox={`0 0 ${width} 24`} aria-hidden>
              <line x1={left} x2={width - right} y1={1} y2={1} stroke="rgb(10 10 10 / 0.25)" />
              {data.labels.map((l, i) =>
                i % tickEvery === 0 ? (
                  <text key={i} x={xOf(i)} y={18} textAnchor="middle" fontSize={12} fill={INK_TERTIARY}>
                    {l}
                  </text>
                ) : null,
              )}
            </svg>
            {a !== null && (
              <div
                className="pointer-events-none absolute top-0 z-30 bg-ink px-3 py-2 text-paper"
                style={{ left: Math.min(Math.max(0, xOf(a) + 12), Math.max(0, width - 200)) }}
              >
                <p className="text-[12px] text-paper/70">{data.longLabels[a]}</p>
                <p className="text-sm font-medium tabular-nums">
                  {count(data.current[a].sessions)} sessions
                  {prev ? <span className="font-normal text-paper/70"> (prev {count(prev[a]?.sessions ?? 0)})</span> : null}
                </p>
                <p className="text-sm font-medium tabular-nums">
                  {money(data.current[a].revenue)}
                  {prev ? <span className="font-normal text-paper/70"> (prev {money(prev[a]?.revenue ?? 0)})</span> : null}
                </p>
                <p className="text-[12px] text-paper/70">{count(data.current[a].orders)} orders</p>
              </div>
            )}
          </>
        )}
      </div>
      <p id={live} className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

// ---- heatmap ----------------------------------------------------------------

const HEAT = ["#c9a84c", "#b08f3d", "#9a7b2f", "#765d22", "#523f15"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function bins(values: number[]): number[] {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nz.length === 0) return [];
  return [0.2, 0.4, 0.6, 0.8].map((q) => nz[Math.min(nz.length - 1, Math.floor(q * nz.length))]);
}

export function Heatmap({ cells, showTable, tableId }: { cells: number[][]; showTable: boolean; tableId: string }) {
  const flat = cells.flat();
  const edges = bins(flat);
  const level = (v: number) => (v <= 0 ? -1 : edges.filter((e) => v > e).length);
  const color = (v: number) => (v <= 0 ? undefined : HEAT[Math.min(4, level(v))]);
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  const [announce, setAnnounce] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  let best = { d: 0, h: 0, v: 0 };
  cells.forEach((row, d) => row.forEach((v, h) => v > best.v && (best = { d, h, v })));
  const describe = (d: number, h: number) =>
    `${DAY_NAMES[d]} ${String(h).padStart(2, "0")}:00–${String((h + 1) % 24).padStart(2, "0")}:00, ${count(cells[d]?.[h] ?? 0)} sessions`;

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const [d, h] = focus;
    const next: [number, number] =
      e.key === "ArrowRight" ? [d, Math.min(23, h + 1)]
      : e.key === "ArrowLeft" ? [d, Math.max(0, h - 1)]
      : e.key === "ArrowDown" ? [Math.min(6, d + 1), h]
      : e.key === "ArrowUp" ? [Math.max(0, d - 1), h]
      : focus;
    if (next === focus) return;
    e.preventDefault();
    setFocus(next);
    setAnnounce(describe(next[0], next[1]));
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${next[0]}-${next[1]}"]`)?.focus();
  }

  if (showTable) {
    return (
      <div id={tableId}>
        <DataTable
          caption="Sessions by day and hour (SAST)"
          rows={cells.map((row, d) => ({ row, d }))}
          rowKey={(r) => String(r.d)}
          columns={[
            { key: "day", header: "Day", render: (r) => DAY_SHORT[r.d], sticky: true },
            ...Array.from({ length: 24 }, (_, h) => ({
              key: `h${h}`,
              header: String(h).padStart(2, "0"),
              numeric: true,
              render: (r: { row: number[]; d: number }) => count(r.row[h] ?? 0),
            })),
          ]}
        />
      </div>
    );
  }

  return (
    <div id={tableId} className={ui.frame}>
      {best.v > 0 && (
        <p className="mb-3 text-sm text-ink">
          Busiest: {DAY_NAMES[best.d]}s, {String(best.h).padStart(2, "0")}:00–{String((best.h + 1) % 24).padStart(2, "0")}:00
        </p>
      )}
      <div
        ref={gridRef}
        role="grid"
        aria-label="Sessions by day and hour, SAST. Use the arrow keys to move between cells."
        onKeyDown={onKey}
        className="overflow-x-auto"
      >
        <div className="hidden md:block">
          {cells.map((row, d) => (
            <div key={d} role="row" className="grid grid-cols-[3rem_repeat(24,minmax(0,1fr))] gap-0.5 pb-0.5">
              <span role="rowheader" className="self-center text-[12px] text-ink-tertiary">
                {DAY_SHORT[d]}
              </span>
              {row.map((v, h) => (
                <div
                  key={h}
                  role="gridcell"
                  data-cell={`${d}-${h}`}
                  tabIndex={focus[0] === d && focus[1] === h ? 0 : -1}
                  aria-label={describe(d, h)}
                  onFocus={() => setFocus([d, h])}
                  className="aspect-square focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
                  style={{ background: color(v) ?? "rgb(10 10 10 / 0.04)" }}
                />
              ))}
            </div>
          ))}
          <div className="grid grid-cols-[3rem_repeat(24,minmax(0,1fr))] gap-0.5" aria-hidden>
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center text-[12px] text-ink-tertiary">
                {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
              </span>
            ))}
          </div>
        </div>
        <div className="md:hidden" aria-hidden>
          <div className="grid grid-cols-[2.5rem_repeat(7,1rem)] gap-0.5 pb-1">
            <span />
            {DAY_SHORT.map((d) => (
              <span key={d} className="text-center text-[12px] text-ink-tertiary">
                {d[0]}
              </span>
            ))}
          </div>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="grid grid-cols-[2.5rem_repeat(7,1rem)] gap-0.5 pb-0.5">
              <span className="text-[12px] leading-4 text-ink-tertiary">{h % 3 === 0 ? `${String(h).padStart(2, "0")}:00` : ""}</span>
              {cells.map((row, d) => (
                <span key={d} className="size-4" style={{ background: color(row[h] ?? 0) ?? "rgb(10 10 10 / 0.04)" }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-tertiary">
        <span>Fewer</span>
        {HEAT.map((c) => (
          <span key={c} aria-hidden className="inline-block size-3" style={{ background: c }} />
        ))}
        <span>More</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

export function durationText(ms: number) {
  return duration(ms);
}
