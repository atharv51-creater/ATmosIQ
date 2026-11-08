import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Gauge,
  Layers,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingUp,
  Users,
  Wind,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { AdvancedMap, type MapMarker, type MapPolygon } from '@/components/ui/interactive-map';
import {
  RISK_CLASS_COLORS,
  type ModelMetrics,
  type ModelStatus,
  type PriorityRow,
  type RiskAlert,
  type RiskClass,
  type RiskGeoJSON,
  type RiskSummary,
  type RiskZoneBrief,
  type ShapGlobal,
  type WhatIfResult,
  type ZoneDetail,
  type ZoneForecast,
  type ZoneDriver,
} from '@/types';

const HORIZONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Now' },
  { value: 1, label: '+1 day' },
  { value: 2, label: '+2 days' },
  { value: 3, label: '+3 days' },
];

const CLASS_ORDER: RiskClass[] = ['Critical', 'High', 'Moderate', 'Low'];

const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: digits });

const classBadge = (cls: RiskClass | undefined) => {
  const color = cls ? RISK_CLASS_COLORS[cls] : '#64748b';
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border"
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}1a` }}
    >
      {cls ?? 'Unknown'}
    </span>
  );
};

const Kpi: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone?: string;
}> = ({ icon: Icon, label, value, hint, tone = 'text-emerald-400' }) => (
  <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
    <div className="flex items-center justify-between text-[14px] font-semibold text-[#A8BCAE]">
      <span>{label}</span>
      <Icon className={`w-5 h-5 ${tone}`} />
    </div>
    <div className={`text-[32px] font-bold leading-none my-1 ${tone}`}>{value}</div>
    <p className="text-[13px] text-[#9CAEA2] leading-snug">{hint}</p>
  </div>
);

export const PuneRiskPage: React.FC = () => {
  const [horizon, setHorizon] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [weights, setWeights] = useState({ hazard: 0.5, exposure: 0.3, vulnerability: 0.2 });
  const [whatIf, setWhatIf] = useState<WhatIfResult | null>(null);
  const [whatIfBusy, setWhatIfBusy] = useState(false);
  const [whatIfError, setWhatIfError] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>([18.5204, 73.8567]);
  const [brief, setBrief] = useState<RiskZoneBrief | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const summary = useApi<RiskSummary>('/risk/summary');
  const status = useApi<ModelStatus>('/risk/model-status');
  const zones = useApi<RiskGeoJSON>(`/risk/zones?region=pune&horizon=${horizon}`);
  const priority = useApi<PriorityRow[]>(`/risk/priority?horizon=${horizon}&limit=25`);
  const alerts = useApi<RiskAlert[]>('/risk/alerts?min_level=watch');
  const metrics = useApi<ModelMetrics>('/risk/metrics');
  const shap = useApi<ShapGlobal>('/risk/shap');
  const detail = useApi<ZoneDetail>(selectedId ? `/risk/zones/${selectedId}` : null);
  const forecast = useApi<ZoneForecast>(selectedId ? `/risk/forecast/${selectedId}` : null);

  const refreshAll = () => {
    summary.retry();
    status.retry();
    zones.retry();
    priority.retry();
    alerts.retry();
    metrics.retry();
    shap.retry();
    if (selectedId) {
      detail.retry();
      forecast.retry();
    }
  };

  useEffect(() => {
    if (!selectedId && priority.data && priority.data.length > 0) {
      setSelectedId(priority.data[0].cell_id);
    }
  }, [priority.data, selectedId]);

  useEffect(() => {
    setBrief(null);
    setBriefError(null);
  }, [selectedId]);

  const activeZones = whatIf?.zones ?? zones.data;

  const polygonLayer: MapPolygon[] = useMemo(() => {
    if (!activeZones) return [];
    return activeZones.features.map((f) => {
      const p = f.properties;
      const color = RISK_CLASS_COLORS[p.risk_class] ?? '#64748b';
      return {
        id: p.cell_id,
        name: `Zone ${p.cell_id}`,
        coordinates: f.geometry.coordinates as [number, number][][],
        color,
        fillOpacity: 0.32,
        strokeColor: color,
        strokeWidth: p.cell_id === selectedId ? 2.5 : 1,
        popup: `${p.cell_id}\nRisk ${p.score} (${p.risk_class}) · PM2.5 ${p.pm25} µg/m³ · Pop ${fmt(p.population)}`,
      };
    });
  }, [activeZones, selectedId]);

  const zoneMarkers: MapMarker[] = useMemo(() => {
    const rows = (whatIf?.priority_queue ?? priority.data ?? []).slice(0, 20);
    return rows.map((r) => ({
      id: r.cell_id,
      lat: r.lat,
      lon: r.lon,
      title: `Rank #${r.rank} · ${r.risk_class} risk`,
      category: r.risk_class === 'Critical' ? 'critical' : r.risk_class === 'High' ? 'high' : r.risk_class === 'Moderate' ? 'moderate' : 'low',
      color: RISK_CLASS_COLORS[r.risk_class],
      badge: `${r.score_ranked}`,
      description: r.action,
      measurements: [
        { label: 'Score now', value: r.score_now },
        { label: 'Peak +3d', value: r.score_h3 },
        { label: 'Population', value: fmt(r.pop) },
        { label: 'Emitters ≤5km', value: fmt(r.emit_5km, 1) },
      ],
      source: 'XGBoost risk pipeline',
      raw: r,
    }));
  }, [priority.data, whatIf]);

  const selectZone = (id: string, lat?: number | null, lon?: number | null) => {
    setSelectedId(id);
    if (typeof lat === 'number' && typeof lon === 'number') setFlyTo([lat, lon]);
  };

  const runWhatIf = async () => {
    setWhatIfBusy(true);
    setWhatIfError(null);
    try {
      const res = await api<WhatIfResult>('/risk/weights', {
        method: 'POST',
        json: { ...weights, horizon, top: 10 },
      });
      setWhatIf(res);
      zones.retry();
    } catch (e) {
      setWhatIfError(e instanceof ApiError ? e.message : 'Could not recompute scores.');
    } finally {
      setWhatIfBusy(false);
    }
  };

  const resetWhatIf = () => {
    setWeights({ hazard: 0.5, exposure: 0.3, vulnerability: 0.2 });
    setWhatIf(null);
    setWhatIfError(null);
  };

  const generateBrief = async () => {
    if (!selectedId) return;
    setBriefBusy(true);
    setBriefError(null);
    try {
      const res = await api<RiskZoneBrief>('/risk/zone-brief', {
        method: 'POST',
        json: { cell_id: selectedId },
      });
      setBrief(res);
    } catch (e) {
      setBriefError(e instanceof ApiError ? e.message : 'Could not generate the AI risk brief.');
    } finally {
      setBriefBusy(false);
    }
  };

  const counts = whatIf?.class_counts ?? summary.data?.class_counts_now ?? {};
  const meanScore = whatIf?.mean_score ?? summary.data?.mean_score_now;

  const forecastSeries = useMemo(() => {
    if (!forecast.data) return [];
    const hist = forecast.data.history.dates.map((d, i) => ({
      date: d,
      history: forecast.data!.history.pm25[i],
      forecast: null as number | null,
    }));
    const f = forecast.data.forecast.map((x) => ({ date: x.date, history: null as number | null, forecast: x.pm25 }));
    return [...hist, ...f];
  }, [forecast.data]);

  const classCountList = CLASS_ORDER.map((cls) => ({ cls, n: counts[cls] ?? 0 }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-emerald-950/80">
          <div>
            <div className="flex items-center gap-2.5">
              <BrainCircuit className="w-6 h-6 text-emerald-400" />
              <h2 className="text-[24px] sm:text-[28px] font-bold text-[#F2F5F2] tracking-tight">
                Pune Risk Intelligence · ML Pipeline
              </h2>
            </div>
            <p className="text-[14px] sm:text-[15px] text-[#9CAEA2] mt-1 max-w-3xl leading-relaxed">
              H3 res-7 hexagons (136 zones) scored from the XGBoost PM2.5 forecast, exposure and
              vulnerability. Served by the FastAPI risk service and proxied through the ATmosIQ API.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase border ${
                status.data?.live_inference
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                  : 'bg-amber-950/70 text-amber-300 border-amber-800/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              {status.data?.live_inference ? `Live ${status.data.engine} inference` : 'Precomputed model output'}
            </span>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono text-[#9CAEA2] bg-[#0D1914] border border-emerald-950">
              data {summary.data?.data_date ?? status.data?.data_date ?? '—'}
            </span>
            <button
              type="button"
              onClick={refreshAll}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[13px] font-medium text-emerald-300 border border-emerald-800/60 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {status.error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-[13px] text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{status.error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Kpi icon={Gauge} label="Mean Risk Score" value={meanScore != null ? String(meanScore) : '—'} hint="100 × (0.5·hazard + 0.3·exposure + 0.2·vulnerability)" tone="text-emerald-300" />
          <Kpi icon={ShieldAlert} label="High / Critical Zones" value={String((counts.High ?? 0) + (counts.Critical ?? 0))} hint={`${counts.Critical ?? 0} critical · ${counts.High ?? 0} high${whatIf ? ' (custom weights)' : ''}`} tone="text-orange-300" />
          <Kpi icon={Users} label="Population Exposed" value={fmt(summary.data?.population_in_high_or_critical)} hint="People living in High/Critical zones" tone="text-amber-300" />
          <Kpi icon={Cpu} label="Model Horizons" value="+1 / +2 / +3d" hint={`${status.data?.feature_count ?? 43} features · XGBoost · SHAP explained`} tone="text-cyan-300" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {classCountList.map(({ cls, n }) => (
            <span key={cls} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D1914] border border-emerald-950 text-[13px] text-[#CBDAD0]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RISK_CLASS_COLORS[cls] }} />
              <strong>{n}</strong> {cls}
            </span>
          ))}
          <span className="text-[12px] text-[#9CAEA2] ml-auto">{cityLabel(summary.data)}</span>
        </div>
      </div>

      {/* Map + zone detail */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 rounded-xl bg-[#101F18] border border-emerald-950 overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-emerald-950/80 bg-[#0D1914] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span className="text-[14px] font-semibold text-[#F2F5F2]">H3 Risk Choropleth</span>
              {zones.data?.meta && (
                <span className="text-[11px] text-[#9CAEA2] font-mono">
                  {zones.data.meta.count} zones · weights {Object.values(zones.data.meta.weights).join('/')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#101F18] border border-emerald-950">
              {HORIZONS.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => {
                    setHorizon(h.value);
                    setWhatIf(null);
                  }}
                  className={`px-3 py-1.5 rounded-md text-[13px] transition-colors cursor-pointer ${
                    horizon === h.value ? 'bg-[#174C34] text-emerald-200 font-semibold' : 'text-[#9CAEA2] hover:text-[#F2F5F2]'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full">
            <AdvancedMap
              center={[18.5204, 73.8567]}
              zoom={11}
              markers={zoneMarkers}
              polygons={polygonLayer}
              onMarkerClick={(m) => selectZone(String(m.id), m.lat ?? m.position?.[0], m.lon ?? m.position?.[1])}
              onMapClick={(c) => {
                const lat = Array.isArray(c) ? c[0] : c.lat;
                const lon = Array.isArray(c) ? c[1] : c.lon;
                setFlyTo([lat, lon]);
              }}
              enableClustering={false}
              enableSearch
              enableControls
              flyToLocation={flyTo}
              style={{ height: '600px', width: '100%', minHeight: '420px' }}
            />
          </div>

          <div className="p-3 border-t border-emerald-950/80 bg-[#0D1914] flex flex-wrap gap-3 text-[12px] text-[#9CAEA2]">
            <span className="font-semibold text-[#A8BCAE]">Risk class:</span>
            {CLASS_ORDER.map((cls) => (
              <span key={cls} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: RISK_CLASS_COLORS[cls] }} />
                {cls}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Top 20 priority zones marked
            </span>
          </div>
        </div>

        {/* Selected zone panel */}
        <div className="xl:col-span-4 rounded-xl bg-[#101F18] border border-emerald-950 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-emerald-950/80 bg-[#0D1914] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-[16px] font-bold text-[#F2F5F2]">Zone Intelligence</h3>
            </div>
            {detail.data && classBadge(detail.data.current.risk_class)}
          </div>

          {!selectedId ? (
            <div className="p-8 text-center text-[14px] text-[#9CAEA2]">Select a zone on the map or in the priority queue.</div>
          ) : detail.loading ? (
            <div className="p-8 text-center text-[14px] text-[#9CAEA2]">Loading zone {selectedId}…</div>
          ) : detail.error ? (
            <div className="p-5 text-[13px] text-red-300">{detail.error}</div>
          ) : detail.data ? (
            <div className="p-5 space-y-5">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#9CAEA2]">H3 cell</div>
                <div className="font-mono text-[13px] text-emerald-300 break-all">{detail.data.cell_id}</div>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-[44px] leading-none font-bold text-[#F2F5F2]">{detail.data.current.score}</span>
                  <span className="text-[13px] text-[#9CAEA2] pb-1.5">/ 100 risk score</span>
                </div>
                <div className="text-[13px] text-[#9CAEA2] mt-1">
                  PM2.5 <strong className="text-[#F2F5F2]">{detail.data.current.pm25} µg/m³</strong> · AQI est. {detail.data.current.aqi_est} · Pop {fmt(detail.data.current.population)}
                </div>
              </div>

              <div className="space-y-2">
                {(['hazard', 'exposure', 'vulnerability'] as const).map((k) => (
                  <div key={k}>
                    <div className="flex items-center justify-between text-[12px] text-[#A8BCAE] mb-1">
                      <span className="capitalize">{k}</span>
                      <span className="font-semibold text-[#F2F5F2]">{detail.data!.components[k].toFixed(3)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#0D1914] border border-emerald-950 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${Math.min(100, detail.data!.components[k] * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#9CAEA2] mb-2">Top risk drivers</div>
                <ul className="space-y-1.5">
                  {(detail.data.top_factors ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-[#CBDAD0]">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#9CAEA2] mb-2">Forecast drivers (SHAP)</div>
                <ul className="space-y-1.5">
                  {(detail.data.forecast_drivers ?? []).slice(0, 3).map((d: ZoneDriver) => (
                    <li key={d.feature} className="flex items-center justify-between gap-2 text-[12px] px-2.5 py-1.5 rounded-md bg-[#0D1914] border border-emerald-950/80">
                      <span className="text-[#CBDAD0] truncate">{d.label}</span>
                      <span className={`font-mono font-semibold shrink-0 ${d.shap >= 0 ? 'text-orange-300' : 'text-emerald-300'}`}>
                        {d.shap >= 0 ? '+' : ''}{d.shap} µg/m³
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {detail.data.priority?.action && (
                <div className="p-3 rounded-lg bg-[#14251C] border border-emerald-900/60">
                  <div className="text-[11px] uppercase tracking-wider text-emerald-300 mb-1">Recommended action</div>
                  <p className="text-[13px] text-[#CBDAD0] leading-relaxed">{detail.data.priority.action}</p>
                </div>
              )}

              <div className="pt-4 border-t border-emerald-950/80 space-y-3">
                <button
                  type="button"
                  onClick={generateBrief}
                  disabled={briefBusy}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#174C34] hover:bg-[#1F6244] disabled:opacity-60 text-[14px] font-semibold text-emerald-100 border border-emerald-600/60 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {briefBusy ? 'Analyzing zone…' : brief ? 'Regenerate AI risk brief' : 'Generate AI risk brief'}
                </button>
                {briefError && <p className="text-[12px] text-red-300">{briefError}</p>}
                {brief && (
                  <div className="p-3.5 rounded-lg bg-[#0D1914] border border-emerald-950/80 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          brief.source === 'gemini'
                            ? 'text-emerald-300 border-emerald-700/60 bg-emerald-950/60'
                            : 'text-amber-300 border-amber-700/60 bg-amber-950/50'
                        }`}
                      >
                        {brief.source === 'gemini' ? 'Gemini analysis' : 'Rule-based fallback'}
                      </span>
                      <span className="text-[10px] text-[#9CAEA2] font-mono">
                        {new Date(brief.generated_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#CBDAD0] leading-relaxed whitespace-pre-line">{brief.text}</p>
                    <p className="text-[10px] text-[#9CAEA2]/80">
                      Grounded in this zone&apos;s pipeline scores, SHAP drivers and XGBoost forecast.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Forecast + What-if */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl bg-[#101F18] border border-emerald-950 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-950/80 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="text-[18px] font-bold text-[#F2F5F2]">30-day PM2.5 + Model Forecast</h3>
            </div>
            <span className="text-[11px] text-[#9CAEA2] font-mono">{selectedId ?? 'no zone selected'}</span>
          </div>
          {forecast.loading ? (
            <div className="h-[240px] flex items-center justify-center text-[13px] text-[#9CAEA2]">Loading forecast…</div>
          ) : forecast.error ? (
            <div className="h-[240px] flex items-center justify-center text-[13px] text-red-300">{forecast.error}</div>
          ) : forecastSeries.length > 0 ? (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastSeries} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#123026" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: '#9CAEA2', fontSize: 10 }} interval={Math.max(1, Math.floor(forecastSeries.length / 6))} />
                  <YAxis tick={{ fill: '#9CAEA2', fontSize: 11 }} unit="" />
                  <Tooltip
                    contentStyle={{ background: '#0D1914', border: '1px solid #174C34', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#F2F5F2' }}
                  />
                  <ReferenceLine x={forecast.data?.history.dates.at(-1)} stroke="#475569" strokeDasharray="4 3" />
                  <Line type="monotone" dataKey="history" stroke="#34d399" strokeWidth={2} dot={false} name="Observed" />
                  <Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Forecast" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-[13px] text-[#9CAEA2]">No forecast available.</div>
          )}
          {forecast.data && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {forecast.data.forecast.map((f) => (
                <div key={f.horizon_days} className="p-3 rounded-lg bg-[#0D1914] border border-emerald-950/80">
                  <div className="text-[11px] text-[#9CAEA2]">{f.date} · +{f.horizon_days}d</div>
                  <div className="text-[24px] font-bold text-[#F2F5F2] leading-tight">{f.pm25}</div>
                  <div className="text-[11px] text-[#9CAEA2]">µg/m³ · {classBadge(f.risk_class)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-xl bg-[#101F18] border border-emerald-950 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-emerald-950/80">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h3 className="text-[18px] font-bold text-[#F2F5F2]">What-if Weight Lab</h3>
          </div>
          <p className="text-[13px] text-[#9CAEA2] leading-relaxed">
            Recompute the composite risk score live on the backend. Weights are normalised before scoring.
          </p>
          {(['hazard', 'exposure', 'vulnerability'] as const).map((k) => (
            <div key={k}>
              <div className="flex items-center justify-between text-[13px] text-[#CBDAD0] mb-1">
                <span className="capitalize">{k}</span>
                <span className="font-mono text-emerald-300">{weights[k].toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights[k]}
                onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={runWhatIf}
              disabled={whatIfBusy}
              className="flex-1 py-2.5 rounded-lg bg-[#174C34] hover:bg-[#1F6244] disabled:opacity-60 text-[14px] font-semibold text-emerald-100 border border-emerald-600/60 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {whatIfBusy ? 'Recomputing…' : 'Apply Weights'}
            </button>
            <button
              type="button"
              onClick={resetWhatIf}
              className="px-3 py-2.5 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[13px] text-[#A8BCAE] border border-emerald-900/60 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
          {whatIfError && <div className="text-[12px] text-red-300">{whatIfError}</div>}
          {whatIf && (
            <div className="p-3 rounded-lg bg-[#0D1914] border border-emerald-950/80 space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#9CAEA2]">New mean score</span>
                <strong className="text-emerald-300 text-[18px]">{whatIf.mean_score}</strong>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CLASS_ORDER.map((cls) => (
                  <span key={cls} className="px-2 py-0.5 rounded text-[11px] border" style={{ color: RISK_CLASS_COLORS[cls], borderColor: `${RISK_CLASS_COLORS[cls]}66` }}>
                    {cls}: {whatIf.class_counts[cls] ?? 0}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-[#9CAEA2]">Map and priority list now reflect the custom weighting.</p>
            </div>
          )}
        </div>
      </div>

      {/* Priority queue */}
      <div className="rounded-xl bg-[#101F18] border border-emerald-950 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-emerald-950/80 bg-[#0D1914] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <h3 className="text-[19px] font-bold text-[#F2F5F2]">Intervention Priority Queue</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
              score × population
            </span>
          </div>
          {priority.error && <span className="text-[12px] text-red-300">{priority.error}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#0A1712] border-b border-emerald-950 text-[#A8BCAE] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Zone</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Now</th>
                <th className="py-3 px-4">+1d</th>
                <th className="py-3 px-4">+3d</th>
                <th className="py-3 px-4">Population</th>
                <th className="py-3 px-4">Recommended action</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/60">
              {(priority.data ?? []).map((r) => (
                <tr
                  key={r.cell_id}
                  onClick={() => selectZone(r.cell_id, r.lat, r.lon)}
                  className={`cursor-pointer transition-colors ${selectedId === r.cell_id ? 'bg-[#142D21]' : 'hover:bg-[#14251C]/60'}`}
                >
                  <td className="py-3 px-4 font-mono text-[#9CAEA2]">{r.rank}</td>
                  <td className="py-3 px-4 font-mono text-[12px] text-[#CBDAD0]">{r.cell_id}</td>
                  <td className="py-3 px-4">{classBadge(r.risk_class)}</td>
                  <td className="py-3 px-4 font-semibold text-[#F2F5F2]">{r.score_now}</td>
                  <td className="py-3 px-4 text-[#CBDAD0]">{r.score_h1}</td>
                  <td className="py-3 px-4 text-[#CBDAD0]">{r.score_h3}</td>
                  <td className="py-3 px-4 text-[#CBDAD0]">{fmt(r.pop)}</td>
                  <td className="py-3 px-4 text-[#9CAEA2] max-w-[360px]">{r.action}</td>
                  <td className="py-3 px-4 text-emerald-400"><ChevronRight className="w-4 h-4" /></td>
                </tr>
              ))}
              {priority.loading && (
                <tr><td colSpan={9} className="py-8 text-center text-[#9CAEA2]">Loading priority queue…</td></tr>
              )}
              {!priority.loading && (priority.data ?? []).length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-[#9CAEA2]">No priority zones returned.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts + model validation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl bg-[#101F18] border border-emerald-950 p-5 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-emerald-950/80 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-[18px] font-bold text-[#F2F5F2]">Generated Risk Alerts</h3>
            <span className="ml-auto text-[11px] text-[#9CAEA2]">{alerts.data?.length ?? 0} active</span>
          </div>
          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {(alerts.data ?? []).map((a) => {
              const tone =
                a.level === 'critical'
                  ? 'border-red-900/60 bg-red-950/20 text-red-300'
                  : a.level === 'warning'
                    ? 'border-amber-900/60 bg-amber-950/20 text-amber-300'
                    : 'border-cyan-900/60 bg-cyan-950/20 text-cyan-300';
              return (
                <div key={a.alert_id} className={`p-3 rounded-lg border ${tone}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">{a.level}</span>
                    <button
                      type="button"
                      onClick={() => selectZone(a.zone_id)}
                      className="text-[11px] text-emerald-400 hover:underline cursor-pointer font-mono"
                    >
                      {a.zone_id}
                    </button>
                  </div>
                  <p className="text-[13px] text-[#CBDAD0] mt-1 leading-snug">{a.message}</p>
                  <p className="text-[11px] text-[#9CAEA2] mt-1">Pop {fmt(a.population)} · {a.recommended_action}</p>
                </div>
              );
            })}
            {alerts.loading && <p className="text-[13px] text-[#9CAEA2]">Loading alerts…</p>}
            {alerts.error && <p className="text-[13px] text-red-300">{alerts.error}</p>}
            {!alerts.loading && !alerts.error && (alerts.data ?? []).length === 0 && (
              <p className="text-[13px] text-[#9CAEA2]">No alerts above the watch threshold.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl bg-[#101F18] border border-emerald-950 p-5 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-emerald-950/80 mb-3">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-[18px] font-bold text-[#F2F5F2]">Model Validation</h3>
            <span className="ml-auto text-[11px] text-[#9CAEA2] font-mono">
              time cut {metrics.data?.time_cut ?? '—'} · {metrics.data?.n_features ?? '—'} features
            </span>
          </div>

          {metrics.data ? (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-left text-[12px]">
                <thead className="text-[#A8BCAE] uppercase tracking-wider text-[10px] border-b border-emerald-950">
                  <tr>
                    <th className="py-2 pr-3">Horizon</th>
                    <th className="py-2 pr-3">Model</th>
                    <th className="py-2 pr-3">MAE</th>
                    <th className="py-2 pr-3">RMSE</th>
                    <th className="py-2 pr-3">R²</th>
                    <th className="py-2">AQI acc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-950/50">
                  {Object.entries(metrics.data.results).flatMap(([h, models]) =>
                    Object.entries(models)
                      .filter(([name]) => ['persistence', 'xgboost', 'spatial_holdout'].includes(name))
                      .map(([name, m]) => (
                        <tr key={`${h}-${name}`} className={name === 'xgboost' ? 'bg-emerald-950/20' : ''}>
                          <td className="py-2 pr-3 text-[#9CAEA2]">+{h.replace('h', '')}d</td>
                          <td className={`py-2 pr-3 ${name === 'xgboost' ? 'text-emerald-300 font-semibold' : 'text-[#CBDAD0]'}`}>{name}</td>
                          <td className="py-2 pr-3 text-[#F2F5F2]">{m.MAE}</td>
                          <td className="py-2 pr-3 text-[#CBDAD0]">{m.RMSE}</td>
                          <td className="py-2 pr-3 text-[#CBDAD0]">{m.R2}</td>
                          <td className="py-2 text-[#CBDAD0]">{m.AQI_category_acc}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-[#9CAEA2] mb-4">{metrics.error ?? 'Loading validation metrics…'}</p>
          )}

          <div className="text-[11px] uppercase tracking-wider text-[#9CAEA2] mb-2">Global SHAP importance</div>
          <div className="space-y-1.5">
            {(shap.data?.global ?? []).slice(0, 8).map((s) => (
              <div key={s.feature} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-[11px] text-[#CBDAD0] truncate" title={s.label}>{s.label}</span>
                <div className="flex-1 h-2 rounded-full bg-[#0D1914] border border-emerald-950 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-500/70"
                    style={{ width: `${(s.mean_abs / Math.max(...(shap.data?.global ?? [{ mean_abs: 1 }]).map((x) => x.mean_abs))) * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right text-[11px] font-mono text-[#9CAEA2]">{s.mean_abs.toFixed(2)}</span>
              </div>
            ))}
            {shap.loading && <p className="text-[13px] text-[#9CAEA2]">Loading SHAP importance…</p>}
            {shap.error && <p className="text-[13px] text-red-300">{shap.error}</p>}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-5 rounded-xl bg-[#0D1914] border border-emerald-950/80 text-[13px] text-[#9CAEA2] leading-relaxed">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#F2F5F2]">Integration note: </span>
          This page is served by the ATmosIQ React app and reads the Python risk service through
          <code className="mx-1 px-1.5 py-0.5 rounded bg-black/40 text-emerald-300 border border-emerald-900/50">/api/v1/risk/*</code>
          (Express proxy → FastAPI on <code className="px-1.5 py-0.5 rounded bg-black/40 text-emerald-300 border border-emerald-900/50">:8000</code>).
          Scores come from the H3/XGBoost pipeline; SHAP drivers and +1/+2/+3 day PM2.5 forecasts are model outputs.
        </div>
      </div>
    </div>
  );
};

function cityLabel(s: RiskSummary | null): string {
  if (!s) return 'Pune Metro · 136 H3 zones';
  return `${s.city} · ${Object.values(s.class_counts_now).reduce((a, b) => a + (b ?? 0), 0)} H3 zones`;
}

export default PuneRiskPage;
