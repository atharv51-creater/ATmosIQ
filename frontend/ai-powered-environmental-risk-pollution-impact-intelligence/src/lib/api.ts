/* src/lib/api.ts – typed fetch wrapper around the FastAPI backend.
 * Endpoints mirror backend/app/main.py. Base URL comes from
 * VITE_API_BASE_URL (see .env). No extra npm dependencies required.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.detail ?? body?.error ?? detail;
    } catch {
      /* ignore non-json error bodies */
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return (await res.json()) as T;
}

export type RiskClass = "Low" | "Moderate" | "High" | "Critical";

export interface Driver {
  feature: string;
  label: string;
  value: number;
  shap: number;
  text: string;
}

export interface ZoneProperties {
  cell_id: string;
  horizon_days: number;
  date: string;
  score: number;
  risk_class: RiskClass;
  hazard: number;
  exposure: number;
  vulnerability: number;
  pm25: number;
  aqi_est: number;
  population: number;
  top_factors: string[];
  forecast_drivers?: Driver[];
}

export interface ZonesGeoJSON {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Polygon"; coordinates: number[][][] };
    properties: ZoneProperties;
  }[];
  meta: {
    horizon_days: number;
    weights: { hazard: number; exposure: number; vulnerability: number };
    custom_weights: boolean;
    data_date: string;
    count: number;
  };
}

export interface PriorityRow {
  cell_id: string;
  lat: number;
  lon: number;
  pop: number;
  industry_frac: number;
  emit_5km: number;
  top_factors: string[];
  score_now: number;
  score_h1: number;
  score_h2: number;
  score_h3: number;
  score_ranked: number;
  trend: number;
  risk_class: RiskClass;
  action: string;
  rank: number;
  priority_index: number;
}

export interface ZoneDetail {
  cell_id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  current: ZoneProperties;
  centroid: { lat: number; lon: number };
  priority: PriorityRow;
  scores: { h0: number; h1: number; h2: number; h3: number };
  components: { hazard: number; exposure: number; vulnerability: number };
  points: {
    pts_pollution: number;
    pts_emission: number;
    pts_population: number;
    pts_wind: number;
    pts_green: number;
    pts_heat: number;
  };
  top_factors: string[];
  forecast_drivers: Driver[];
  history: {
    dates: string[];
    pm25: number[];
    forecast_dates: string[];
    forecast_pm25: number[];
  };
}

export interface ForecastDay {
  horizon_days: 1 | 2 | 3;
  date: string;
  pm25: number;
  score: number;
  risk_class: RiskClass;
}

export interface ForecastRes {
  cell_id: string;
  history: { dates: string[]; pm25: number[] };
  forecast: ForecastDay[];
  forecast_drivers: Driver[];
}

export interface WindVec {
  cell_id: string;
  lat: number;
  lon: number;
  wind_u: number;
  wind_v: number;
  wind_speed: number;
  wind_dir: number;
}

export interface Summary {
  city: string;
  data_date: string;
  weights: { hazard: number; exposure: number; vulnerability: number };
  class_counts_now: Record<RiskClass, number>;
  mean_score_now: number;
  mean_score_h3: number;
  population_in_high_or_critical: number;
}

export interface ModelResult {
  MAE: number;
  RMSE: number;
  R2: number;
  AQI_category_acc: number;
}

export type HorizonResults = Record<
  "persistence" | "random_forest" | "xgboost" | "spatial_holdout",
  ModelResult
>;

export interface ModelMetrics {
  time_cut: string;
  n_features: number;
  xgboost: boolean;
  results: Record<"h1" | "h2" | "h3", HorizonResults>;
}

export interface ShapGlobal {
  method: string;
  global: { feature: string; label: string; mean_abs: number }[];
}

export interface Health {
  status: "ok" | "no_data";
  synthetic_data: boolean;
  data_dir: string;
  data_date?: string;
}

export interface Alert {
  alert_id: string;
  zone_id: string;
  level: "watch" | "warning" | "critical";
  message: string;
  created_at: string;
  score_now: number;
  score_peak: number;
  population: number;
  drivers: string[];
  recommended_action: string;
  rank: number;
}

/* ---------------- endpoint wrappers ---------------- */

export const health = () => request<Health>("/health");

export const regions = () =>
  request<{ regions: string[] }>("/regions").then((r) =>
    Array.isArray(r) ? { regions: r as unknown as string[] } : r
  );

export const summary = (region = "pune") =>
  request<Summary>(`/summary?region=${encodeURIComponent(region)}`);

export const zones = (
  horizon: number,
  weights?: { hazard?: number; exposure?: number; vulnerability?: number },
  minClass?: RiskClass,
  region?: string
) => {
  const qs = new URLSearchParams({ horizon: String(horizon) });
  if (weights) {
    if (weights.hazard !== undefined) qs.set("w_hazard", String(weights.hazard));
    if (weights.exposure !== undefined) qs.set("w_exposure", String(weights.exposure));
    if (weights.vulnerability !== undefined) qs.set("w_vulnerability", String(weights.vulnerability));
  }
  if (minClass) qs.set("min_class", minClass);
  if (region) qs.set("region", region);
  return request<ZonesGeoJSON>(`/zones?${qs.toString()}`);
};

export const zoneDetail = (cellId: string) =>
  request<ZoneDetail>(`/zones/${encodeURIComponent(cellId)}`);

export const forecast = (cellId: string) =>
  request<ForecastRes>(`/forecast/${encodeURIComponent(cellId)}`);

export const wind = (region?: string) =>
  request<WindVec[]>(`/wind${region ? `?region=${encodeURIComponent(region)}` : ""}`);

export const alerts = (minLevel = "watch") =>
  request<Alert[]>(`/alerts?min_level=${encodeURIComponent(minLevel)}`);

export const notifyAlert = (body: {
  channel: "telegram" | "email";
  min_level: "watch" | "warning" | "critical";
  dry_run: boolean;
}) =>
  request<{ sent: boolean; count: number; text: string; channel?: string }>(
    "/alerts/notify",
    { method: "POST", body: JSON.stringify(body) }
  );

export const modelMetrics = () => request<ModelMetrics>("/model/metrics");

export const modelShap = () => request<ShapGlobal>("/model/shap");

export const priorityQueue = (
  horizon?: number | null,
  limit?: number,
  riskClass?: string,
  weights?: { hazard?: number; exposure?: number; vulnerability?: number }
) => {
  const qs = new URLSearchParams();
  if (horizon !== undefined && horizon !== null) qs.set("horizon", String(horizon));
  if (limit) qs.set("limit", String(limit));
  if (riskClass) qs.set("risk_class", riskClass);
  if (weights) {
    if (weights.hazard !== undefined) qs.set("w_hazard", String(weights.hazard));
    if (weights.exposure !== undefined) qs.set("w_exposure", String(weights.exposure));
    if (weights.vulnerability !== undefined) qs.set("w_vulnerability", String(weights.vulnerability));
  }
  const suffix = qs.toString();
  return request<PriorityRow[]>(`/priority-queue${suffix ? `?${suffix}` : ""}`);
};

export const weightsWhatIf = (body: {
  hazard: number;
  exposure: number;
  vulnerability: number;
  horizon: number;
  top: number;
}) =>
  request<{
    weights: { hazard: number; exposure: number; vulnerability: number };
    horizon_days: number;
    class_counts: Record<RiskClass, number>;
    mean_score: number;
    zones: ZonesGeoJSON;
    priority_queue: PriorityRow[];
  }>("/weights", { method: "POST", body: JSON.stringify(body) });
