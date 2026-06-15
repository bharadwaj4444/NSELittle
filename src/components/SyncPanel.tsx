/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Play, 
  Square, 
  Database, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert,
  Loader2,
  HelpCircle
} from 'lucide-react';
import { SyncStatus } from '../types.js';

interface SyncPanelProps {
  onSyncComplete: () => void;
}

export default function SyncPanel({ onSyncComplete }: SyncPanelProps) {
  const [status, setStatus] = useState<SyncStatus>({
    status: 'idle',
    progress: 0,
    total: 0,
    message: 'System loaded. Ready for historical NSE data sync.',
    downloadedCount: 0,
    errorCount: 0,
    currentFile: ''
  });
  const [activeStocksCount, setActiveStocksCount] = useState(0);
  const [analyzedStocksCount, setAnalyzedStocksCount] = useState(0);
  const [months, setMonths] = useState<number>(3); // Default to 3 months for perfect balanced speed
  const [syncMode, setSyncMode] = useState<'predefined' | 'custom'>('predefined');
  const [fromDate, setFromDate] = useState<string>(() => {
    // Default to 1 month ago
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => {
    // Today's current day
    return new Date().toISOString().split('T')[0];
  });
  const [polling, setPolling] = useState(true);

  // Poll sync status
  useEffect(() => {
    let intervalId: any;
    
    async function fetchStatus() {
      try {
        const res = await fetch('/api/sync/status');
        if (res.ok) {
          const data = await res.json();
          setStatus({
            status: data.status,
            progress: data.progress,
            total: data.total,
            message: data.message,
            downloadedCount: data.downloadedCount,
            errorCount: data.errorCount,
            currentFile: data.currentFile,
            lastSyncedDate: data.lastSyncedDate
          });
          setActiveStocksCount(data.activeStocks);
          setAnalyzedStocksCount(data.analyzedStocksCount);

          // If complete or errored, check if we was in transition and call onSyncComplete
          if (data.status === 'completed' && status.status === 'syncing') {
            onSyncComplete();
          }
        }
      } catch (err) {
        console.error("Failed to poll sync status:", err);
        const isFileProtocol = window.location.protocol === 'file:';
        setStatus(prev => ({
          ...prev,
          status: 'error',
          message: isFileProtocol 
            ? 'Running app from a local file path. Please open http://localhost:3000 in your browser to load via the Express server.'
            : 'Unreachable Quant backend on port 3000. Ensure the Express server is running in your terminal (npm run dev).'
        }));
      }
    }

    if (polling) {
      fetchStatus();
      intervalId = setInterval(fetchStatus, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [polling, status.status]);

  async function triggerSync() {
    try {
      const body: any = {};
      if (syncMode === 'predefined') {
        body.months = months;
      } else {
        body.fromDate = fromDate;
        body.toDate = toDate;
      }

      const res = await fetch('/api/sync/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to trigger sync task.');
      }
      setStatus(prev => ({
        ...prev,
        status: 'syncing',
        progress: 0,
        message: 'Sync signal transmitted. Initializing downloader thread...'
      }));
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function stopSync() {
    try {
      const res = await fetch('/api/sync/stop', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to issue stop request.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/85">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold font-sans text-slate-100 flex items-center gap-1.5">
              DATA SYNC CENTER
              <span className="text-[10px] bg-indigo-500/15 text-indigo-300 font-mono font-medium px-2 py-0.5 rounded-full border border-indigo-400/10">
                OFFICIAL NSE ARCHIVES (No Simulation)
              </span>
            </h2>
            <p className="text-xs text-slate-400">Download, extract, and parse raw price bhavcopys to build analytical timeseries models.</p>
          </div>
        </div>

        {/* Action Controls for triggers */}
        <div className="flex flex-wrap items-center gap-3">
          {status.status === 'syncing' ? (
            <button
              id="stop-sync-btn"
              onClick={stopSync}
              className="flex items-center gap-1.5 cursor-pointer px-4 py-2 text-xs font-mono font-bold uppercase rounded-lg border border-rose-500/30 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-colors"
            >
              <Square className="w-4 h-4 fill-rose-400" />
              ABORT SYNC
            </button>
          ) : (
            <>
              {/* Sync Mode Switcher */}
              <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setSyncMode('predefined')}
                  className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded cursor-pointer ${syncMode === 'predefined' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-400/20' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  MONTHS
                </button>
                <button
                  onClick={() => setSyncMode('custom')}
                  className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded cursor-pointer ${syncMode === 'custom' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-400/20' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  RANGE
                </button>
              </div>

              {/* Predefined Months Dropdown */}
              {syncMode === 'predefined' ? (
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-1 relative">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase px-2 flex items-center gap-1">
                    TIMEFRAME:
                    <span className="relative group inline-block cursor-help">
                      <HelpCircle className="w-3 h-3 text-slate-500 hover:text-indigo-400" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[10px] font-sans font-normal leading-relaxed normal-case shadow-xl z-50 text-center">
                        <strong>Predefined range</strong>: Fetches historical trading day bhavcopys over the chosen number of months. Greater ranges produce wider timeseries lists.
                      </span>
                    </span>
                  </span>
                  <select
                    id="months-select"
                    value={months}
                    onChange={(e) => setMonths(parseInt(e.target.value))}
                    disabled={status.status === 'syncing'}
                    className="bg-transparent text-xs font-mono font-bold text-indigo-305 text-indigo-450 focus:outline-none pr-2 cursor-pointer"
                  >
                    <option value={1} className="bg-slate-900">1 Month (Fastest Proof)</option>
                    <option value={3} className="bg-slate-900">3 Months (Recommended)</option>
                    <option value={6} className="bg-slate-900">6 Months (Comprehensive)</option>
                    <option value={12} className="bg-slate-900">1 Year (Full Bhavcopys)</option>
                  </select>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* From Date custom selector */}
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 relative">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase flex items-center gap-1">
                      FROM:
                      <span className="relative group inline-block cursor-help">
                        <HelpCircle className="w-3 h-3 text-slate-500 hover:text-indigo-400" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[10px] font-sans font-normal leading-relaxed normal-case shadow-xl z-50 text-center">
                          <strong>From Date</strong>: Starts downloading bhavcopys starting from this custom day. Only trades/weekdays are fetched.
                        </span>
                      </span>
                    </span>
                    <input
                      type="date"
                      value={fromDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFromDate(e.target.value)}
                      disabled={status.status === 'syncing'}
                      className="bg-transparent text-xs font-mono font-bold text-indigo-400 focus:outline-none cursor-pointer border-none"
                    />
                  </div>

                  {/* To Date current day selector with help text */}
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 relative">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase flex items-center gap-1">
                      TO (TODAY):
                      <span className="relative group inline-block cursor-help">
                        <HelpCircle className="w-3 h-3 text-slate-500 hover:text-indigo-400" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[10px] font-sans font-normal leading-relaxed normal-case shadow-xl z-50 text-center">
                          <strong>To Date</strong>: Set to the current calendar day as required. Fetches everything up to the latest closing exchange copy.
                        </span>
                      </span>
                    </span>
                    <input
                      type="date"
                      value={toDate}
                      disabled
                      className="bg-transparent text-xs font-mono font-bold text-slate-500 focus:outline-none cursor-not-allowed border-none"
                    />
                  </div>
                </div>
              )}

              <button
                id="start-sync-btn"
                onClick={triggerSync}
                className="flex items-center gap-1.5 cursor-pointer px-4.5 py-2 text-xs font-mono font-bold uppercase rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-md active:translate-y-px"
                disabled={status.status === 'syncing'}
              >
                <Play className="w-4 h-4 fill-white" />
                SYNC COPIES
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Dynamic Progress / Status Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
        
        {/* Progress & Current log */}
        <div className="md:col-span-2 space-y-3.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              {status.status === 'syncing' && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
              <span className="uppercase font-bold text-slate-300">SYSTEM STATE:</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              status.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 
              status.status === 'syncing' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25' : 
              status.status === 'error' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' : 'bg-slate-800 text-slate-400'
            }`}>
              {status.status.toUpperCase()}
            </span>
          </div>

          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-lg min-h-[55px] flex items-center">
            <p className="text-slate-300 text-xs font-mono leading-relaxed flex items-start gap-2">
              <span className="text-indigo-400 font-bold select-none">&gt;</span>
              {status.message}
            </p>
          </div>

          {/* Progress Bar */}
          {status.status === 'syncing' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                <span>FILE INDEX: {status.currentFile}</span>
                <span className="font-bold text-indigo-400">{status.progress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${status.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Quant Metric Stats cards */}
        <div className="bg-slate-950/35 border border-slate-800/60 rounded-xl p-4 flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase pb-2 border-b border-slate-850">
            LOADED DATA BASES
          </p>

          <div className="grid grid-cols-2 gap-2 my-2 text-center">
            <div className="p-1.5 bg-slate-900/60 rounded-lg border border-slate-800/80 relative group">
              <span className="block text-[10px] font-mono text-slate-500 uppercase cursor-help flex items-center justify-center gap-0.5">
                ACTIVE
                <HelpCircle className="w-2.5 h-2.5 text-slate-600" />
              </span>
              <span className="text-lg font-bold font-mono text-slate-200">{activeStocksCount}</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-40 p-2 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal leading-normal shadow-xl z-55 text-center">
                Number of unique priority securities indexed.
              </span>
            </div>
            <div className="p-1.5 bg-slate-900/60 rounded-lg border border-slate-800/80 relative group">
              <span className="block text-[10px] font-mono text-slate-500 uppercase cursor-help flex items-center justify-center gap-0.5">
                ANALYZED
                <HelpCircle className="w-2.5 h-2.5 text-slate-600" />
              </span>
              <span className="text-lg font-bold font-mono text-slate-200">{analyzedStocksCount}</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-40 p-2 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal leading-normal shadow-xl z-55 text-center">
                Securities with sufficient history (20+ days) parsed into indicator matrices.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 justify-center relative group">
            <Calendar className="w-3 h-3 text-indigo-400" />
            <span className="cursor-help flex items-center gap-0.5">
              LAST SYNC DATE:
              <HelpCircle className="w-2.5 h-2.5 text-slate-600" />
            </span>
            <span className="font-bold text-slate-200">{status.lastSyncedDate || 'NEVER'}</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-44 p-2 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal leading-normal shadow-xl z-55 text-center">
              The date of the most recent exchange bhavcopy row present in your dataset.
            </span>
          </div>
        </div>

      </div>

      {/* Sync Guidelines Warning Card */}
      {status.status === 'idle' && activeStocksCount === 0 && (
        <div className="mt-4 flex gap-3 p-3.5 rounded-lg border border-indigo-500/10 bg-indigo-500/5 text-slate-300 text-xs">
          <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-indigo-400 block font-sans text-xs">Awaiting Market Source Initialize:</span>
            <p className="leading-relaxed text-slate-400 text-xs">
              This application has strictly zero hardcoding or simulated data. We download authentic raw exchange CSV.ZIP tables dynamically and scaleindicators on them. To begin pattern clustering, select a timeframe above and click <strong>"Sync Latest NSE Copies"</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
