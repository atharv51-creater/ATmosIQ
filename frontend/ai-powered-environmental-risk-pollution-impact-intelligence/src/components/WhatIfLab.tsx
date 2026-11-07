import React, { useState } from 'react';
import { Sliders, RotateCcw, Sparkles, TrendingUp, Users, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface WhatIfLabProps {
  onApplyWeights: (weights: { hazard: number; exposure: number; vulnerability: number }, horizon: number) => Promise<any>;
  defaultWeights: { hazard: number; exposure: number; vulnerability: number };
  currentMeanScore: number;
}

export const WhatIfLab: React.FC<WhatIfLabProps> = ({
  onApplyWeights,
  defaultWeights,
  currentMeanScore,
}) => {
  const [hazard, setHazard] = useState(defaultWeights.hazard);
  const [exposure, setExposure] = useState(defaultWeights.exposure);
  const [vulnerability, setVulnerability] = useState(defaultWeights.vulnerability);
  const [horizon, setHorizon] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const total = hazard + exposure + vulnerability;
  const normH = total > 0 ? (hazard / total) * 100 : 33.3;
  const normE = total > 0 ? (exposure / total) * 100 : 33.3;
  const normV = total > 0 ? (vulnerability / total) * 100 : 33.3;

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const res = await onApplyWeights({ hazard, exposure, vulnerability }, horizon);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (h: number, e: number, v: number) => {
    setHazard(h);
    setExposure(e);
    setVulnerability(v);
  };

  const handleReset = () => {
    setHazard(defaultWeights.hazard);
    setExposure(defaultWeights.exposure);
    setVulnerability(defaultWeights.vulnerability);
    setHorizon(0);
    setResult(null);
  };

  return (
    <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5 shadow-sm text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-slate-800 dark:text-sky-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">What-If Policy Simulation Laboratory</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Test custom weight configurations for municipal hazard, exposure, and vulnerability across India's urban basins.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#0e1628] border border-slate-200 dark:border-slate-700/70 rounded-lg transition"
        >
          <RotateCcw size={13} />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Preset Policy Scenarios */}
      <div className="space-y-2">
        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
          Standard Policy Scenarios
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <button
            onClick={() => applyPreset(0.5, 0.3, 0.2)}
            className="p-3 bg-slate-50 dark:bg-[#080d19] hover:bg-slate-100 dark:hover:bg-[#111a2f] border border-slate-200 dark:border-slate-800 rounded-lg text-left transition"
          >
            <span className="font-semibold text-slate-900 dark:text-white block text-xs">Baseline Model</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">50% H / 30% E / 20% V</span>
          </button>

          <button
            onClick={() => applyPreset(0.25, 0.55, 0.2)}
            className="p-3 bg-slate-50 dark:bg-[#080d19] hover:bg-slate-100 dark:hover:bg-[#111a2f] border border-slate-200 dark:border-slate-800 rounded-lg text-left transition"
          >
            <span className="font-semibold text-slate-900 dark:text-white block text-xs">Public Health Focus</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">25% H / 55% E / 20% V</span>
          </button>

          <button
            onClick={() => applyPreset(0.7, 0.15, 0.15)}
            className="p-3 bg-slate-50 dark:bg-[#080d19] hover:bg-slate-100 dark:hover:bg-[#111a2f] border border-slate-200 dark:border-slate-800 rounded-lg text-left transition"
          >
            <span className="font-semibold text-slate-900 dark:text-white block text-xs">Severe Smog Episode</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">70% H / 15% E / 15% V</span>
          </button>

          <button
            onClick={() => applyPreset(0.25, 0.25, 0.5)}
            className="p-3 bg-slate-50 dark:bg-[#080d19] hover:bg-slate-100 dark:hover:bg-[#111a2f] border border-slate-200 dark:border-slate-800 rounded-lg text-left transition"
          >
            <span className="font-semibold text-slate-900 dark:text-white block text-xs">Heat & Canopy Resilience</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">25% H / 25% E / 50% V</span>
          </button>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        {/* Hazard Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">Hazard Weight</span>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{normH.toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="1.0"
            step="0.05"
            value={hazard}
            onChange={(e) => setHazard(parseFloat(e.target.value))}
            className="w-full accent-slate-800 dark:accent-sky-400 cursor-pointer"
          />
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Air pollution concentrations (PM2.5, NO2, O3)</p>
        </div>

        {/* Exposure Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">Exposure Weight</span>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{normE.toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="1.0"
            step="0.05"
            value={exposure}
            onChange={(e) => setExposure(parseFloat(e.target.value))}
            className="w-full accent-slate-800 dark:accent-sky-400 cursor-pointer"
          />
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Population counts and industrial emitter density</p>
        </div>

        {/* Vulnerability Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">Vulnerability Weight</span>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{normV.toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="1.0"
            step="0.05"
            value={vulnerability}
            onChange={(e) => setVulnerability(parseFloat(e.target.value))}
            className="w-full accent-slate-800 dark:accent-sky-400 cursor-pointer"
          />
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Tree canopy deficit and surface heat proxy</p>
        </div>
      </div>

      {/* Horizon & Action Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span>Target Horizon:</span>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0e1628] p-1 rounded-lg border border-slate-200 dark:border-slate-700/70">
            {[0, 1, 2, 3].map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                  horizon === h
                    ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {h === 0 ? 'Today (H0)' : `+${h * 24}h`}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSimulate}
          disabled={loading}
          className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 dark:bg-sky-500 hover:bg-slate-800 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Sparkles size={14} />
          )}
          <span>Recompute Model & Priority Ordering</span>
        </button>
      </div>

      {/* Simulation Result Comparison */}
      {result && (
        <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={16} />
            <span>Simulation Output Completed (Horizon: +{result.horizon_days * 24}h)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white dark:bg-[#0c1322] p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Mean City Score</span>
              <div className="flex items-baseline gap-2 font-mono">
                <span className="text-xs text-slate-400 dark:text-slate-500">{currentMeanScore}</span>
                <span className="text-slate-400 dark:text-slate-600">→</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">{result.mean_score}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0c1322] p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Critical Zones</span>
              <span className="text-base font-bold text-rose-600 dark:text-rose-400 font-mono">
                {result.class_counts?.Critical ?? 0}
              </span>
            </div>

            <div className="bg-white dark:bg-[#0c1322] p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">High Risk Zones</span>
              <span className="text-base font-bold text-orange-600 dark:text-orange-400 font-mono">
                {result.class_counts?.High ?? 0}
              </span>
            </div>

            <div className="bg-white dark:bg-[#0c1322] p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Moderate Zones</span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono">
                {result.class_counts?.Moderate ?? 0}
              </span>
            </div>
          </div>

          {/* Top 3 Re-ranked Zones */}
          {result.priority_queue && result.priority_queue.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                Top Priority Zones Under Recomputed Policy
              </span>
              <div className="space-y-1.5">
                {result.priority_queue.slice(0, 3).map((r: any) => (
                  <div
                    key={r.cell_id}
                    className="flex items-center justify-between bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">#{r.rank}</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{r.cell_id.slice(0, 10)}...</span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">Pop: {r.pop.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">Score: {r.score_ranked}</span>
                      <span className="text-slate-600 dark:text-slate-400 font-medium text-[11px]">{r.risk_class}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
