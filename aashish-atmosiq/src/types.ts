export interface User {
  id: string;
  name: string;
  email: string;
  organization?: string;
  role: 'admin' | 'analyst' | 'researcher' | 'observer';
  avatarInitials: string;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupCredentials {
  name: string;
  email: string;
  organization?: string;
  password: string;
  confirmPassword: string;
  agreeToTerms?: boolean;
}

// ---- Live data (API) ----
export interface FirePoint { lat: number; lon: number; frp: number; confidence: string; acquired: string; satellite: string; daynight: string; }
export interface FireResult { points: FirePoint[]; total: number; source: string; live: boolean; fetchedAt: string; }
export interface AqPoint { name: string; country: string; lat: number; lon: number; usAqi: number | null; pm25: number | null; pm10: number | null; category: string; time: string | null; }
export interface AqResult { points: AqPoint[]; source: string; live: boolean; fetchedAt: string; }
export interface DeforestationHotspot { id: string; name: string; country: string; lat: number; lon: number; biome: string; driver: string; severity: 'Critical' | 'High' | 'Moderate'; }
export interface DeforestationResult { points: DeforestationHotspot[]; source: string; live: boolean; fetchedAt: string; }
export interface Overview {
  fires: { total: number; shown: number; live: boolean; source: string; fetchedAt: string };
  airQuality: { stations: number; unhealthy: number; worst: { name: string; country: string; usAqi: number | null; category: string } | null; available: boolean; fetchedAt: string | null };
  deforestation: { hotspots: number; live: boolean };
}
export interface AiSummary {
  summary: string;
  source: 'gemini' | 'rule-based';
  generatedAt: string;
  context: { fires: { count: number; totalFrp: number; maxFrp: number; live: boolean }; radiusKm: number };
}
export interface SelectedPlace { name: string; lat: number; lon: number; kind: 'fire' | 'air' | 'forest' | 'point'; details: string[]; }

// ---- Pune ML risk pipeline (FastAPI via /api/v1/risk) ----
export type RiskClass = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface RiskWeights {
  hazard: number;
  exposure: number;
  vulnerability: number;
}

export interface RiskSummary {
  city: string;
  data_date: string;
  weights: RiskWeights;
  class_counts_now: Partial<Record<RiskClass, number>>;
  mean_score_now: number;
  mean_score_h3: number;
  population_in_high_or_critical: number;
}

export interface RiskZoneProps {
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
  forecast_drivers: string[];
}

export interface RiskGeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Polygon'; coordinates: number[][][] };
    properties: RiskZoneProps;
  }>;
  meta: {
    horizon_days: number;
    weights: RiskWeights;
    custom_weights: boolean;
    data_date: string;
    count: number;
  };
}

export interface PriorityRow {
  rank: number;
  cell_id: string;
  lat: number;
  lon: number;
  pop: number;
  industry_frac: number;
  emit_5km: number;
  score_now: number;
  score_h1: number;
  score_h2: number;
  score_h3: number;
  score_ranked: number;
  trend: number;
  risk_class: RiskClass;
  action: string;
  priority_index: number;
  top_factors: string[];
}

export interface ZoneDriver {
  feature: string;
  label: string;
  value: number;
  shap: number;
  text: string;
}

export interface ZoneDetail {
  cell_id: string;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  current: RiskZoneProps;
  centroid: { lat: number | null; lon: number | null };
  priority: Partial<PriorityRow>;
  scores: Record<string, number>;
  components: RiskWeights;
  points: Record<string, number>;
  top_factors: string[];
  forecast_drivers: ZoneDriver[];
  history: {
    dates: string[];
    pm25: number[];
    forecast_dates: string[];
    forecast_pm25: number[];
  };
}

export interface ZoneForecast {
  cell_id: string;
  history: { dates: string[]; pm25: number[] };
  forecast: Array<{ horizon_days: number; date: string; pm25: number; score: number; risk_class: RiskClass }>;
  forecast_drivers: ZoneDriver[];
}

export interface RiskZoneBrief {
  cell_id: string;
  text: string;
  source: 'gemini' | 'rule-based';
  generated_at: string;
}

export interface RiskAlert {
  alert_id: string;
  zone_id: string;
  level: 'watch' | 'warning' | 'critical';
  message: string;
  created_at: string;
  score_now: number;
  score_peak: number;
  population: number;
  drivers: string[];
  recommended_action: string;
  rank: number;
}

export interface ModelMetricSet {
  MAE: number;
  RMSE: number;
  R2: number;
  AQI_category_acc: number;
}

export interface ModelMetrics {
  time_cut: string;
  n_features: number;
  xgboost: boolean;
  results: Record<string, Record<string, ModelMetricSet>>;
}

export interface ShapGlobal {
  method: string;
  global: Array<{ feature: string; label: string; mean_abs: number }>;
}

export interface ModelStatus {
  engine: string;
  live_inference: boolean;
  joblib_available: boolean;
  model_files: Record<string, boolean>;
  feature_count: number;
  features_available: boolean;
  forecast_available: boolean;
  metrics_available: boolean;
  data_date: string | null;
  horizons: number[];
  load_error: string | null;
  checked_at: string;
}

export interface WhatIfResult {
  weights: RiskWeights;
  horizon_days: number;
  class_counts: Record<string, number>;
  mean_score: number;
  zones: RiskGeoJSON;
  priority_queue: PriorityRow[];
}

export const RISK_CLASS_COLORS: Record<RiskClass, string> = {
  Low: '#22c55e',
  Moderate: '#eab308',
  High: '#f97316',
  Critical: '#ef4444',
};
