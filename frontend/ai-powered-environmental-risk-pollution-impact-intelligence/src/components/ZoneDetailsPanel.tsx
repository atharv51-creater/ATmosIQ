import React, { useState } from 'react';
import { ZoneDetail } from '../types';
import {
  X,
  MapPin,
  TrendingUp,
  Activity,
  Layers,
  Wind,
  Trees,
  Users,
  Factory,
  Flame,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

interface ZoneDetailsPanelProps {
  zone: ZoneDetail | null;
  loading: boolean;
  onClose: () => void;
}

export const ZoneDetailsPanel: React.FC<ZoneDetailsPanelProps> = ({ zone, loading, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-6 h-full flex flex-col items-center justify-center text-center shadow-sm transition-colors duration-300">
        <div className="w-8 h-8 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Retrieving zone intelligence data...</p>
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-6 h-full flex flex-col items-center justify-center text-center shadow-sm transition-colors duration-300">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
          <MapPin size={24} className="text-slate-500 dark:text-slate-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Zone Inspection Panel</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
          Select any hexagonal cell on the map or click a neighborhood from the Priority Queue to inspect drivers, SHAP feature attributions, and localized PM2.5 forecasts.
        </p>
      </div>
    );
  }

  const { current, scores, components, points, top_factors, forecast_drivers, history, centroid } = zone;

  const copyCellId = () => {
    navigator.clipboard.writeText(zone.cell_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 30-day History + 3-day Forecast points
  const historyDates = history?.dates || [];
  const historyPm25 = history?.pm25 || [];
  const forecastDates = history?.forecast_dates || [];
  const forecastPm25 = history?.forecast_pm25 || [];

  const allPoints: Array<{ date: string; val: number; isForecast: boolean }> = [
    ...historyDates.map((d, i) => ({ date: d, val: historyPm25[i] ?? 0, isForecast: false })),
    ...forecastDates.map((d, i) => ({ date: d, val: forecastPm25[i] ?? 0, isForecast: true }))
  ];

  const maxVal = Math.max(...allPoints.map((p) => p.val), 60);
  const minVal = Math.max(0, Math.min(...allPoints.map((p) => p.val)) - 5);

  const chartW = 340;
  const chartH = 110;

  const getX = (index: number) => {
    return (index / Math.max(1, allPoints.length - 1)) * (chartW - 24) + 12;
  };
  const getY = (val: number) => {
    const norm = (val - minVal) / Math.max(1, maxVal - minVal);
    return chartH - norm * (chartH - 24) - 12;
  };

  const histPoints = allPoints.filter((p) => !p.isForecast);
  const histPath = histPoints.length > 0
    ? histPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.val).toFixed(1)}`).join(' ')
    : '';

  const lastHistIdx = histPoints.length - 1;
  const fcPoints = [allPoints[lastHistIdx], ...allPoints.filter((p) => p.isForecast)].filter(Boolean);
  const fcPath = fcPoints.length > 0
    ? fcPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(lastHistIdx + i).toFixed(1)} ${getY(p.val).toFixed(1)}`).join(' ')
    : '';

  const whoThresholdY = getY(15); // WHO annual guidance line (15 ug/m3)

  return (
    <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-5 h-full overflow-y-auto space-y-4 shadow-sm text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Panel Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                current.risk_class === 'Critical'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                  : current.risk_class === 'High'
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50'
                  : current.risk_class === 'Moderate'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
              }`}
            >
              {current.risk_class} Risk
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              Score: <strong className="text-slate-900 dark:text-white text-sm">{current.score}</strong>/100
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{zone.cell_id}</span>
            <button
              onClick={copyCellId}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-0.5"
              title="Copy Cell ID"
            >
              {copied ? <Check size={12} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={12} />}
            </button>
            {centroid?.lat && centroid?.lon && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                ({centroid.lat.toFixed(3)}°N, {centroid.lon.toFixed(3)}°E)
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Recommended Action Protocol */}
      {zone.priority?.action && (
        <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span>Recommended Response Protocol</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
            {zone.priority.action}
          </p>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">PM2.5 (Latest Run)</span>
          <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
            {current.pm25} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">µg/m³</span>
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">AQI Equivalent: {current.aqi_est}</span>
        </div>

        <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Exposed Population</span>
          <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
            {current.population?.toLocaleString() ?? '—'}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
            Rank: #{zone.priority?.rank ?? '—'} of 136
          </span>
        </div>
      </div>

      {/* Horizon Forecast Strip */}
      {scores && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
            4-Horizon Score Progression
          </span>
          <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
            <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 p-2 rounded-md">
              <span className="text-[9px] text-slate-500 dark:text-slate-400 block">Today</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{scores.h0}</span>
            </div>
            <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 p-2 rounded-md">
              <span className="text-[9px] text-slate-500 dark:text-slate-400 block">+24h</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{scores.h1}</span>
            </div>
            <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 p-2 rounded-md">
              <span className="text-[9px] text-slate-500 dark:text-slate-400 block">+48h</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{scores.h2}</span>
            </div>
            <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 p-2 rounded-md">
              <span className="text-[9px] text-slate-500 dark:text-slate-400 block">+72h</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{scores.h3}</span>
            </div>
          </div>
        </div>
      )}

      {/* Score Formula Components */}
      {components && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            <span>Score Formula Breakdown</span>
            <span className="text-slate-400 dark:text-slate-500 font-mono">50% H + 30% E + 20% V</span>
          </div>
          <div className="space-y-2 bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 rounded-lg p-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1">
                <span>Hazard (Pollutants & AQI)</span>
                <span className="font-mono font-semibold">{(components.hazard * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, components.hazard * 100)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1">
                <span>Exposure (Population & Emitters)</span>
                <span className="font-mono font-semibold">{(components.exposure * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, components.exposure * 100)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1">
                <span>Vulnerability (Canopy & Heat)</span>
                <span className="font-mono font-semibold">{(components.vulnerability * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-500 dark:bg-indigo-400 h-full rounded-full"
                  style={{ width: `${Math.min(100, components.vulnerability * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Point Contributions */}
      {points && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
            Environmental Attribution Points
          </span>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 p-2 rounded-md">
              <Activity size={13} className="text-slate-600 dark:text-slate-400" />
              <div className="flex-1">
                <span className="text-[9px] text-slate-500 dark:text-slate-400 block">Pollution</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">+{points.pts_pollution ?? 0} pts</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 p-2 rounded-md">
              <Factory size={13} className="text-slate-600 dark:text-slate-400" />
              <div className="flex-1">
                <span className="text-[9px] text-slate-500 dark:text-slate-400 block">Emitters</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">+{points.pts_emission ?? 0} pts</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 p-2 rounded-md">
              <Users size={13} className="text-slate-600 dark:text-slate-400" />
              <div className="flex-1">
                <span className="text-[9px] text-slate-500 dark:text-slate-400 block">Density</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">+{points.pts_population ?? 0} pts</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 p-2 rounded-md">
              <Wind size={13} className="text-slate-600 dark:text-slate-400" />
              <div className="flex-1">
                <span className="text-[9px] text-slate-500 dark:text-slate-400 block">Plume Wind</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">+{points.pts_wind ?? 0} pts</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 p-2 rounded-md">
              <Trees size={13} className="text-slate-600 dark:text-slate-400" />
              <div className="flex-1">
                <span className="text-[9px] text-slate-500 dark:text-slate-400 block">Canopy Deficit</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">+{points.pts_green ?? 0} pts</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 p-2 rounded-md">
              <Flame size={13} className="text-slate-600 dark:text-slate-400" />
              <div className="flex-1">
                <span className="text-[9px] text-slate-500 dark:text-slate-400 block">Heat Stress</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">+{points.pts_heat ?? 0} pts</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dominant Risk Factors */}
      {top_factors && top_factors.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
            Dominant Risk Factors
          </span>
          <div className="space-y-1">
            {top_factors.map((f, i) => (
              <div
                key={i}
                className="text-xs bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 px-2.5 py-1.5 rounded-md text-slate-700 dark:text-slate-300 flex items-center justify-between"
              >
                <span>{f}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local SHAP Explanations */}
      {forecast_drivers && forecast_drivers.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
            ML Forecast Drivers (SHAP Local)
          </span>
          <div className="space-y-1">
            {forecast_drivers.map((d, i) => (
              <div
                key={i}
                className="text-xs bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 px-2.5 py-1.5 rounded-md text-slate-700 dark:text-slate-300 flex items-center justify-between"
              >
                <span>{d.label || d.feature}</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                  {d.shap > 0 ? `+${d.shap.toFixed(2)}` : d.shap.toFixed(2)} µg/m³
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 30-Day PM2.5 History + 3-Day Forecast Chart */}
      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            30-Day PM2.5 & Forecast (WHO 15 µg/m³)
          </span>
          <div className="flex items-center gap-2.5 text-[10px]">
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
              <span className="w-2.5 h-0.5 bg-slate-700 dark:bg-slate-300"></span> History
            </span>
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
              <span className="w-2.5 h-0.5 bg-emerald-600 dark:bg-emerald-400 border-dashed"></span> Forecast
            </span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800/80 rounded-lg p-3">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-24 overflow-visible">
            {/* Base line */}
            <line x1="0" y1={chartH - 12} x2={chartW} y2={chartH - 12} className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="1" />

            {/* WHO Guideline line (15 ug/m3) */}
            {whoThresholdY > 0 && whoThresholdY < chartH && (
              <line
                x1="0"
                y1={whoThresholdY}
                x2={chartW}
                y2={whoThresholdY}
                className="stroke-emerald-600 dark:stroke-emerald-400"
                strokeWidth="1"
                strokeDasharray="3,3"
                strokeOpacity="0.7"
              />
            )}

            {/* History trend path */}
            {histPath && (
              <path d={histPath} fill="none" className="stroke-slate-700 dark:stroke-slate-300" strokeWidth="2" strokeLinecap="round" />
            )}

            {/* Forecast dashed path */}
            {fcPath && (
              <path
                d={fcPath}
                fill="none"
                className="stroke-emerald-600 dark:stroke-emerald-400"
                strokeWidth="2"
                strokeDasharray="4,3"
                strokeLinecap="round"
              />
            )}

            {/* Dots on forecast */}
            {allPoints
              .filter((p) => p.isForecast)
              .map((p, i) => {
                const totalIdx = histPoints.length + i;
                return (
                  <circle
                    key={`fc-pt-${i}`}
                    cx={getX(totalIdx)}
                    cy={getY(p.val)}
                    r="3"
                    className="fill-emerald-600 dark:fill-emerald-400 stroke-white dark:stroke-slate-900"
                    strokeWidth="1.5"
                  />
                );
              })}
          </svg>
          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1">
            <span>{historyDates[0] || 'T-30d'}</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">Today: {current.pm25} µg/m³</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{forecastDates[2] || '+3d'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
