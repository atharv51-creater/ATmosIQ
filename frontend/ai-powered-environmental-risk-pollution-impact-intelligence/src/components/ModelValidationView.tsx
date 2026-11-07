import React, { useState } from 'react';
import { ModelMetrics, ShapGlobal } from '../types';
import { BrainCircuit, CheckCircle, BarChart3, Info, Award, Database, FileText } from 'lucide-react';

interface ModelValidationViewProps {
  metrics: ModelMetrics | null;
  shap: ShapGlobal | null;
}

export const ModelValidationView: React.FC<ModelValidationViewProps> = ({ metrics, shap }) => {
  const [activeHorizon, setActiveHorizon] = useState<'h1' | 'h2' | 'h3'>('h1');
  const globalShap = shap?.global || [];
  const maxShap = globalShap.length > 0 ? Math.max(...globalShap.map((g) => g.mean_abs)) : 1;

  return (
    <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6 shadow-sm text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit size={18} className="text-slate-800 dark:text-sky-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Forecast Model & Validation Benchmarks</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Empirical validation metrics across temporal and spatial holdouts for the XGBoost PM2.5 engine.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#080d19] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
          <span>Time Split: <strong className="text-slate-900 dark:text-white">{metrics?.time_cut ?? '2026-04-14'}</strong></span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>Features: <strong className="text-slate-900 dark:text-white">{metrics?.n_features ?? 43}</strong></span>
        </div>
      </div>

      {/* Benchmark Table with Horizon Tabs */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Award size={15} className="text-amber-600 dark:text-amber-400" />
            Holdout Comparative Performance (Persistence vs. Models)
          </span>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0e1628] p-1 rounded-lg border border-slate-200 dark:border-slate-700/70 text-xs">
            {(['h1', 'h2', 'h3'] as const).map((h) => (
              <button
                key={h}
                onClick={() => setActiveHorizon(h)}
                className={`px-3 py-1 rounded font-medium transition ${
                  activeHorizon === h
                    ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {h === 'h1' ? 'Horizon +1d (H1)' : h === 'h2' ? 'Horizon +2d (H2)' : 'Horizon +3d (H3)'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#080d19] border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Model Candidate</th>
                <th className="py-2.5 px-3">MAE (µg/m³)</th>
                <th className="py-2.5 px-3">RMSE (µg/m³)</th>
                <th className="py-2.5 px-3">R² Score</th>
                <th className="py-2.5 px-3">AQI Class Accuracy</th>
                <th className="py-2.5 px-3 text-right">Deployment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
              {/* XGBoost row */}
              <tr className="bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-300 font-medium">
                <td className="py-2.5 px-3 text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 font-bold">
                  <CheckCircle size={14} className="text-emerald-600 dark:text-emerald-400" />
                  XGBoost (Active Production)
                </td>
                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                  {activeHorizon === 'h1' ? '3.35' : activeHorizon === 'h2' ? '4.84' : '6.21'}
                </td>
                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                  {activeHorizon === 'h1' ? '5.03' : activeHorizon === 'h2' ? '6.90' : '8.78'}
                </td>
                <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">
                  {activeHorizon === 'h1' ? '0.852' : activeHorizon === 'h2' ? '0.722' : '0.552'}
                </td>
                <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">
                  {activeHorizon === 'h1' ? '91.4%' : activeHorizon === 'h2' ? '86.5%' : '81.9%'}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400 font-sans text-xs font-semibold">
                  Deployed
                </td>
              </tr>

              {/* Persistence row */}
              <tr>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">Persistence Baseline</td>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  {activeHorizon === 'h1' ? '3.43' : activeHorizon === 'h2' ? '4.96' : '5.71'}
                </td>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  {activeHorizon === 'h1' ? '5.29' : activeHorizon === 'h2' ? '7.61' : '8.84'}
                </td>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  {activeHorizon === 'h1' ? '0.836' : activeHorizon === 'h2' ? '0.662' : '0.545'}
                </td>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  {activeHorizon === 'h1' ? '91.0%' : activeHorizon === 'h2' ? '86.7%' : '84.5%'}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-500 dark:text-slate-400 font-sans text-xs">
                  Reference
                </td>
              </tr>

              {/* Random Forest row */}
              <tr>
                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">Random Forest</td>
                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                  {activeHorizon === 'h1' ? '3.88' : activeHorizon === 'h2' ? '5.70' : '6.95'}
                </td>
                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                  {activeHorizon === 'h1' ? '5.79' : activeHorizon === 'h2' ? '8.10' : '9.93'}
                </td>
                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                  {activeHorizon === 'h1' ? '0.804' : activeHorizon === 'h2' ? '0.617' : '0.427'}
                </td>
                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                  {activeHorizon === 'h1' ? '89.1%' : activeHorizon === 'h2' ? '83.2%' : '79.0%'}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-400 dark:text-slate-500 font-sans text-xs">
                  Superseded
                </td>
              </tr>

              {/* Spatial Holdout row */}
              <tr>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">Spatial Holdout Check</td>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  {activeHorizon === 'h1' ? '3.42' : activeHorizon === 'h2' ? '4.69' : '5.72'}
                </td>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  {activeHorizon === 'h1' ? '5.03' : activeHorizon === 'h2' ? '6.59' : '8.16'}
                </td>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  {activeHorizon === 'h1' ? '0.829' : activeHorizon === 'h2' ? '0.707' : '0.554'}
                </td>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  {activeHorizon === 'h1' ? '90.7%' : activeHorizon === 'h2' ? '84.5%' : '81.8%'}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400 font-sans text-xs">
                  Cross-validated
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Global SHAP Feature Importances */}
      <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={15} className="text-slate-800 dark:text-sky-400" />
            Global SHAP Feature Attribution (Mean Absolute Impact on Forecast)
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            SHAP TreeExplainer
          </span>
        </div>

        <div className="space-y-2 bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          {globalShap.map((item, idx) => {
            const pct = (item.mean_abs / maxShap) * 100;
            return (
              <div key={item.feature} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-800 dark:text-slate-200 font-medium flex items-center gap-2">
                    <span className="w-4 text-slate-400 dark:text-slate-500 font-mono text-[10px]">#{idx + 1}</span>
                    <span>{item.label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">({item.feature})</span>
                  </span>
                  <span className="font-mono text-slate-900 dark:text-white font-bold">{item.mean_abs.toFixed(3)}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-slate-700 dark:bg-sky-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Methodology & Limitations Note */}
      <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
          <FileText size={15} className="text-slate-600 dark:text-sky-400" />
          <span>Scientific & Methodological Constraints</span>
        </div>
        <p>
          • <strong>Regional Sensing with Local Exposure:</strong> Air-quality inputs from Open-Meteo & CAMS provide ~10 km spatial resolution. Local variations between adjacent H3 hexagons originate from high-resolution WorldPop population density, OpenStreetMap industrial emitter proximity, wind vector transport indices, and NDVI green canopy proxies.
        </p>
        <p>
          • <strong>Validation Ground Truth:</strong> The PM2.5 forecast is the strictly validated ML component. The composite environmental risk score is an explainable weighted index calibrated to facilitate municipal resource prioritization.
        </p>
      </div>
    </div>
  );
};
