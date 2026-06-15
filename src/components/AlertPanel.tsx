/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Bell, 
  BellOff, 
  Zap, 
  TrendingUp, 
  RefreshCw, 
  Activity, 
  Sliders, 
  AlertTriangle,
  Play,
  Maximize2,
  HelpCircle
} from 'lucide-react';
import { TradingAlert, StockAnalysis } from '../types.js';

interface AlertPanelProps {
  onSelectSymbol: (symbol: string) => void;
  refreshTrigger: number;
}

export default function AlertPanel({ onSelectSymbol, refreshTrigger }: AlertPanelProps) {
  const [alerts, setAlerts] = useState<TradingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // OS Native notification permission status
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default');

  // Load and refresh alerts
  useEffect(() => {
    async function fetchAlerts() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/alerts');
        if (!res.ok) {
          throw new Error(`Failed to load trading signals: ${res.statusText}`);
        }
        const data = await res.json();
        setAlerts(data.alerts || []);
      } catch (err: any) {
        setError(err.message || 'An error occurred loading daily Alerts.');
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
    
    // Check if Notification API is available and retrieve current status
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [refreshTrigger]);

  // Request browser notification hooks
  function requestNotificationPermissions() {
    if (!("Notification" in window)) {
      alert("This browser does not support standard Desktop Notifications.");
      return;
    }

    Notification.requestPermission().then(status => {
      setNotificationPermission(status);
      if (status === 'granted') {
        new Notification("NSE Setup Monitor Active", {
          body: "Push notification alert loop initialized successfully! You will receive daily high-probability trade setups.",
          silent: false
        });
      }
    });
  }

  // Handle Mock alert simulation for live developer testing on the notification stream
  function triggerMockTestAlert() {
    if (notificationPermission !== 'granted') {
      alert("Please enable desktop push notifications first.");
      return;
    }
    
    const randomStock = alerts[Math.floor(Math.random() * alerts.length)] || {
      symbol: "RELIANCE",
      price: 2450.45,
      change: 2.45,
      reason: "High volume breakout with tight consolidation squeeze overlay."
    };

    new Notification(`High-Probability Breakout: ${randomStock.symbol}`, {
      body: `Price: ₹${randomStock.price.toFixed(2)} (${randomStock.change >= 0 ? '+' : ''}${randomStock.change.toFixed(2)}%). ${randomStock.reason}`,
      dir: 'auto',
      silent: false
    });
  }

  return (
    <div className="space-y-5 font-sans">
      
      {/* Alert Header Ribbon */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 bg-rose-500/10 text-rose-400 rounded-lg">
            <Bell className="w-5 h-5 animate-swing" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-1.5 font-sans">
              ALERTS ROOM
              <span className="text-[10px] bg-rose-500/15 text-rose-400 font-mono font-medium px-2.5 py-0.5 rounded-full border border-rose-400/10">
                DAILY PROBABILITY RADAR
              </span>
            </h2>
            <p className="text-xs text-slate-400">High-conviction, algorithmically qualified setups ready for trade execution.</p>
          </div>
        </div>

        {/* Browser native push actions toggle */}
        <div className="flex items-center gap-3 shrink-0">
          {notificationPermission === 'granted' ? (
            <div className="flex items-center gap-2">
              <button 
                id="test-notify-btn"
                onClick={triggerMockTestAlert} 
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-slate-105 font-mono text-[10px] font-bold uppercase transition"
              >
                TEST REMOTE ALERT
              </button>
              <span className="flex items-center gap-1.5 px-3 py-1.5 font-mono font-bold text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-lg select-none">
                <Bell className="w-3.5 h-3.5" />
                OS ALERTS ACTIVE
              </span>
            </div>
          ) : (
            <button
              id="enable-notifications-btn"
              onClick={requestNotificationPermissions}
              className="flex items-center gap-1.5 px-4 py-2 font-mono font-bold text-xs uppercase text-slate-200 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition active:translate-y-px cursor-pointer"
            >
              <BellOff className="w-4 h-4 text-rose-400" />
              TURN ON DESKTOP NOTIFICATIONS
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-900 border border-slate-800 rounded-xl min-h-[300px]">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
          <p className="text-sm font-mono text-slate-400">Scanning bhavcopy tables for daily setup triggers...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-xl text-center min-h-[300px]">
          <p className="text-rose-400 font-bold font-mono text-sm mb-2 font-mono">Alert System Error</p>
          <p className="text-xs text-slate-500">{error}</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-slate-800 rounded-xl text-center min-h-[300px]">
          <div className="w-12 h-12 rounded-full bg-slate-850 flex items-center justify-center text-slate-500 mb-4 border border-slate-800">
            <BellOff className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-300">Quiet trading session. No setups generated.</p>
          <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
            Run a deeper historical sync across the last 1 year to expand scope. High probability setup alerts generate as soon as daily volume and bandwidth metrics cross strict thresholds.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {alerts.map((al) => (
            <div 
              key={al.id} 
              className="flex flex-col justify-between bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden shadow-xs transition duration-200 group relative"
            >
              {/* Top Section */}
              <div className="p-4.5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-slate-100">{al.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wide ${
                      al.signalType === 'BREAKOUT' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10' : 
                      al.signalType === 'REVERSAL' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-400/10' : 
                      'bg-yellow-500/15 text-yellow-550 text-yellow-405 text-yellow-400 border border-yellow-400/10'
                    }`}>
                      {al.signalType}
                    </span>
                  </div>

                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    al.strength === 'HIGH' ? 'bg-rose-500/15 text-rose-400 animate-pulse border border-rose-500/10' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {al.strength} INTENSITY
                  </span>
                </div>

                <div className="bg-slate-950/45 border border-slate-850 p-2.5 rounded-lg space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-mono">Last Traded Value</span>
                    <span className="font-mono text-slate-300 font-bold">₹{al.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-mono">Daily Return%</span>
                    <span className={`font-mono font-bold ${al.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {al.change >= 0 ? '+' : ''}{al.change.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed font-sans flex-1">
                  {al.reason}
                </p>

                {/* Micro metrics details */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-850/80 font-mono text-[9px]">
                  <div className="text-center p-1 bg-slate-950/20 rounded relative group/rsi cursor-help">
                    <span className="block text-slate-500 flex items-center justify-center gap-0.5">
                      RSI
                      <HelpCircle className="w-2 h-2 text-slate-600" />
                    </span>
                    <span className="text-slate-300 font-semibold">{al.indicators.rsi ? al.indicators.rsi.toFixed(1) : '—'}</span>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/rsi:block w-40 p-2 bg-slate-950 border border-slate-830 border-slate-800 text-slate-305 text-slate-300 rounded text-[9px] font-sans font-normal leading-normal shadow-xl z-55 text-center">
                      <strong>Relative Strength Index</strong>: Momentum indicator. Overbought (≥70) or Oversold (≤30).
                    </span>
                  </div>
                  <div className="text-center p-1 bg-slate-950/20 rounded relative group/bb cursor-help">
                    <span className="block text-slate-500 flex items-center justify-center gap-0.5">
                      BB WIDTH
                      <HelpCircle className="w-2 h-2 text-slate-600" />
                    </span>
                    <span className="text-slate-300 font-semibold">
                      {al.indicators.bbWidth ? `${(al.indicators.bbWidth * 100).toFixed(1)}%` : '—'}
                    </span>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/bb:block w-40 p-2 bg-slate-950 border border-slate-830 border-slate-800 text-slate-305 text-slate-300 rounded text-[9px] font-sans font-normal leading-normal shadow-xl z-55 text-center">
                      <strong>Bollinger Bandwidth</strong>: Channel width. Squeezes &lt; 8% signal incoming explosive moves.
                    </span>
                  </div>
                  <div className="text-center p-1 bg-slate-950/20 rounded relative group/vol cursor-help">
                    <span className="block text-slate-500 flex items-center justify-center gap-0.5">
                      VOL RATIO
                      <HelpCircle className="w-2 h-2 text-slate-600" />
                    </span>
                    <span className="text-slate-300 font-semibold">{al.indicators.volumeRatio.toFixed(1)}x</span>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/vol:block w-40 p-2 bg-slate-950 border border-slate-830 border-slate-800 text-slate-305 text-slate-300 rounded text-[9px] font-sans font-normal leading-normal shadow-xl z-55 text-center">
                      <strong>Volume Ratio</strong>: Relative daily volume multiplier vs 20-day mean. Higher means more breakout conviction.
                    </span>
                  </div>
                </div>

              </div>

              {/* Investigate setup trigger */}
              <button
                onClick={() => onSelectSymbol(al.symbol)}
                className="w-full bg-slate-950 border-t border-slate-800 py-3 text-center text-xs text-indigo-400 font-mono font-bold hover:text-indigo-300 hover:bg-slate-900 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                INVESTIGATE SETUP CHART
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
