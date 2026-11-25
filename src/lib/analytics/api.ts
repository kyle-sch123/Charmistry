/**
 * Response shapes of the admin analytics APIs, shared by the route handlers
 * and the admin dashboard.
 *
 * Why per-section results: the overview calls one database function per
 * section in parallel, and a failing section must not blank the page. Each
 * section is therefore `{ ok: true, data }` or `{ ok: false, error }`, and the
 * UI renders an error panel inside just that section.
 */

import type { DeviceClass } from "./types";
import type { ResolvedRange } from "./range";
import type {
  AcquisitionRaw,
  DevicesRaw,
  FunnelRaw,
  GeographyRaw,
  HealthRaw,
  JourneyRaw,
  JourneysRaw,
  PagesRaw,
  ProductsRaw,
  PromotionsRaw,
  SearchRaw,
  WhenRaw,
} from "./rpc";
import type { SetupRequired } from "./setup";

export type SectionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

/** `sample` is the denominator in sessions (small-sample marker under 30). */
export interface Kpi {
  value: number;
  previous: number | null;
  series: number[];
  sample: number;
}

export interface SummaryData {
  revenue: Kpi;
  orders: Kpi;
  conversionRate: Kpi;
  aov: Kpi;
  sessions: Kpi;
}

export interface TrafficPoint {
  sessions: number;
  revenue: number;
  orders: number;
}

export interface TrafficData {
  engagement: {
    uniqueVisitors: Kpi;
    addToBagRate: Kpi;
    avgEngagedMs: Kpi;
    bounceRate: Kpi;
  };
  granularity: "hour" | "day";
  /** "27 Oct" or "00".."23" */
  labels: string[];
  /** Full SAST date of each bucket for tooltips, e.g. "Mon 27 Oct" or "27 Oct, 14:00". */
  longLabels: string[];
  current: TrafficPoint[];
  previous: TrafficPoint[] | null;
}

export interface ProductFlag {
  key: string;
  name: string;
  slug: string | null;
  views: number;
  viewToPurchase: number;
}

export interface ProductsData extends ProductsRaw {
  medianViewToPurchase: number | null;
  eligible: number;
  flags: { promote: ProductFlag[]; closerLook: ProductFlag[] };
}

export interface OverviewSections {
  summary: SectionResult<SummaryData>;
  traffic: SectionResult<TrafficData>;
  funnel: SectionResult<FunnelRaw>;
  acquisition: SectionResult<AcquisitionRaw>;
  products: SectionResult<ProductsData>;
  promotions: SectionResult<PromotionsRaw>;
  devices: SectionResult<DevicesRaw>;
  pages: SectionResult<PagesRaw>;
  search: SectionResult<SearchRaw>;
  when: SectionResult<WhenRaw>;
  geography: SectionResult<GeographyRaw>;
}

export interface OverviewOk {
  status: "ok";
  generatedAt: string;
  range: ResolvedRange;
  device: DeviceClass | null;
  health: SectionResult<HealthRaw>;
  sections: OverviewSections;
}

export type OverviewResponse = OverviewOk | SetupRequired;

export type JourneysResponse =
  | ({ status: "ok"; page: number; pageSize: number; range: ResolvedRange | null } & JourneysRaw)
  | SetupRequired;

export type JourneyResponse =
  | { status: "ok"; journey: JourneyRaw }
  | { status: "not_found" }
  | SetupRequired;

export type IntegrationKey = "first_party" | "ga4" | "meta" | "klaviyo" | "resend";
export type IntegrationState =
  | "connected"
  | "limited"
  | "not_configured"
  | "not_receiving";

export interface IntegrationStatus {
  key: IntegrationKey;
  state: IntegrationState;
  reason: "no_capi" | "forbidden" | "timeout" | "error" | null;
  metrics: {
    emailRevenue?: number;
    emailsSent24h?: number;
    emailsCapped?: boolean;
  };
}

export interface IntegrationsResponse {
  status: "ok";
  checkedAt: string;
  integrations: IntegrationStatus[];
}

/** Admin API error body (bad filters). */
export interface ApiError {
  status: "error";
  error: "invalid_range" | "end_before_start" | "too_long" | "bad_request";
}
