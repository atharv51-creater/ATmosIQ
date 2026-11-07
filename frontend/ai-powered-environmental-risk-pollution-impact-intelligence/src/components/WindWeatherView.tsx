import React, { useState } from 'react';
import { SynopticWeatherReport, WindVector, RegionInfo } from '../types';
import {
  Wind,
  Compass,
  Thermometer,
  Droplets,
  Gauge,
  ArrowUpRight,
  ShieldAlert,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  Eye,
  Activity,
  CheckCircle2,
  TrendingUp,
  MapPin,
  ChevronRight
} from 'lucide-react';

interface WindWeatherViewProps {
  weather: SynopticWeatherReport | null;
  windData: WindVector[] | null;
  selectedRegion: string;
  regionsList: RegionInfo[];
  onSelectRegion: (regId: string) => void;
  onSelectZone: (cellId: string) => void;
}

export const WindWeatherView: React.FC<WindWeatherViewProps> = ({
  weather,
  windData,
  selectedRegion,
  regionsList,
  onSelectRegion,
  onSelectZone,
}) => {
  const [forecastMetric, setForecastMetric] = useState<'wind' | 'pblh' | 'temp' | 'ventilation'>('wind');
  const [stationSearch, setStationSearch] = useState('');

  if (!weather) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
        <Wind className="mx-auto text-slate-400 animate-spin" size={32} />
        <h3 className="text-sm font-semibold text-slate-800">Loading Atmospheric & Weather Telemetry...</h3>
        <p className="text-xs text-slate-500">Fetching synoptic weather models and boundary layer calculations.</p>
      </div>
    );
  }

  const { current, wind_rose, hourly_forecast, stations } = weather;

  // Filter stations
  const filteredStations = (stations || []).filter((s) =>
    s.name.toLowerCase().includes(stationSearch.toLowerCase()) ||
    s.cell_id.toLowerCase().includes(stationSearch.toLowerCase())
  );

  // Beaufort description
  const getBeaufortCategory = (kmh: number) => {
    if (kmh < 2) return { label: 'Calm', desc: 'Smoke rises vertically', color: 'bg-slate-100 text-slate-700' };
    if (kmh < 6) return { label: 'Light Air', desc: 'Direction shown by smoke drift', color: 'bg-sky-50 text-sky-700' };
    if (kmh < 12) return { label: 'Light Breeze', desc: 'Wind felt on face; leaves rustle', color: 'bg-blue-50 text-blue-700' };
    if (kmh < 20) return { label: 'Gentle Breeze', desc: 'Leaves & small twigs in motion', color: 'bg-emerald-50 text-emerald-700' };
    if (kmh < 29) return { label: 'Moderate Breeze', desc: 'Dust & paper raised', color: 'bg-amber-50 text-amber-700' };
    return { label: 'Fresh / Strong', desc: 'Small trees begin to sway', color: 'bg-rose-50 text-rose-700' };
  };

  const beaufort = getBeaufortCategory(current.wind_speed_kmh);

  return (
    <div className="space-y-6">
      {/* Executive Synoptic Air Mass Header */}
      <div className="bg-white dark:bg-[#0c1322] border border-slate-200/90 dark:border-slate-800 border-l-[4px] border-l-sky-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse"></span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Synoptic Weather & Atmospheric Dispersion Intelligence
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                {weather.region_name}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              CPCB / SAFAR Meteorological Dispersion Model · Planetary Boundary Layer Dynamics
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Air Basin:</span>
            <select
              value={selectedRegion}
              onChange={(e) => onSelectRegion(e.target.value)}
              className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-400 dark:focus:border-sky-500 cursor-pointer"
            >
              <option value="all" className="dark:bg-[#080d19] dark:text-slate-200">All India (National Composite)</option>
              {regionsList.map((r) => (
                <option key={r.id} value={r.id} className="dark:bg-[#080d19] dark:text-slate-200">
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Narrative Synoptic Bulletins */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50/80 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
              <div className="w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/80 flex items-center justify-center text-sky-700 dark:text-sky-300 shrink-0">
                <Wind size={13} />
              </div>
              <span>Synoptic Dispersion Bulletin</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {current.synoptic_overview}
            </p>
          </div>

          <div className="bg-slate-50/80 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
              <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shrink-0">
                <Compass size={13} />
              </div>
              <span>Air Mass Origin & Trajectory</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {current.air_mass_trajectory}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Core Atmospheric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Wind Vector */}
        <div className="bg-white dark:bg-[#0c1322] border border-slate-200/90 dark:border-slate-800 border-t-[3px] border-t-sky-500 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Surface Wind Velocity</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Wind size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                {current.wind_speed_kmh}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">km/h</span>
              <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                ({current.wind_speed_ms} m/s)
              </span>
            </div>
            {/* Animated Compass Bearing */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              <span
                style={{ transform: `rotate(${current.wind_dir}deg)` }}
                className="inline-block transition-transform duration-500 text-sky-600 dark:text-sky-400 font-bold"
              >
                ↑
              </span>
              <span>{current.wind_cardinal}</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">Peak Gusts: <strong className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{current.wind_gusts_kmh} km/h</strong></span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${beaufort.color} dark:bg-slate-800 dark:text-slate-200`}>
              {beaufort.label}
            </span>
          </div>
        </div>

        {/* Card 2: Ventilation Index */}
        <div className="bg-white dark:bg-[#0c1322] border border-slate-200/90 dark:border-slate-800 border-t-[3px] border-t-indigo-500 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ventilation Coeff (Vc)</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Gauge size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                {current.ventilation_coefficient.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">m²/s</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                current.ventilation_coefficient < 2000
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : current.ventilation_coefficient < 5500
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}
            >
              {current.dispersion_category}
            </span>
          </div>
          {/* CPCB Threshold Gauge Bar */}
          <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-1.5 overflow-hidden flex">
              <div
                style={{
                  width: `${Math.min(100, (current.ventilation_coefficient / 8000) * 100)}%`
                }}
                className={`h-full ${
                  current.ventilation_coefficient < 2000
                    ? 'bg-rose-500'
                    : current.ventilation_coefficient < 5500
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
              <span>0 (Stagnant)</span>
              <span>2000 (Threshold)</span>
              <span>8000+</span>
            </div>
          </div>
        </div>

        {/* Card 3: Planetary Boundary Layer Height (PBLH) */}
        <div className="bg-white dark:bg-[#0c1322] border border-slate-200/90 dark:border-slate-800 border-t-[3px] border-t-cyan-500 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Boundary Layer (PBLH)</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200/60 dark:border-cyan-800/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Layers size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                {current.boundary_layer_height_m}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">meters</span>
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#080d19] border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">
              Mixing Depth
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">Inversion Status:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
              {current.inversion_status}
            </span>
          </div>
        </div>

        {/* Card 4: Thermodynamic State */}
        <div className="bg-white dark:bg-[#0c1322] border border-slate-200/90 dark:border-slate-800 border-t-[3px] border-t-amber-500 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ambient Thermodynamics</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Thermometer size={16} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                {current.temperature_c}°
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">C</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                (Feels {current.feels_like_c}°)
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300 font-mono font-semibold bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
              <Droplets size={12} className="text-blue-500 dark:text-blue-400" />
              <span>{current.humidity_pct}% RH</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Pressure: <strong className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{current.pressure_hpa} hPa</strong></span>
            <span>Stagnation: <strong className="font-mono text-rose-600 dark:text-rose-400 font-semibold">{current.air_stagnation_index}/100</strong></span>
          </div>
        </div>
      </div>

      {/* Two Column: Wind Rose Polar Compass + 24-Hour Diurnal Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Wind Rose Polar Directional Distribution */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0c1322] border border-slate-200/90 dark:border-slate-800 border-t-[3px] border-t-sky-600 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Wind Rose (Polar Distribution)</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Directional frequency & mean velocity across 16 cardinal sectors</p>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#080d19] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              Prevailing: {current.wind_cardinal} ({current.wind_dir}°)
            </span>
          </div>

          {/* Graphical Compass Rose representation */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-56 h-56 flex items-center justify-center">
              {/* Concentric frequency rings */}
              <div className="absolute w-52 h-52 rounded-full border border-dashed border-slate-200 dark:border-slate-800"></div>
              <div className="absolute w-36 h-36 rounded-full border border-dashed border-slate-200 dark:border-slate-800"></div>
              <div className="absolute w-20 h-20 rounded-full border border-dashed border-slate-200 dark:border-slate-800"></div>
              <div className="absolute w-3 h-3 rounded-full bg-slate-900 dark:bg-sky-400 z-10"></div>

              {/* Cardinal axis labels */}
              <span className="absolute top-0 text-[10px] font-bold font-mono text-slate-600 dark:text-slate-400">N</span>
              <span className="absolute bottom-0 text-[10px] font-bold font-mono text-slate-600 dark:text-slate-400">S</span>
              <span className="absolute right-0 text-[10px] font-bold font-mono text-slate-600 dark:text-slate-400">E</span>
              <span className="absolute left-0 text-[10px] font-bold font-mono text-slate-600 dark:text-slate-400">W</span>

              {/* 16 radiating bars */}
              {wind_rose.map((wr) => {
                const rad = ((wr.angle - 90) * Math.PI) / 180;
                const length = Math.max(12, (wr.frequency_pct / 35) * 85);
                const isDominant = wr.cardinal === current.wind_cardinal;

                return (
                  <div
                    key={wr.cardinal}
                    style={{
                      transform: `rotate(${wr.angle}deg)`,
                      transformOrigin: 'bottom center',
                      height: `${length}px`,
                      bottom: '50%'
                    }}
                    className={`absolute w-2 rounded-t-sm transition-all duration-300 ${
                      isDominant
                        ? 'bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                        : wr.frequency_pct > 10
                        ? 'bg-sky-400/80 dark:bg-sky-400/60'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                    title={`${wr.cardinal} (${wr.angle}°): ${wr.frequency_pct}% freq, avg ${wr.avg_speed_kmh} km/h`}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span>
                <span>Dominant Vector</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-400/80"></span>
                <span>Secondary Corridor</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-700"></span>
                <span>Minor Flow</span>
              </span>
            </div>
          </div>

          {/* Quick Frequency Table */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
            {wind_rose.filter(wr => wr.frequency_pct > 5).slice(0, 8).map(wr => (
              <div key={wr.cardinal} className="bg-slate-50 dark:bg-[#080d19] p-1.5 rounded border border-slate-100 dark:border-slate-800 flex justify-between">
                <span className="font-bold text-slate-900 dark:text-white">{wr.cardinal}</span>
                <span>{wr.frequency_pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 24-Hour Diurnal Atmospheric Dynamics Chart */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0c1322] border border-slate-200/90 dark:border-slate-800 border-t-[3px] border-t-indigo-600 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">24-Hour Diurnal Dispersion Cycle</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Daytime vertical mixing breakdown vs nocturnal stagnation traps</p>
            </div>

            {/* Metric Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-[#080d19] p-0.5 rounded-lg text-xs border border-transparent dark:border-slate-800">
              {[
                { id: 'wind', label: 'Wind (km/h)' },
                { id: 'pblh', label: 'PBLH (m)' },
                { id: 'ventilation', label: 'Ventilation' },
                { id: 'temp', label: 'Temp (°C)' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setForecastMetric(m.id as any)}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    forecastMetric === m.id
                      ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-48 flex items-end gap-2 pt-6 pb-2 px-1 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
            {hourly_forecast.map((hf) => {
              let val = hf.wind_speed_kmh;
              let maxVal = 25;
              let unit = 'km/h';
              let barColor = 'bg-sky-500';

              if (forecastMetric === 'pblh') {
                val = hf.boundary_layer_height_m;
                maxVal = 1400;
                unit = 'm';
                barColor = 'bg-cyan-600';
              } else if (forecastMetric === 'ventilation') {
                val = hf.ventilation_index;
                maxVal = 7000;
                unit = 'm²/s';
                barColor = val < 2000 ? 'bg-rose-500' : val < 5000 ? 'bg-amber-500' : 'bg-emerald-500';
              } else if (forecastMetric === 'temp') {
                val = hf.temperature_c;
                maxVal = 40;
                unit = '°C';
                barColor = 'bg-amber-500';
              }

              const heightPct = Math.max(10, Math.min(100, (val / maxVal) * 100));

              return (
                <div key={hf.hour} className="flex-1 min-w-[28px] flex flex-col items-center gap-1 h-full justify-end group">
                  <span className="text-[10px] font-mono font-semibold text-slate-700 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                    {val}
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-sm transition-all duration-300 ${barColor}`}
                  />
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                    {hf.hour.slice(0, 2)}h
                  </span>
                </div>
              );
            })}
          </div>

          {/* Diurnal Insights Note */}
          <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
            <Info size={15} className="text-slate-400 dark:text-sky-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 dark:text-slate-100">Nocturnal Inversion Trap:</strong> Minimum boundary layer heights occur between 02:00 and 06:00 (dropping to ~280m), reducing ventilation below 1,500 m²/s and causing PM2.5 to spike dramatically before solar heating breaks the surface inversion by 10:00 AM.
            </div>
          </div>
        </div>
      </div>

      {/* Ward / Station Telemetry Table */}
      <div className="bg-white dark:bg-[#0c1322] border border-slate-200/90 dark:border-slate-800 border-t-[3px] border-t-slate-800 dark:border-t-sky-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Ward-Level Meteorological & Dispersion Telemetry ({filteredStations.length} Stations)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Live surface wind vectors, boundary layer ceiling, and CPCB ventilation coefficient</p>
          </div>

          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search station or ward..."
              value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 px-3 py-1.5 rounded-lg focus:outline-none focus:border-slate-400 dark:focus:border-sky-500 transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#080d19] border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Station / Ward</th>
                <th className="py-2.5 px-3">Wind Speed</th>
                <th className="py-2.5 px-3">Direction</th>
                <th className="py-2.5 px-3">Gusts</th>
                <th className="py-2.5 px-3">Mixing Depth (PBLH)</th>
                <th className="py-2.5 px-3">Ventilation Index</th>
                <th className="py-2.5 px-3">Dispersion Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {filteredStations.map((st) => (
                <tr key={st.cell_id} className="hover:bg-slate-50/80 dark:hover:bg-[#121c32] transition-colors">
                  <td className="py-2.5 px-3 font-sans">
                    <span className="font-medium text-slate-900 dark:text-white block">{st.name}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{st.cell_id.slice(0, 10)}...</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-bold">
                    {st.wind_speed_kmh} <span className="text-slate-400 font-normal">km/h</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                    <span className="font-sans font-semibold text-sky-700 dark:text-sky-400 mr-1">{st.wind_cardinal}</span>
                    <span className="text-slate-400 text-[11px]">({st.wind_dir}°)</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                    {st.wind_gusts_kmh} km/h
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                    {st.boundary_layer_height} m
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                    {st.ventilation_coefficient.toLocaleString()} m²/s
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        st.dispersion_category === 'Severe Stagnation'
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : st.dispersion_category === 'Moderate Dispersion'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      {st.dispersion_category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-sans">
                    <button
                      onClick={() => onSelectZone(st.cell_id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#152038] rounded border border-slate-200 dark:border-slate-700 transition"
                      title="Inspect zone on Live Risk Map"
                    >
                      <span>Map</span>
                      <ArrowRight size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
