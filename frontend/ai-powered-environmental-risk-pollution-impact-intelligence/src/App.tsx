import React, { useState, useEffect } from 'react';
import {
  SummaryData,
  ZonesGeoJson,
  ZoneDetail,
  PriorityQueueItem,
  WindVector,
  AlertItem,
  ModelMetrics,
  ShapGlobal,
  Emitter,
  RegionInfo,
  SynopticWeatherReport
} from './types';
import * as api from './lib/api';
import { MapGrid } from './components/MapGrid';
import { ZoneDetailsPanel } from './components/ZoneDetailsPanel';
import { PriorityQueueView } from './components/PriorityQueueView';
import { WhatIfLab } from './components/WhatIfLab';
import { ModelValidationView } from './components/ModelValidationView';
import { AlertsCenterView } from './components/AlertsCenterView';
import { CommandCenterView } from './components/CommandCenterView';
import { WindWeatherView } from './components/WindWeatherView';
import { ThemeToggle } from './components/ThemeToggle';
import {
  Activity,
  Layers,
  ShieldAlert,
  Sliders,
  BrainCircuit,
  Bell,
  MapPin,
  Wind,
  Search,
  X
} from 'lucide-react';

/** FastAPI only knows the "pune" region; map the UI's "all" to it. */
const apiRegion = (region: string) => (region === 'all' ? 'pune' : region);

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'command' | 'map' | 'weather' | 'priority' | 'whatif' | 'model' | 'alerts'>('command');
  const [horizon, setHorizon] = useState<number>(0);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [regionsList, setRegionsList] = useState<RegionInfo[]>([]);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [zones, setZones] = useState<ZonesGeoJson | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [selectedZoneDetail, setSelectedZoneDetail] = useState<ZoneDetail | null>(null);
  const [loadingZoneDetail, setLoadingZoneDetail] = useState(false);
  const [priorityQueue, setPriorityQueue] = useState<PriorityQueueItem[]>([]);
  const [pqHorizon, setPqHorizon] = useState<number | null>(null);
  const [pqRiskFilter, setPqRiskFilter] = useState<string | null>(null);
  const [windData, setWindData] = useState<WindVector[] | null>(null);
  const [weather, setWeather] = useState<SynopticWeatherReport | null>(null);
  const [showWind, setShowWind] = useState<boolean>(true);
  const [emitters, setEmitters] = useState<Emitter[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [shap, setShap] = useState<ShapGlobal | null>(null);
  const [passive, setLoading] = useState(true);
  const [liveConnected, setLiveConnected] = useState<boolean | null>(null);

  const [quickSearch, setQuickSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // ── Initial metadata from FastAPI ─────────────────────────────
  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      try {
        const [regRes, alertsRes, metRes, shapRes, healthRes] = await Promise.all([
          api.regions(),
          api.alerts(),
          api.modelMetrics(),
          api.modelShap(),
          api.health(),
        ]);

        setLiveConnected(healthRes.status === 'ok');

        const raw: any = (regRes as any)?.regions ?? regRes;
        const list: any[] = Array.isArray(raw) ? raw : [];
        setRegionsList(
          list.map((r: any) =>
            typeof r === 'string'
              ? {
                  id: r,
                  name: r === 'pune' ? 'Pune Metro (PMC + PCMC)' : r,
                  state: 'Maharashtra',
                  center: { lat: 18.5204, lng: 73.8567 },
                  zoom: 11,
                  description: 'Pune environmental risk grid',
                  zone_count: 136,
                }
              : r
          )
        );
        setAlerts(alertsRes as any);
        setMetrics(metRes as any);
        setShap(shapRes as any);
      } catch (err) {
        console.error('Failed to load initial metadata from FastAPI:', err);
        setLiveConnected(false);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // ── Summary, wind, emitters, weather (per region) ─────────────
  useEffect(() => {
    async function fetchRegionalData() {
      const region = apiRegion(selectedRegion);
      try {
        const [sumRes, windRes] = await Promise.all([api.summary(region), api.wind(region)]);
        setSummary(sumRes as any);
        setWindData(windRes as any);
      } catch (err) {
        console.error('Failed to load regional data from FastAPI:', err);
        setLiveConnected(false);
      }

      // emitters + synoptic weather are served by the Studio Express server
      try {
        const [emitRes, weatherRes] = await Promise.all([
          fetch(`/emitters?region=${selectedRegion}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
          fetch(`/weather?region=${selectedRegion}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        setEmitters(emitRes || []);
        setWeather(weatherRes);
      } catch {
        setEmitters([]);
        setWeather(null);
      }
    }
    fetchRegionalData();
  }, [selectedRegion]);

  // ── Zones GeoJSON (per horizon / region) ──────────────────────
  useEffect(() => {
    async function fetchZones() {
      try {
        const data = await api.zones(horizon, undefined, undefined, apiRegion(selectedRegion));
        setZones(data as any);
      } catch (err) {
        console.error('Failed to load zones GeoJSON from FastAPI:', err);
      }
    }
    fetchZones();
  }, [horizon, selectedRegion]);

  // ── Zone detail (on cell select) ──────────────────────────────
  useEffect(() => {
    if (!selectedCellId) {
      setSelectedZoneDetail(null);
      return;
    }
    let cancelled = false;
    async function fetchZoneDetail() {
      setLoadingZoneDetail(true);
      try {
        const data = await api.zoneDetail(selectedCellId!);
        if (!cancelled) setSelectedZoneDetail(data as any);
      } catch (err) {
        console.error(`Failed to load details for ${selectedCellId}:`, err);
      } finally {
        if (!cancelled) setLoadingZoneDetail(false);
      }
    }
    fetchZoneDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedCellId]);

  // ── Priority queue ────────────────────────────────────────────
  useEffect(() => {
    async function updatePq() {
      try {
        const data = await api.priorityQueue(pqHorizon, undefined, pqRiskFilter ?? undefined);
        setPriorityQueue(data as any);
      } catch (err) {
        console.error('Failed to update priority queue:', err);
      }
    }
    updatePq();
  }, [selectedRegion, pqHorizon, pqRiskFilter]);

  // ── What-if weight simulation ─────────────────────────────────
  const handleApplyWeights = async (
    weights: { hazard: number; exposure: number; vulnerability: number },
    simHorizon: number
  ) => {
    const res = await api.weightsWhatIf({
      hazard: weights.hazard,
      exposure: weights.exposure,
      vulnerability: weights.vulnerability,
      horizon: simHorizon,
      top: 10,
    });
    if (res?.zones) {
      setZones(res.zones as any);
      setHorizon(simHorizon);
    }
    return res as any;
  };

  // ── Alert notification dispatch ───────────────────────────────
  const handleSendNotification = async (channel: 'telegram' | 'email', minLevel: string, dryRun: boolean) => {
    return await api.notifyAlert({
      channel,
      min_level: minLevel as 'watch' | 'warning' | 'critical',
      dry_run: dryRun,
    });
  };

  const handleSelectZoneFromAnywhere = (cellId: string) => {
    setSelectedCellId(cellId);
    if (activeTab !== 'map') setActiveTab('map');
  };

  const searchResults = quickSearch.trim().length > 0
    ? priorityQueue.filter((z) =>
        z.cell_id.toLowerCase().includes(quickSearch.toLowerCase()) ||
        z.action.toLowerCase().includes(quickSearch.toLowerCase()) ||
        (z.name && z.name.toLowerCase().includes(quickSearch.toLowerCase())) ||
        (z.region_name && z.region_name.toLowerCase().includes(quickSearch.toLowerCase()))
      ).slice(0, 6)
    : [];

  return (
    <div className="min-h-screen bg-slate-100/75 dark:bg-[#060913] text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased transition-colors duration-300">
      {/* Top Institutional Header */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#0a0f1d]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 shadow-xs transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-sky-500 flex items-center justify-center text-white dark:text-slate-950 shadow-xs shrink-0 transition-colors duration-300">
              <Activity size={18} />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white transition-colors duration-300">
                India Environmental Risk Intelligence
              </h1>
              <span className={`text-[10px] font-mono ${liveConnected === false ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {liveConnected === null ? 'connecting…' : liveConnected ? 'FASTAPI LIVE' : 'DEMO (backend offline)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#0e1628] border border-slate-200 dark:border-slate-750 px-2.5 py-1.5 rounded-lg text-xs transition-colors duration-300">
            <MapPin size={13} className="text-slate-500 dark:text-slate-400" />
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedCellId(null);
              }}
              className="bg-transparent text-slate-800 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <option value="all" className="dark:bg-[#0e1628] dark:text-slate-200">All India (National Grid)</option>
              {regionsList.map((r) => (
                <option key={r.id} value={r.id} className="dark:bg-[#0e1628] dark:text-slate-200">
                  {r.name} ({r.zone_count ?? '—'} cells)
                </option>
              ))}
            </select>
          </div>

          <div className="relative hidden md:block w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search area, zone, protocol..."
              value={quickSearch}
              onChange={(e) => {
                setQuickSearch(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="w-full bg-slate-50 dark:bg-[#0e1628] border border-slate-200 dark:border-slate-700/70 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-slate-400 dark:focus:border-sky-500/50 transition-colors duration-300"
            />
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#0e1628] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.cell_id}
                    onClick={() => {
                      handleSelectZoneFromAnywhere(r.cell_id);
                      setQuickSearch('');
                      setShowSearchDropdown(false);
                    }}
                    className="w-full p-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-[#152038] flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-900 dark:text-slate-100 block">
                          {r.name || `Zone ${r.cell_id.slice(0, 8)}`}
                        </span>
                        {r.region_name && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {r.region_name}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block max-w-xs mt-0.5">
                        {r.action}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      #{r.rank}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {showSearchDropdown && (
              <button
                aria-label="close search"
                onClick={() => setShowSearchDropdown(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0e1628] p-1 rounded-lg border border-slate-200 dark:border-slate-700/70 text-xs transition-colors duration-300">
            {[
              { label: 'Now', val: 0 },
              { label: '+24h', val: 1 },
              { label: '+48h', val: 2 },
              { label: '+72h', val: 3 },
            ].map((item) => (
              <button
                key={item.val}
                onClick={() => setHorizon(item.val)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all duration-200 ${
                  horizon === item.val
                    ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <ThemeToggle />

          {weather?.current && (
            <button
              onClick={() => setActiveTab('weather')}
              className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#0e1628] hover:bg-slate-100 dark:hover:bg-[#142038] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/70 transition-colors duration-300 cursor-pointer"
              title="View full Synoptic Weather & Dispersion report"
            >
              <Wind size={13} className="text-sky-600 dark:text-sky-400" />
              <span className="font-bold text-slate-900 dark:text-white">{weather.current.wind_speed_kmh} km/h</span>
              <span className="text-sky-700 dark:text-sky-400 font-semibold">{weather.current.wind_cardinal}</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>{weather.current.temperature_c}°C</span>
            </button>
          )}
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto border-t border-slate-100 dark:border-slate-800/80 text-xs py-1 transition-colors duration-300">
          {[
            { id: 'command', label: 'Command Center', icon: <Activity size={14} /> },
            { id: 'map', label: 'Live Risk Map', icon: <Layers size={14} /> },
            { id: 'weather', label: 'Wind & Weather', icon: <Wind size={14} /> },
            { id: 'priority', label: `Priority Queue (${priorityQueue.length})`, icon: <ShieldAlert size={14} /> },
            { id: 'whatif', label: 'What-If Simulator', icon: <Sliders size={14} /> },
            { id: 'model', label: 'Model Validation & SHAP', icon: <BrainCircuit size={14} /> },
            { id: 'alerts', label: `Advisories (${alerts.length})`, icon: <Bell size={14} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'command' && (
          <CommandCenterView
            summary={summary}
            priorityQueue={priorityQueue}
            alerts={alerts}
            metrics={metrics}
            onOpenMap={() => setActiveTab('map')}
            onSelectZone={handleSelectZoneFromAnywhere}
            onOpenModelLab={() => setActiveTab('model')}
          />
        )}

        {activeTab === 'map' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-8 w-full">
              <MapGrid
                zones={zones}
                selectedCellId={selectedCellId}
                onSelectZone={(id) => setSelectedCellId(id)}
                windData={windData}
                showWind={showWind}
                onToggleWind={() => setShowWind((w) => !w)}
                horizon={horizon}
                onHorizonChange={(h) => setHorizon(h)}
                emitters={emitters}
                selectedRegion={selectedRegion}
                onRegionChange={(reg) => {
                  setSelectedRegion(reg);
                  setSelectedCellId(null);
                }}
                regionsList={regionsList}
                onOpenWeatherTab={() => setActiveTab('weather')}
              />
            </div>

            <div className="lg:col-span-4 w-full h-[620px]">
              <ZoneDetailsPanel
                zone={selectedZoneDetail}
                loading={loadingZoneDetail}
                onClose={() => setSelectedCellId(null)}
              />
            </div>
          </div>
        )}

        {activeTab === 'weather' && (
          <WindWeatherView
            weather={weather}
            windData={windData}
            selectedRegion={selectedRegion}
            regionsList={regionsList}
            onSelectRegion={(reg) => {
              setSelectedRegion(reg);
              setSelectedCellId(null);
            }}
            onSelectZone={handleSelectZoneFromAnywhere}
          />
        )}

        {activeTab === 'priority' && (
          <PriorityQueueView
            queue={priorityQueue}
            selectedCellId={selectedCellId}
            onSelectZone={handleSelectZoneFromAnywhere}
            horizon={pqHorizon}
            onHorizonChange={setPqHorizon}
            riskFilter={pqRiskFilter}
            onRiskFilterChange={setPqRiskFilter}
          />
        )}

        {activeTab === 'whatif' && (
          <WhatIfLab
            onApplyWeights={handleApplyWeights}
            defaultWeights={summary?.weights ?? { hazard: 0.5, exposure: 0.3, vulnerability: 0.2 }}
            currentMeanScore={summary?.mean_score_now ?? 41.2}
          />
        )}

        {activeTab === 'model' && (
          <ModelValidationView metrics={metrics} shap={shap} />
        )}

        {activeTab === 'alerts' && (
          <AlertsCenterView
            alerts={alerts}
            selectedCellId={selectedCellId}
            onSelectZone={handleSelectZoneFromAnywhere}
            onSendNotification={handleSendNotification}
          />
        )}
      </main>

      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0a0f1d] py-4 text-xs text-slate-500 dark:text-slate-400 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200">India Environmental Risk & Air Quality Intelligence Cadastre</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span>Central Pollution Control Board (CPCB) & NCAP Standards</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            Uber H3 Res-7 Multi-Basin Grid · Open-Meteo · CAMS · OSM · WorldPop · XGBoost Engine
          </span>
        </div>
      </footer>
    </div>
  );
};
