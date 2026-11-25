/**
 * Comparison with the previous period (design spec §5):
 *   - counts, money and time: relative %, except when the previous value is
 *     under 20, where the absolute change reads better ("▲ 9");
 *   - rates: percentage points ("▲ 0,4 pts");
 *   - flat within ±0.5% (or 0.1 pt): "— 0%";
 *   - colour follows whether up is good (bounce rate: up is bad), and the
 *     direction is always in text too (arrow, sign and screen-reader words).
 */

import { count, money, percent, points } from "./format";

export type DeltaKind = "count" | "money" | "rate" | "time";

export interface Delta {
  direction: "up" | "down" | "flat" | "none";
  tone: "good" | "bad" | "flat";
  text: string;
  sr: string;
}

export function computeDelta(
  value: number,
  previous: number | null,
  kind: DeltaKind,
  upIsGood = true,
): Delta {
  if (previous === null || !Number.isFinite(previous)) {
    return { direction: "none", tone: "flat", text: "No comparison", sr: "no previous period to compare" };
  }
  const diff = value - previous;
  let flat: boolean;
  let magnitude: string;
  if (kind === "rate") {
    flat = Math.abs(diff) < 0.001;
    magnitude = points(diff);
  } else if (previous < 20 && kind !== "time") {
    flat = Math.abs(diff) < 1e-9;
    magnitude = kind === "money" ? money(Math.abs(diff)) : count(Math.abs(diff));
  } else {
    const rel = previous === 0 ? (diff === 0 ? 0 : 1) : diff / previous;
    flat = Math.abs(rel) < 0.005;
    magnitude = percent(Math.abs(rel), Math.abs(rel) >= 0.1 ? 0 : 1);
  }
  if (flat) {
    const zero = kind === "rate" ? "0 pts" : previous < 20 && kind !== "time" ? "0" : "0%";
    return { direction: "flat", tone: "flat", text: `— ${zero}`, sr: "same as the previous period" };
  }
  const up = diff > 0;
  const good = up === upIsGood;
  return {
    direction: up ? "up" : "down",
    tone: good ? "good" : "bad",
    text: `${up ? "▲" : "▼"} ${magnitude}`,
    sr: `${up ? "up" : "down"} ${magnitude} on the previous period, ${good ? "better" : "worse"}`,
  };
}
