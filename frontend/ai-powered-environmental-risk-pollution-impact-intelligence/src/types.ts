export type RiskClass = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface SummaryData {
  city: string;
  region?: string;
  region_name?: string;
  total_zones?: number;
  data_date: string;
  weights: {
    hazard: number;
    exposure: number;
    vulnerability: number;
  };
  class_counts_now: Record<string, number>;
  mean_score_now: number;
  mean_score_h3: number;
  population_in_high_or_critical: number;
}

export interface Driver {
  feature: string;
  label: string;
  value: number;
  shap: number;
  text: string;
}

export interface RegionInfo {
  id: string;
  name: string;
  state: string;
  center: { lat: number; lng: number };
  zoom: number;
  description: string;
  zone_count?: number;
}

export interface ZoneProperties {
  cell_id: string;
  name?: string;
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
  forecast_drivers: Driver[];
  region?: string;
  region_name?: string;
}

export interface ZoneFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: ZoneProperties;
}

export interface ZonesGeoJson {
  type: 'FeatureCollection';
  features: ZoneFeature[];
  meta: {
    horizon_days: number;
    weights: {
      hazard: number;
      exposure: number;
      vulnerability: number;
    };
    custom_weights: boolean;
    data_date: string;
    count: number;
  };
}

export interface ZoneDetail {
  cell_id: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  current: ZoneProperties;
  centroid: {
    lat: number;
    lon: number;
  };
  scores: {
    h0: number;
    h1: number;
    h2: number;
    h3: number;
  };
  components: {
    hazard: number;
    exposure: number;
    vulnerability: number;
  };
  points: {
    pts_pollution?: number;
    pts_emission?: number;
    pts_population?: number;
    pts_wind?: number;
    pts_green?: number;
    pts_heat?: number;
  };
  top_factors: string[];
  forecast_drivers: Driver[];
  history: {
    dates: string[];
    pm25: number[];
    forecast_dates: string[];
    forecast_pm25: number[];
  };
  priority?: PriorityQueueItem;
}

export interface PriorityQueueItem {
  cell_id: string;
  name?: string;
  region?: string;
  region_name?: string;
  lat: number;
  lon: number;
  pop: number;
  industry_frac?: number;
  emit_5km?: number;
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

export interface WindVector {
  cell_id: string;
  name?: string;
  lat: number;
  lon: number;
  wind_u: number;
  wind_v: number;
  wind_speed: number;
  wind_dir: number;
  region?: string;
  region_name?: string;
  wind_speed_kmh?: number;
  wind_gusts_kmh?: number;
  wind_cardinal?: string;
  temperature_c?: number;
  feels_like_c?: number;
  humidity_pct?: number;
  pressure_hpa?: number;
  boundary_layer_height?: number;
  ventilation_coefficient?: number;
  dispersion_category?: string;
  inversion_status?: string;
  air_stagnation_index?: number;
}

export interface WindRoseItem {
  cardinal: string;
  angle: number;
  frequency_pct: number;
  avg_speed_kmh: number;
}

export interface HourlyWeatherForecast {
  hour: string;
  wind_speed_kmh: number;
  wind_gusts_kmh: number;
  temperature_c: number;
  relative_humidity_pct: number;
  boundary_layer_height_m: number;
  ventilation_index: number;
  dispersion_quality: string;
}

export interface WeatherStationItem {
  cell_id: string;
  name: string;
  lat: number;
  lon: number;
  wind_speed_kmh: number;
  wind_gusts_kmh: number;
  wind_cardinal: string;
  wind_dir: number;
  temperature_c: number;
  humidity_pct: number;
  boundary_layer_height: number;
  ventilation_coefficient: number;
  dispersion_category: string;
}

export interface SynopticWeatherReport {
  region_id: string;
  region_name: string;
  data_date: string;
  current: {
    wind_speed_kmh: number;
    wind_speed_ms: number;
    wind_gusts_kmh: number;
    wind_dir: number;
    wind_cardinal: string;
    temperature_c: number;
    feels_like_c: number;
    humidity_pct: number;
    pressure_hpa: number;
    boundary_layer_height_m: number;
    ventilation_coefficient: number;
    dispersion_category: string;
    inversion_status: string;
    air_stagnation_index: number;
    synoptic_overview: string;
    air_mass_trajectory: string;
  };
  wind_rose: WindRoseItem[];
  hourly_forecast: HourlyWeatherForecast[];
  stations: WeatherStationItem[];
}

export interface AlertItem {
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

export interface ModelMetrics {
  time_cut: string;
  n_features: number;
  xgboost?: boolean;
  results: {
    h1: Record<string, { MAE: number; RMSE: number; R2: number; AQI_category_acc: number }>;
    h2: Record<string, { MAE: number; RMSE: number; R2: number; AQI_category_acc: number }>;
    h3: Record<string, { MAE: number; RMSE: number; R2: number; AQI_category_acc: number }>;
  };
}

export interface ShapGlobal {
  method: string;
  global: Array<{
    feature: string;
    label: string;
    mean_abs: number;
  }>;
}

export type Emitter = [number, number, number]; // [lat, lon, weight]
