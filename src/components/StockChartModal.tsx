/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  X, 
  TrendingUp, 
  Activity, 
  BarChart4, 
  Maximize2, 
  ListCollapse, 
  ToggleLeft, 
  ToggleRight 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine,
  ComposedChart
} from 'recharts';
import { StockAnalysis, StockQuote } from '../types.js';

interface StockChartModalProps {
  stock: StockAnalysis;
  onClose: () => void;
}

export default function StockChartModal({ stock, onClose }: StockChartModalProps) {
  const [history, setHistory] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Indicator toggles
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(false);
  const [showBB, setShowBB] = useState(true);
  const [timeframe, setTimeframe] = useState<'ALL' | '1M' | '3M'>('ALL');

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/stocks/history?symbol=${encodeURIComponent(stock.symbol)}`);
        if (!res.ok) {
          throw new Error(`Failed to load historical charts: ${res.statusText}`);
        }
        const data = await res.json();
        
        // Let's augment history with calculated indicator series chronologically so the chart renders moving averages and BB bands correctly
        const sortedQuotes = [...data.history].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const historicalWithIndicators = sortedQuotes.map((q, idx, arr) => {
          const closes = arr.slice(0, idx + 1).map(x => x.close);
          
          // Calculate SMA 20
          let sma20Val: number | null = null;
          if (idx >= 19) {
            sma20Val = closes.slice(idx - 19, idx + 1).reduce((s, c) => s + c, 0) / 20;
          }

          // Calculate SMA 50
          let sma50Val: number | null = null;
          if (idx >= 49) {
            sma50Val = closes.slice(idx - 49, idx + 1).reduce((s, c) => s + c, 0) / 50;
          }

          // Calculate SMA 200
          let sma200Val: number | null = null;
          if (idx >= 199) {
            sma200Val = closes.slice(idx - 199, idx + 1).reduce((s, c) => s + c, 0) / 200;
          }

          // Calculate BB (20,2)
          let bbUpperVal: number | null = null;
          let bbLowerVal: number | null = null;
          let bbMiddleVal: number | null = null;
          if (idx >= 19 && sma20Val !== null) {
            bbMiddleVal = sma20Val;
            const mean = sma20Val;
            const diffSqSum = closes.slice(idx - 19, idx + 1).reduce((sum, c) => sum + Math.pow(c - mean, 2), 0);
            const stdDev = Math.sqrt(diffSqSum / 20);
            bbUpperVal = mean + (2 * stdDev);
            bbLowerVal = mean - (2 * stdDev);
          }

          // Calculate RSI
          let rsiVal: number | null = null;
          if (idx >= 14) {
            let gains = 0;
            let losses = 0;
            for (let i = idx - 13; i <= idx; i++) {
              const diff = arr[i].close - arr[i - 1].close;
              if (diff > 0) gains += diff;
              else losses -= diff;
            }
            let avgGain = gains / 14;
            let avgLoss = losses / 14;
            
            if (avgLoss === 0) rsiVal = 100;
            else {
              const rs = avgGain / avgLoss;
              rsiVal = 100 - (100 / (1 + rs));
            }
          }

          return {
            ...q,
            sma20: sma20Val,
            sma50: sma50Val,
            sma200: sma200Val,
            bbUpper: bbUpperVal,
            bbLower: bbLowerVal,
            bbMiddle: bbMiddleVal,
            rsi: rsiVal,
          };
        });

        setHistory(historicalWithIndicators);
      } catch (err: any) {
        setError(err.message || 'Error occurred loading historical data.');
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [stock.symbol]);

  // Filter history based on timeframe selection
  const filteredHistory = history.filter((_, idx) => {
    if (timeframe === 'ALL') return true;
    const itemsCount = timeframe === '1M' ? 20 : 60;
    return idx >= history.length - itemsCount;
  });

  return (
    <div id="chart-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 md:p-6 backdrop-blur-xs">
      <div className="flex flex-col w-full h-[95vh] max-w-6xl bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-sans text-slate-100">{stock.symbol}</h2>
                <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-sm bg-slate-800 text-slate-400">EQ SERIES</span>
              </div>
              <p className="text-xs text-slate-400">Sectoral Technical Breakdown & Trend Visualization</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right mr-4 text-xs">
              <p className="text-slate-400 font-sans">LTP (Last Traded Price)</p>
              <div className="flex items-center gap-1.5 justify-end">
                <span className="font-mono font-bold text-base text-slate-100">₹{stock.price.toFixed(2)}</span>
                <span className={`font-mono font-medium rounded px-1.5 py-0.25 ${stock.change >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                  {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                </span>
              </div>
            </div>
            <button 
              id="close-modal-btn"
              onClick={onClose} 
              className="p-1.5 cursor-pointer rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Container */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          
          {/* Chart Pane */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            
            {/* Control Filters Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-2.5 bg-slate-950/45 border border-slate-800/80 rounded-lg font-mono text-xs text-slate-300">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showSMA20} 
                    onChange={e => setShowSMA20(e.target.checked)} 
                    className="accent-emerald-500"
                  />
                  <span className="text-emerald-400 font-semibold">SMA-20</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showSMA50} 
                    onChange={e => setShowSMA50(e.target.checked)} 
                    className="accent-yellow-500"
                  />
                  <span className="text-yellow-400 font-semibold">SMA-50</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showSMA200} 
                    onChange={e => setShowSMA200(e.target.checked)} 
                    className="accent-rose-500"
                  />
                  <span className="text-rose-400 font-semibold">SMA-200</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showBB} 
                    onChange={e => setShowBB(e.target.checked)} 
                    className="accent-purple-500"
                  />
                  <span className="text-purple-400 font-semibold">Bollinger Bands (20,2)</span>
                </label>
              </div>

              {/* Timeframe selector */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded">
                {(['ALL', '3M', '1M'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 rounded transition-all cursor-pointer font-bold ${timeframe === tf ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                  >
                    {tf === 'ALL' ? '1 YEAR' : tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Display loader or chart */}
            {loading ? (
              <div className="flex flex-col items-center justify-center flex-1 py-12">
                <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
                <p className="text-sm font-mono text-slate-400">Downloading historical candletables and indicators...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
                <p className="text-rose-400 font-semibold font-mono text-sm mb-2">Error: {error}</p>
                <p className="text-xs text-slate-500">Run sync to fetch this symbol's historical bhavcopy file.</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-12">
                <p className="text-slate-500 font-mono text-sm">No historical trade ticks available. Sync NSE dataset in main desk.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-4">
                {/* Main Price Area & Moving Averages */}
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" tickFormatter={(str) => {
                        const parts = str.split('-');
                        return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : str;
                      }} style={{ fontSize: '10px', fontFamily: 'monospace' }} />
                      <YAxis domain={['auto', 'auto']} stroke="#64748b" style={{ fontSize: '10px', fontFamily: 'monospace' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}
                        itemStyle={{ fontSize: '12px', fontFamily: 'monospace', padding: '1px 0' }}
                        formatter={(value: any, name: any) => [`₹${parseFloat(value).toFixed(2)}`, name.toUpperCase()]}
                      />
                      
                      {/* Price Gradient Area */}
                      <Area type="monotone" dataKey="close" name="Close" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#priceGradient)" />
                      
                      {/* Technical Indicators lines */}
                      {showSMA20 && <Line type="monotone" dataKey="sma20" name="SMA (20)" stroke="#10b981" strokeWidth={1.5} dot={false} activeDot={false} />}
                      {showSMA50 && <Line type="monotone" dataKey="sma50" name="SMA (50)" stroke="#eab308" strokeWidth={1.5} dot={false} activeDot={false} />}
                      {showSMA200 && <Line type="monotone" dataKey="sma200" name="SMA (200)" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={false} />}
                      
                      {/* Bollinger Bands Overlay */}
                      {showBB && <Line type="monotone" dataKey="bbUpper" name="BB Upper" stroke="#c084fc" strokeWidth={1} strokeDasharray="3 3" dot={false} activeDot={false} />}
                      {showBB && <Line type="monotone" dataKey="bbLower" name="BB Lower" stroke="#c084fc" strokeWidth={1} strokeDasharray="3 3" dot={false} activeDot={false} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Relative Volume Sub-Bar */}
                <div className="h-[90px] w-full">
                  <div className="flex justify-between items-center px-1 mb-1 font-mono text-[10px] text-slate-500">
                    <span>TRADE VOLUME</span>
                    <span>LTP VOLUME: {stock.volume.toLocaleString()}</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredHistory} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" hide />
                      <YAxis stroke="#64748b" style={{ fontSize: '10px', fontFamily: 'monospace' }} tickFormatter={(num) => num > 1000000 ? `${(num/1000000).toFixed(1)}M` : num > 1000 ? `${(num/1000).toFixed(0)}K` : num} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px' }}
                        itemStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                        labelStyle={{ display: 'none' }}
                      />
                      <Bar 
                        dataKey="volume" 
                        name="Volume" 
                        fill="#38bdf8" 
                        radius={[2, 2, 0, 0]}
                        opacity={0.7}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* RSI Sub-Oscillator (Synchronized) */}
                <div className="h-[105px] w-full">
                  <div className="flex justify-between items-center px-1 mb-1 font-mono text-[10px] text-slate-500">
                    <span>RELATIVE STRENGTH INDEX (RSI-14)</span>
                    <span className={stock.indicators.rsi && stock.indicators.rsi <= 30 ? 'text-emerald-400 animate-pulse font-bold' : stock.indicators.rsi && stock.indicators.rsi >= 70 ? 'text-rose-400 animate-pulse font-bold' : ''}>
                      CURRENT: {stock.indicators.rsi ? stock.indicators.rsi.toFixed(1) : 'Calculating'}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredHistory} margin={{ top: 5, right: 10, left: -20, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" tickFormatter={(str) => {
                        const parts = str.split('-');
                        return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : str;
                      }} style={{ fontSize: '10px', fontFamily: 'monospace' }} />
                      <YAxis domain={[0, 100]} ticks={[30, 50, 70]} stroke="#64748b" style={{ fontSize: '9px', fontFamily: 'monospace' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px' }}
                        itemStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                        labelStyle={{ display: 'none' }}
                      />
                      
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Overbought (70)', fill: '#ef4444', position: 'insideRight', fontSize: 9, fontFamily: 'monospace' }} />
                      <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Oversold (30)', fill: '#10b981', position: 'insideRight', fontSize: 9, fontFamily: 'monospace' }} />
                      
                      <Area type="monotone" dataKey="rsi" name="RSI" stroke="#a78bfa" strokeWidth={1.5} fill="#a78bfa" fillOpacity={0.04} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

              </div>
            )}
          </div>

          {/* Right Sidebar - Quantitative Analysis Parameter Checklist */}
          <div className="w-full lg:w-[325px] p-4 bg-slate-950/40 border-t lg:border-t-0 lg:border-l border-slate-800 font-sans flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-sm font-bold font-sans tracking-wide text-slate-300 uppercase flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <BarChart4 className="w-4 h-4 text-indigo-400" />
                QUANT CHECKLIST
              </h3>

              {/* Price Details */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Open Value</span>
                  <span className="text-slate-200">₹{stock.open.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Daily High</span>
                  <span className="text-slate-200 text-emerald-400 font-medium">₹{stock.high.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Daily Low</span>
                  <span className="text-slate-200 text-rose-400 font-medium">₹{stock.low.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Traded Value</span>
                  <span className="text-slate-200">₹{(stock.value / 10000000).toFixed(2)} Cr</span>
                </div>
              </div>

              {/* Technical Indicator Stats */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-slate-400 font-mono">Calculated Parameters</p>
                <div className="space-y-2 text-xs font-mono">
                  
                  {/* ATR (Average True Range) */}
                  <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-800/60">
                    <span className="text-slate-400">ATR (14-day)</span>
                    <span className="text-slate-200">
                      {stock.indicators.atr ? `₹${stock.indicators.atr.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>

                  {/* Beta volatility */}
                  <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-800/60">
                    <span className="text-slate-400">Standard Deviation</span>
                    <span className="text-slate-200">
                      {stock.indicators.volatility ? `${stock.indicators.volatility.toFixed(3)}%` : 'N/A'}
                    </span>
                  </div>

                  {/* Volume shock */}
                  <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-800/60">
                    <span className="text-slate-400">Volume Ratio (vs 20MA)</span>
                    <span className={`font-semibold ${stock.indicators.volumeRatio > 2.0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {stock.indicators.volumeRatio.toFixed(2)}x
                    </span>
                  </div>

                  {/* Bollinger Band channel Width */}
                  <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-800/60">
                    <span className="text-slate-400">BB Bandwidth</span>
                    <span className={`font-semibold ${stock.indicators.bbWidth && stock.indicators.bbWidth < 0.08 ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {stock.indicators.bbWidth ? `${(stock.indicators.bbWidth * 100).toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical patterns matched */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 font-mono">Detected Technical Profiles</p>
                <div className="flex flex-wrap gap-1.5">
                  {stock.patterns.length > 0 ? (
                    stock.patterns.map((pt, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wide bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {pt}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">No specific breakouts triggered. Stable sideways trend.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Strategic Analysis Summary Scores */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-3 font-mono">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Breakout Probability</span>
                  <span className={`font-bold ${stock.breakoutScore >= 7 ? 'text-emerald-400' : stock.breakoutScore >= 5 ? 'text-yellow-400' : 'text-slate-400'}`}>{stock.breakoutScore}/10</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${stock.breakoutScore >= 7 ? 'bg-emerald-500' : stock.breakoutScore >= 5 ? 'bg-yellow-500' : 'bg-slate-600'}`}
                    style={{ width: `${stock.breakoutScore * 10}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Trend Reversal Score</span>
                  <span className={`font-bold ${stock.reversalScore >= 7 ? 'text-emerald-400' : stock.reversalScore >= 5 ? 'text-yellow-400' : 'text-slate-400'}`}>{stock.reversalScore}/10</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${stock.reversalScore >= 7 ? 'bg-emerald-500' : stock.reversalScore >= 5 ? 'bg-yellow-500' : 'bg-slate-600'}`}
                    style={{ width: `${stock.reversalScore * 10}%` }}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-400 leading-relaxed font-sans">
                <span className="font-bold text-slate-300 block mb-1">Trading Strategy Guide:</span>
                {stock.breakoutScore >= 7 
                  ? "Highly explosive technical structure. Enter above multi-day pivot ceiling with stop loss below nearest support."
                  : stock.reversalScore >= 7
                  ? "High probability swing bottom. Bullish divergence visible. Great risk-reward entry zone."
                  : "Stable sideways price action. Trade Bollinger Band range floors or wait for volume shock breakout."}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
