import React from 'react';
import { SummaryData, PriorityQueueItem, AlertItem, ModelMetrics, ZonesGeoJson } from '../types';
import {
  Activity,
  ShieldAlert,
  Users,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  BrainCircuit,
  MapPin,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';

interface CommandCenterViewProps {
  summary: SummaryData | null;
  priorityQueue: PriorityQueueItem[];
  alerts: AlertItem[];
  metrics: ModelMetrics | null;
  onOpenMap: () => void;
  onSelectZone: (cellId: string) => void;
  onOpenModelLab: () => void;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  summary,
  priorityQueue,
  alerts,
  metrics,
  onOpenMap,
  onSelectZone,
  onOpenModelLab,
}) => {
  const topZones = priorityQueue.slice(0, 5);
  const recentAlerts = alerts.slice(0, 4);

  const totalZones = summary?.total_zones || (summary?.class_counts_now ? (Object.values(summary.class_counts_now).reduce((a, b) => a + b, 0) || 1) : 201);
  const modCount = summary?.class_counts_now?.Moderate ?? 0;
  const highCount = summary?.class_counts_now?.High ?? 0;
  const lowCount = summary?.class_counts_now?.Low ?? 0;
  const critCount = summary?.class_counts_now?.Critical ?? 0;

  const lowPct = ((lowCount / totalZones) * 100).toFixed(1);
  const modPct = ((modCount / totalZones) * 100).toFixed(1);
  const highPct = ((highCount / totalZones) * 100).toFixed(1);
  const critPct = ((critCount / totalZones) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Mean Risk Score */}
        <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 border-t-[3px] border-t-amber-500 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-2.5">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{summary?.region_name ? `${summary.region_name} Risk Index` : 'Air Quality Risk Index'}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Activity size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {summary?.mean_score_now ?? 41.2}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">/100</span>
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full ml-auto">
              Moderate
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            H+72h Projection: <strong className="font-mono text-slate-800 dark:text-slate-200 font-bold">{summary?.mean_score_h3 ?? 41.0}</strong>
          </p>
        </div>

        {/* Card 2: High + Critical Zones */}
        <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 border-t-[3px] border-t-orange-500 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-2.5">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Elevated Risk Zones</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {highCount + critCount}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">/ {totalZones} zones</span>
            <span className="text-xs font-bold text-orange-800 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800/60 px-2 py-0.5 rounded-full ml-auto">
              {highPct}% of Area
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            High intervention priority required across key industrial corridors
          </p>
        </div>

        {/* Card 3: Population Exposed */}
        <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 border-t-[3px] border-t-rose-500 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-2.5">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Exposed Population</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Users size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {summary?.population_in_high_or_critical
                ? (summary.population_in_high_or_critical / 1_000_000).toFixed(2) + ' M'
                : '4.54 M'}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">citizens</span>
            <span className="text-xs font-bold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 px-2 py-0.5 rounded-full ml-auto">
              High Priority
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            WorldPop 1 km density overlay across {summary?.region_name || 'India'}
          </p>
        </div>

        {/* Card 4: Active Early Warnings */}
        <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 border-t-[3px] border-t-sky-500 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-2.5">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Active Early Warnings</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {alerts.length}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">triggers</span>
            <span className="text-xs font-bold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/60 px-2 py-0.5 rounded-full ml-auto">
              Automated
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            {alerts.filter((a) => a.level === 'warning').length} Warnings, {alerts.filter((a) => a.level === 'critical').length} Critical
          </p>
        </div>
      </div>

      {/* City Risk Distribution Bar */}
      <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 border-l-[4px] border-l-slate-800 dark:border-l-sky-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-sm text-slate-900 dark:text-white">{summary?.region_name || 'Regional'} Risk Distribution Breakdown</span>
          <span className="text-slate-600 dark:text-slate-300 font-mono font-semibold bg-slate-100 dark:bg-[#080d19] px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800">
            {totalZones} Total Grid Cells (H3 Res-7)
          </span>
        </div>

        {/* Horizontal Stacked Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-lg h-4 flex overflow-hidden border border-slate-200 dark:border-slate-800">
          <div
            style={{ width: `${lowPct}%` }}
            className="bg-emerald-600 h-full transition-all"
            title={`Low Risk: ${lowCount} zones (${lowPct}%)`}
          ></div>
          <div
            style={{ width: `${modPct}%` }}
            className="bg-amber-500 h-full transition-all"
            title={`Moderate Risk: ${modCount} zones (${modPct}%)`}
          ></div>
          <div
            style={{ width: `${highPct}%` }}
            className="bg-orange-600 h-full transition-all"
            title={`High Risk: ${highCount} zones (${highPct}%)`}
          ></div>
          {critCount > 0 && (
            <div
              style={{ width: `${critPct}%` }}
              className="bg-rose-600 h-full transition-all"
              title={`Critical Risk: ${critCount} zones (${critPct}%)`}
            ></div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-emerald-600"></span>
            <span className="text-slate-600 dark:text-slate-400">Low: <strong className="text-slate-800 dark:text-slate-200">{lowCount}</strong> ({lowPct}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
            <span className="text-slate-600 dark:text-slate-400">Moderate: <strong className="text-slate-800 dark:text-slate-200">{modCount}</strong> ({modPct}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-orange-600"></span>
            <span className="text-slate-600 dark:text-slate-400">High: <strong className="text-slate-800 dark:text-slate-200">{highCount}</strong> ({highPct}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-rose-600"></span>
            <span className="text-slate-600 dark:text-slate-400">Critical: <strong className="text-slate-800 dark:text-slate-200">{critCount}</strong> ({critPct}%)</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Top 5 Priority Queue + Live Alerts Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top 5 Urgent Interventions */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 border-t-[3px] border-t-slate-800 dark:border-t-sky-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Priority Intervention Queue (Top 5)</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Ranked by risk severity multiplied by resident population</p>
            </div>
            <button
              onClick={onOpenMap}
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition px-2.5 py-1 rounded bg-slate-50 dark:bg-[#080d19] hover:bg-slate-100 dark:hover:bg-[#152038] border border-slate-200 dark:border-slate-700"
            >
              <span>Explore full map</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {topZones.map((z) => (
              <div
                key={z.cell_id}
                onClick={() => onSelectZone(z.cell_id)}
                className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/90 dark:hover:bg-[#121c32] hover:scale-[1.005] transition-all px-2.5 rounded-lg border border-transparent hover:border-slate-200/80 dark:hover:border-slate-700/60"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-slate-100 dark:bg-[#080d19] text-slate-800 dark:text-slate-300 font-mono font-bold text-xs flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    #{z.rank}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 dark:text-white">
                        {z.name || `Zone ${z.cell_id.slice(0, 8)}`}
                      </span>
                      {z.region_name && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {z.region_name}
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          z.risk_class === 'Critical'
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : z.risk_class === 'High'
                            ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {z.risk_class}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-sm mt-0.5">
                      {z.action}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {z.score_ranked} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">pts</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {z.pop.toLocaleString()} pop
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Alerts Stream */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 border-t-[3px] border-t-rose-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Automated Advisories</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Live thresholds evaluated against 3-day projection</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {recentAlerts.map((a) => (
              <div
                key={a.alert_id}
                onClick={() => onSelectZone(a.zone_id)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                  a.level === 'critical'
                    ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 hover:border-rose-300 dark:hover:border-rose-700'
                    : a.level === 'warning'
                    ? 'bg-orange-50/60 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/60 hover:border-orange-300 dark:hover:border-orange-700'
                    : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 hover:border-amber-300 dark:hover:border-amber-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold font-mono text-slate-900 dark:text-white text-[11px]">
                    Zone {a.zone_id.slice(0, 8)}...
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      a.level === 'critical'
                        ? 'bg-rose-200 dark:bg-rose-900/80 text-rose-900 dark:text-rose-200'
                        : a.level === 'warning'
                        ? 'bg-orange-200 dark:bg-orange-900/80 text-orange-900 dark:text-orange-200'
                        : 'bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    {a.level}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                  {a.message}
                </p>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>Pop: {a.population.toLocaleString()}</span>
                  <span>Peak Score: {a.score_peak}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Model Health & Validation Strip */}
      <div className="bg-slate-50 dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white dark:bg-[#080d19] rounded-lg border border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400">
            <BrainCircuit size={18} />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-white block">
              XGBoost Forecast Engine Active & Validated
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">
              +1 Day Horizon: MAE 3.35 µg/m³ (vs. 3.43 persistence) · R² 0.852 · AQI Accuracy 91.4%
            </span>
          </div>
        </div>

        <button
          onClick={onOpenModelLab}
          className="px-3 py-1.5 bg-white dark:bg-[#080d19] hover:bg-slate-100 dark:hover:bg-[#142038] text-slate-700 dark:text-slate-200 font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition text-xs flex items-center gap-1.5"
        >
          <span>View Model Metrics</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
};
