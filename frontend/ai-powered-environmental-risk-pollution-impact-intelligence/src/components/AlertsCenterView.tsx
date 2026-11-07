import React, { useState } from 'react';
import { AlertItem } from '../types';
import {
  Bell,
  Send,
  AlertTriangle,
  Users,
  CheckCircle2,
  Mail,
  MessageSquare,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

interface AlertsCenterViewProps {
  alerts: AlertItem[];
  selectedCellId: string | null;
  onSelectZone: (cellId: string) => void;
  onSendNotification: (channel: 'telegram' | 'email', minLevel: string, dryRun: boolean) => Promise<any>;
}

export const AlertsCenterView: React.FC<AlertsCenterViewProps> = ({
  alerts,
  selectedCellId,
  onSelectZone,
  onSendNotification,
}) => {
  const [minLevel, setMinLevel] = useState<'watch' | 'warning' | 'critical'>('watch');
  const [channel, setChannel] = useState<'telegram' | 'email'>('telegram');
  const [dryRun, setDryRun] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  const filtered = alerts.filter((a) => {
    const order: Record<string, number> = { watch: 0, warning: 1, critical: 2 };
    return (order[a.level] ?? 0) >= order[minLevel];
  });

  const criticalCount = alerts.filter((a) => a.level === 'critical').length;
  const warningCount = alerts.filter((a) => a.level === 'warning').length;
  const watchCount = alerts.filter((a) => a.level === 'watch').length;

  const handleDispatch = async () => {
    setDispatching(true);
    setDispatchResult(null);
    try {
      const res = await onSendNotification(channel, minLevel, dryRun);
      setDispatchResult(res);
    } catch (err: any) {
      setDispatchResult({ error: err.message });
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6 shadow-sm text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Title & Stats Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-slate-800 dark:text-sky-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Municipal Alert & Advisory Broadcasts</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Automated threshold triggers for health advisories, mobile sensor deployments, and industrial inspections.
          </p>
        </div>

        {/* Counter cards */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg">
            <span className="text-[10px] text-rose-700 dark:text-rose-400 block font-bold">CRITICAL</span>
            <span className="font-mono text-base font-bold text-rose-900 dark:text-rose-200">{criticalCount}</span>
          </div>
          <div className="px-3 py-1.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 rounded-lg">
            <span className="text-[10px] text-orange-700 dark:text-orange-400 block font-bold">WARNING</span>
            <span className="font-mono text-base font-bold text-orange-900 dark:text-orange-200">{warningCount}</span>
          </div>
          <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-lg">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-bold">WATCH</span>
            <span className="font-mono text-base font-bold text-amber-900 dark:text-amber-200">{watchCount}</span>
          </div>
        </div>
      </div>

      {/* Dispatch Controls Box */}
      <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs">
            {/* Min Level Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Min Severity:</span>
              <div className="flex items-center gap-1 bg-white dark:bg-[#0e1628] p-1 rounded-md border border-slate-200 dark:border-slate-700/70">
                {(['watch', 'warning', 'critical'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setMinLevel(lvl)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase transition cursor-pointer ${
                      minLevel === lvl
                        ? 'bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Channel Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Channel:</span>
              <div className="flex items-center gap-1 bg-white dark:bg-[#0e1628] p-1 rounded-md border border-slate-200 dark:border-slate-700/70">
                <button
                  onClick={() => setChannel('telegram')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    channel === 'telegram'
                      ? 'bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <MessageSquare size={12} /> Telegram
                </button>
                <button
                  onClick={() => setChannel('email')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    channel === 'email'
                      ? 'bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Mail size={12} /> Email
                </button>
              </div>
            </div>
          </div>

          {/* Dry Run Toggle & Dispatch Button */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-slate-900 dark:text-sky-500 focus:ring-0"
              />
              <span>Dry Run (Preview Only)</span>
            </label>

            <button
              onClick={handleDispatch}
              disabled={dispatching || filtered.length === 0}
              className="px-4 py-2 bg-slate-900 dark:bg-sky-500 hover:bg-slate-800 dark:hover:bg-sky-400 text-white dark:text-slate-950 font-semibold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send size={13} />
              <span>{dryRun ? 'Generate Alert Dispatch' : 'Push Live Alert Broadcast'}</span>
            </button>
          </div>
        </div>

        {/* Dispatch Result Card */}
        {dispatchResult && (
          <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs space-y-2 mt-3 animate-in fade-in duration-100">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                {dispatchResult.dry_run
                  ? `Dry-Run Payload Formatted (${dispatchResult.count} qualifying alerts)`
                  : `Broadcast Dispatched to ${dispatchResult.channel}`}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Status: Ready</span>
            </div>
            {dispatchResult.text && (
              <pre className="p-2.5 bg-slate-50 dark:bg-[#080d19] rounded text-slate-800 dark:text-slate-200 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-slate-800">
                {dispatchResult.text}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Alerts Grid */}
      <div className="space-y-3">
        <span className="text-xs font-semibold text-slate-900 dark:text-white">
          Active Triggers ({filtered.length} zones qualify at '{minLevel.toUpperCase()}' or higher)
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((alert) => {
            const isSelected = selectedCellId === alert.zone_id;
            return (
              <div
                key={alert.alert_id}
                onClick={() => onSelectZone(alert.zone_id)}
                className={`p-4 rounded-xl border transition cursor-pointer space-y-2.5 bg-white dark:bg-[#0c1322] ${
                  alert.level === 'critical'
                    ? 'border-rose-300 dark:border-rose-900/60 hover:border-rose-500 dark:hover:border-rose-400'
                    : alert.level === 'warning'
                    ? 'border-orange-300 dark:border-orange-900/60 hover:border-orange-500 dark:hover:border-orange-400'
                    : 'border-amber-300 dark:border-amber-900/60 hover:border-amber-500 dark:hover:border-amber-400'
                } ${isSelected ? 'ring-2 ring-slate-900 dark:ring-sky-400' : 'shadow-xs'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        alert.level === 'critical'
                          ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-400'
                          : alert.level === 'warning'
                          ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-400'
                          : 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400'
                      }`}
                    >
                      {alert.level}
                    </span>
                    <span className="font-mono text-slate-900 dark:text-white text-xs font-bold">
                      Zone {alert.zone_id.slice(0, 10)}...
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    Priority #{alert.rank}
                  </span>
                </div>

                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {alert.message}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-mono pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>Pop: <strong className="text-slate-800 dark:text-slate-200">{alert.population.toLocaleString()}</strong></span>
                  <span>Score Now: <strong className="text-slate-800 dark:text-slate-200">{alert.score_now}</strong></span>
                  <span>Peak: <strong className="text-slate-900 dark:text-white">{alert.score_peak}</strong></span>
                </div>

                {alert.recommended_action && (
                  <div className="bg-slate-50 dark:bg-[#080d19] p-2 rounded-md text-[11px] text-slate-700 dark:text-slate-300 leading-tight border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block mb-0.5">PROTOCOL:</span>
                    {alert.recommended_action}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
