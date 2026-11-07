import React, { useState } from 'react';
import { PriorityQueueItem } from '../types';
import {
  Search,
  TrendingUp,
  Download,
  ChevronRight,
  ShieldAlert,
  ArrowUpDown
} from 'lucide-react';

interface PriorityQueueViewProps {
  queue: PriorityQueueItem[];
  selectedCellId: string | null;
  onSelectZone: (cellId: string) => void;
  horizon: number | null;
  onHorizonChange: (h: number | null) => void;
  riskFilter: string | null;
  onRiskFilterChange: (rf: string | null) => void;
}

export const PriorityQueueView: React.FC<PriorityQueueViewProps> = ({
  queue,
  selectedCellId,
  onSelectZone,
  horizon,
  onHorizonChange,
  riskFilter,
  onRiskFilterChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = queue.filter((item) => {
    if (riskFilter && item.risk_class !== riskFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = item.cell_id.toLowerCase().includes(term);
      const matchAction = item.action.toLowerCase().includes(term);
      const matchName = item.name ? item.name.toLowerCase().includes(term) : false;
      const matchRegion = item.region_name ? item.region_name.toLowerCase().includes(term) : false;
      if (!matchId && !matchAction && !matchName && !matchRegion) return false;
    }
    return true;
  });

  // Client-side CSV export
  const exportCsv = () => {
    const headers = ['Rank', 'Zone_ID', 'Latitude', 'Longitude', 'Population', 'Risk_Class', 'Score_Now', 'Score_Ranked', '3D_Trend', 'Action'];
    const rows = filtered.map((r) => [
      r.rank,
      r.cell_id,
      r.lat,
      r.lon,
      r.pop,
      r.risk_class,
      r.score_now,
      r.score_ranked,
      r.trend,
      `"${r.action.replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `india_environmental_priority_queue_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Intervention Priority Queue</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ranked municipal allocation ordering by <code className="text-slate-800 dark:text-slate-200 font-mono font-medium">Risk Score × Population</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Horizon Selection */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0e1628] p-1 rounded-lg border border-slate-200 dark:border-slate-700/70 text-xs transition-colors duration-300">
            <button
              onClick={() => onHorizonChange(null)}
              className={`px-2.5 py-1 rounded font-medium transition ${
                horizon === null
                  ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Worst 3-Day
            </button>
            <button
              onClick={() => onHorizonChange(0)}
              className={`px-2.5 py-1 rounded font-medium transition ${
                horizon === 0
                  ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Now
            </button>
            <button
              onClick={() => onHorizonChange(1)}
              className={`px-2.5 py-1 rounded font-medium transition ${
                horizon === 1
                  ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              +24h
            </button>
            <button
              onClick={() => onHorizonChange(2)}
              className={`px-2.5 py-1 rounded font-medium transition ${
                horizon === 2
                  ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              +48h
            </button>
            <button
              onClick={() => onHorizonChange(3)}
              className={`px-2.5 py-1 rounded font-medium transition ${
                horizon === 3
                  ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              +72h
            </button>
          </div>

          {/* Export CSV */}
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-[#0e1628] hover:bg-slate-200 dark:hover:bg-[#152038] text-slate-700 dark:text-slate-300 font-medium text-xs rounded-lg border border-slate-200 dark:border-slate-700/70 transition"
            title="Download CSV table"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search and Risk Class Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search by zone ID or protocol keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#0e1628] border border-slate-200 dark:border-slate-700/70 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 pl-8 pr-3 py-2 rounded-lg focus:outline-none focus:border-slate-400 dark:focus:border-sky-500/50 transition"
          />
        </div>

        {/* Risk Filter buttons */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {['All', 'Critical', 'High', 'Moderate', 'Low'].map((rf) => {
            const isAll = rf === 'All';
            const active = isAll ? riskFilter === null : riskFilter === rf;
            return (
              <button
                key={rf}
                onClick={() => onRiskFilterChange(isAll ? null : rf)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                  active
                    ? 'bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-100 dark:bg-[#0e1628] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700/70'
                }`}
              >
                {rf}
              </button>
            );
          })}
        </div>
      </div>

      {/* Priority Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-[#080d19] border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
              <th className="py-2.5 px-3">Rank</th>
              <th className="py-2.5 px-3">Zone ID</th>
              <th className="py-2.5 px-3">Risk Class</th>
              <th className="py-2.5 px-3">Score (Now / Peak)</th>
              <th className="py-2.5 px-3">Population</th>
              <th className="py-2.5 px-3">3-Day Trend</th>
              <th className="py-2.5 px-3">Action Protocol</th>
              <th className="py-2.5 px-3 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filtered.map((item) => {
              const isSelected = selectedCellId === item.cell_id;
              return (
                <tr
                  key={item.cell_id}
                  onClick={() => onSelectZone(item.cell_id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-sky-950/30'
                      : 'hover:bg-slate-50/80 dark:hover:bg-[#111a2f]'
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-mono font-bold ${
                        item.rank <= 3
                          ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                          : item.rank <= 10
                          ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                          : 'bg-slate-100 dark:bg-[#0e1628] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      #{item.rank}
                    </span>
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="font-medium text-slate-900 dark:text-white leading-tight">
                      {item.name || `Zone ${item.cell_id.slice(0, 8)}`}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{item.cell_id.slice(0, 10)}...</span>
                      {item.region_name && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[9px] font-sans font-medium">
                          {item.region_name}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.risk_class === 'Critical'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                          : item.risk_class === 'High'
                          ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50'
                          : item.risk_class === 'Moderate'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                      }`}
                    >
                      {item.risk_class}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                    <span>{item.score_now}</span>
                    <span className="text-slate-400 dark:text-slate-600 mx-1">→</span>
                    <span className="font-bold text-slate-900 dark:text-white">{item.score_ranked}</span>
                  </td>

                  <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                    {item.pop.toLocaleString()}
                  </td>

                  <td className="py-2.5 px-3 font-mono">
                    <span
                      className={`flex items-center gap-1 font-semibold ${
                        item.trend > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : item.trend < 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.trend > 0 ? `+${item.trend}` : item.trend}
                      <TrendingUp size={11} className={item.trend < 0 ? 'rotate-180' : ''} />
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={item.action}>
                    {item.action}
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectZone(item.cell_id);
                      }}
                      className="px-2 py-1 bg-slate-100 dark:bg-[#0e1628] hover:bg-slate-200 dark:hover:bg-[#1a2744] text-slate-700 dark:text-slate-200 rounded text-xs font-medium transition inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700/70"
                    >
                      Inspect <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
            No zones match the current search or risk filters.
          </div>
        )}
      </div>
    </div>
  );
};
