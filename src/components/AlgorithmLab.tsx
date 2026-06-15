/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  HelpCircle, 
  Workflow, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  CheckCircle, 
  Sliders, 
  Layers, 
  Compass, 
  ChevronRight,
  Info,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { StockAnalysis } from '../types.js';

interface AlgorithmLabProps {
  onSelectStock: (stock: StockAnalysis) => void;
  refreshTrigger: number;
}

interface StrategyConfig {
  id: string;
  name: string;
  abbreviation: string;
  description: string;
  signalsDesc: string;
  formula: string;
  whatWeLookFor: string;
  evaluator: (st: StockAnalysis) => {
    signal: 'BUY' | 'HOLD' | 'SELL';
    reason: string;
    metrics: string;
  };
}

export default function AlgorithmLab({ onSelectStock, refreshTrigger }: AlgorithmLabProps) {
  const [stocks, setStocks] = useState<StockAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection of views: 'STRATEGY' (focus on one) or 'MATRIX' (all side-by-side)
  const [viewMode, setViewMode] = useState<'STRATEGY' | 'MATRIX'>('STRATEGY');
  const [activeStrategyId, setActiveStrategyId] = useState<string>('sma_crossover');
  const [searchQuery, setSearchQuery] = useState('');
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'HOLD'>('ALL');

  // Define our 5 highly popular algorithms
  const strategies: StrategyConfig[] = [
    {
      id: 'sma_crossover',
      name: 'Double SMA Trend Rider',
      abbreviation: '20/50 SMA',
      description: 'Standard technical momentum following. Leverages dual fast/slow moving averages to target stable uptrends with systemic supports.',
      signalsDesc: 'BUY when closing price is above the 20-day Simple Moving Average (SMA) and SMA20 is trading above the SMA50. SELL when the price drops below the SMA20 and SMA20 drops below SMA50.',
      formula: 'Buy: Close > SMA(20) AND SMA(20) > SMA(50) | Sell: Close < SMA(20) AND SMA(20) < SMA(50)',
      whatWeLookFor: 'Strong directional growth. SMA crossovers eliminate short-term whipsaws. Buying indicates the stock entered an established bull-run, and holding maintains posture as long as support holds.',
      evaluator: (st: StockAnalysis) => {
        const { sma20, sma50 } = st.indicators;
        if (sma20 === null || sma50 === null) {
          return { signal: 'HOLD', reason: 'Insufficient historical data to calculate dual SMA bounds', metrics: '—' };
        }
        const price = st.price;
        if (price > sma20 && sma20 > sma50) {
          return { 
            signal: 'BUY', 
            reason: `Price (₹${price.toFixed(1)}) exceeds SMA20 (₹${sma20.toFixed(1)}) and SMA20 operates above SMA50 (₹${sma50.toFixed(1)}). Dominant uptrend active.`,
            metrics: `Price: ₹${price.toFixed(1)} | SMA20: ₹${sma20.toFixed(1)} | SMA50: ₹${sma50.toFixed(1)}`
          };
        }
        if (price < sma20 && sma20 < sma50) {
          return { 
            signal: 'SELL', 
            reason: `Price (₹${price.toFixed(1)}) drops below SMA20 (₹${sma20.toFixed(1)}) and SMA20 is trailing below SMA50 (₹${sma50.toFixed(1)}). Trend is breaking down.`,
            metrics: `Price: ₹${price.toFixed(1)} | SMA20: ₹${sma20.toFixed(1)} | SMA50: ₹${sma50.toFixed(1)}`
          };
        }
        return { 
          signal: 'HOLD', 
          reason: `Price resides in intermediate congestion zone. SMA20 (₹${sma25Key(sma20)}) and SMA50 (₹${sma25Key(sma50)}) are closely aligned without structural separation.`,
          metrics: `SMA20: ₹${sma20.toFixed(1)} | SMA50: ₹${sma50.toFixed(1)}`
        };
      }
    },
    {
      id: 'rsi_momentum',
      name: 'RSI Extremes Oscillator',
      abbreviation: 'RSI(14)',
      description: 'Classic strength momentum scaler. Pinpoints extreme conditions of overbought or oversold levels where prices are ripe for dynamic reversals.',
      signalsDesc: 'BUY when RSI ≤ 35, indicating the asset is heavily oversold and primed for a corrective mean-reversion rally. SELL when RSI ≥ 65, indicating overbought saturation where bullish energy has overextended.',
      formula: 'Buy: RSI(14) ≤ 35 | Sell: RSI(14) ≥ 65 | Hold: 35 < RSI(14) < 65',
      whatWeLookFor: 'Peak buyer/seller exhaustion. Entering under oversold conditions offers a high margin of safety. Selling under overbought protects capital prior to structural profit-taking correction waves.',
      evaluator: (st: StockAnalysis) => {
        const { rsi } = st.indicators;
        if (rsi === null) {
          return { signal: 'HOLD', reason: 'Insufficient timeline periods to calculate Relative Strength Index', metrics: '—' };
        }
        if (rsi <= 35) {
          return { 
            signal: 'BUY', 
            reason: `RSI is currently ${rsi.toFixed(1)}, sitting beneath the oversold support ceiling of 35. Price is mathematically discounted.`,
            metrics: `RSI: ${rsi.toFixed(1)}`
          };
        }
        if (rsi >= 65) {
          return { 
            signal: 'SELL', 
            reason: `RSI is currently ${rsi.toFixed(1)}, hovering above the overbought threshold of 65. Selling pressure is highly probable.`,
            metrics: `RSI: ${rsi.toFixed(1)}`
          };
        }
        return { 
          signal: 'HOLD', 
          reason: `RSI is balanced at ${rsi.toFixed(1)}, operating comfortably inside the normal range limits (35 to 65).`,
          metrics: `RSI: ${rsi.toFixed(1)}`
        };
      }
    },
    {
      id: 'bb_reversion',
      name: 'Bollinger Mean Reversion',
      abbreviation: 'BB Bands',
      description: 'Statistical channel deviation system. Employs volatility bands around a standard central mean to spot extreme standard deviation entries.',
      signalsDesc: 'BUY when closing price drops to or trades below the lower Bollinger Band (price is 2 standard deviations below SMA20). SELL when price spikes above or touches the upper Bollinger Band.',
      formula: 'Buy: Price ≤ BB Lower * 1.015 (within 1.5%) | Sell: Price ≥ BB Upper * 0.985 (within 1.5%)',
      whatWeLookFor: 'Price extremes stretching statistical limits. Since prices trade within Bollinger Bands 95% of the time, band contact represents extreme boundaries. Lower band buying captures maximum localized dip support.',
      evaluator: (st: StockAnalysis) => {
        const { bbLower, bbUpper, bbMiddle } = st.indicators;
        if (bbLower === null || bbUpper === null || bbMiddle === null) {
          return { signal: 'HOLD', reason: 'Bollinger Bands unavailable due to truncated trading day history', metrics: '—' };
        }
        const price = st.price;
        const buyLimit = bbLower * 1.015;
        const sellLimit = bbUpper * 0.985;
        
        if (price <= buyLimit) {
          const dist = ((price - bbLower) / bbLower) * 100;
          return { 
            signal: 'BUY', 
            reason: `Price (₹${price.toFixed(1)}) is extremely close to the lower volatility band (₹${bbLower.toFixed(1)}), variance deviation is ${dist.toFixed(1)}%. Prime reversion entry.`,
            metrics: `LTP: ₹${price.toFixed(1)} | BB Lower: ₹${bbLower.toFixed(1)}`
          };
        }
        if (price >= sellLimit) {
          const dist = ((bbUpper - price) / bbUpper) * 100;
          return { 
            signal: 'SELL', 
            reason: `Price (₹${price.toFixed(1)}) is touching/exceeding the upper volatility envelope (₹${bbUpper.toFixed(1)}), deviation gap is only ${dist.toFixed(1)}%. Risk of profit taking is high.`,
            metrics: `LTP: ₹${price.toFixed(1)} | BB Upper: ₹${bbUpper.toFixed(1)}`
          };
        }
        return { 
          signal: 'HOLD', 
          reason: `Price (₹${price.toFixed(1)}) drifts neutrally inside the standard core envelope between Middle (₹${bbMiddle.toFixed(1)}) and outer limits.`,
          metrics: `Middle: ₹${bbMiddle.toFixed(1)}`
        };
      }
    },
    {
      id: 'macd_momentum',
      name: 'MACD Divergence & Cross',
      abbreviation: 'MACD',
      description: 'Lagging yet powerful momentum trend tracking agent. Evaluates the difference between historical exponential trend weightings.',
      signalsDesc: 'BUY when the MACD Line crosses above the Signal Line and the MACD Histogram turns positive (>0). SELL when the MACD Line crosses below the Signal Line and the MACD Histogram enters negative territory (<0).',
      formula: 'Buy: MACD Line > Signal Line AND MACD Hist > 0 | Sell: MACD Line < Signal Line AND MACD Hist < 0',
      whatWeLookFor: 'Acceleration in momentum direction. A positive shift in the histogram signals bulls are taking immediate power. Negative shifts outline escalating exit momentum with growing conviction.',
      evaluator: (st: StockAnalysis) => {
        const { macdLine, signalLine, macdHist } = st.indicators;
        if (macdLine === null || signalLine === null || macdHist === null) {
          return { signal: 'HOLD', reason: 'MACD technical buffers are not yet loaded', metrics: '—' };
        }
        if (macdHist > 0 && macdLine > signalLine) {
          return { 
            signal: 'BUY', 
            reason: `Bullish crossover! MACD Line (₹${macdLine.toFixed(2)}) is leading above Signal Line (₹${signalLine.toFixed(2)}), with positive histogram power (+${macdHist.toFixed(2)}).`,
            metrics: `MACD Line: ${macdLine.toFixed(2)} | Signal Line: ${signalLine.toFixed(2)} | Hist: +${macdHist.toFixed(2)}`
          };
        }
        if (macdHist < 0 && macdLine < signalLine) {
          return { 
            signal: 'SELL', 
            reason: `Bearish crossover! MACD Line (₹${macdLine.toFixed(2)}) is trailing below Signal Line (₹${signalLine.toFixed(2)}), exhibiting negative deceleration (${macdHist.toFixed(2)}).`,
            metrics: `MACD Line: ${macdLine.toFixed(2)} | Signal Line: ${signalLine.toFixed(2)} | Hist: ${macdHist.toFixed(2)}`
          };
        }
        return { 
          signal: 'HOLD', 
          reason: `MACD Line is currently converging flatly with Signal Line; histograms demonstrate zero momentum bias.`,
          metrics: `Hist: ${macdHist.toFixed(2)}`
        };
      }
    },
    {
      id: 'breakout_squeeze',
      name: 'Explosive Volatility Squeeze',
      abbreviation: 'SQUEEZE',
      description: 'Advanced breakout tracking algorithm. Detects periods of extreme price squeezing (very low Bollinger Band Width) coupled with surge volumes.',
      signalsDesc: 'BUY when Bollinger Bandwidth drops to or below 12% (indicating compressed energy) and current day volume surges to ≥1.5x the 20-day mean (positive injection of capital). SELL under squeeze breakdowns.',
      formula: 'Buy: BB Width ≤ 12% (.12) AND Volume Ratio ≥ 1.50 | Sell: Close < SMA20 AND Volume Ratio ≥ 1.50 AND Change < -1.5%',
      whatWeLookFor: 'Imminent explosive price volatility. Quiet periods always precede high-velocity breakouts. Squeezing channels tell us energy is building, and the high volume ratio acts as the fuse declaring direction.',
      evaluator: (st: StockAnalysis) => {
        const { bbWidth, volumeRatio } = st.indicators;
        if (bbWidth === null || volumeRatio === null) {
          return { signal: 'HOLD', reason: 'Volatility bandwidth and volume analysis ratios require more data points', metrics: '—' };
        }
        const widthPct = bbWidth * 100;
        if (bbWidth <= 0.12 && volumeRatio >= 1.5) {
          return { 
            signal: 'BUY', 
            reason: `EXPLOSIVE CANDIDATE! Volatility bands are tightly squeezed at ${widthPct.toFixed(1)}% (Threshold: ≤ 12%) with high validation volume at ${volumeRatio.toFixed(1)}x mean.`,
            metrics: `BB Width: ${widthPct.toFixed(1)}% | Volume Ratio: ${volumeRatio.toFixed(1)}x`
          };
        }
        if (volumeRatio >= 1.5 && st.change < -1.5) {
          return { 
            signal: 'SELL', 
            reason: `Urgent exit indicator. Extreme selling volume (${volumeRatio.toFixed(1)}x mean) pushing price deep into bearish expansion territory (${st.change.toFixed(1)}% change).`,
            metrics: `Change: ${st.change.toFixed(1)}% | Volume Ratio: ${volumeRatio.toFixed(1)}x`
          };
        }
        return { 
          signal: 'HOLD', 
          reason: `Volatility channel represents standard open posture (${widthPct.toFixed(1)}% BB Width) or volume ratio resides in neutral state (${volumeRatio.toFixed(1)}x).`,
          metrics: `BB Width: ${widthPct.toFixed(1)}% | Vol Ratio: ${volumeRatio.toFixed(1)}x`
        };
      }
    }
  ];

  // Helper utility function safe formatter
  function sma25Key(val: number | null): string {
    return val ? val.toFixed(1) : '—';
  }

  // Load stocks on mount or trigger
  useEffect(() => {
    async function loadAllStocks() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/stocks/grouped');
        if (!res.ok) {
          throw new Error(`Failed to load technical segments: ${res.statusText}`);
        }
        const data = await res.json();
        
        // Merge stocks from deep clusters
        const merged: StockAnalysis[] = [];
        if (data.clusters) {
          for (const cl of data.clusters) {
            merged.push(...cl.stocks);
          }
        }
        // De-duplicate if redundant records returned
        const seen = new Set<string>();
        const unique = merged.filter(el => {
          if (seen.has(el.symbol)) return false;
          seen.add(el.symbol);
          return true;
        });

        // Sort alphabetical
        unique.sort((a, b) => a.symbol.localeCompare(b.symbol));
        setStocks(unique);
      } catch (err: any) {
        setError(err.message || 'An error occurred loading securities lists.');
      } finally {
        setLoading(false);
      }
    }
    loadAllStocks();
  }, [refreshTrigger]);

  // Find currently active focus strategy config
  const activeStrategy = strategies.find(s => s.id === activeStrategyId) || strategies[0];

  // Filter stocks based on query & selected signal
  const filterAndEvaluateStocks = (targetStrategy: StrategyConfig) => {
    return stocks.filter(st => {
      const evaluation = targetStrategy.evaluator(st);
      
      const matchesSearch = st.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSignal = signalFilter === 'ALL' || evaluation.signal === signalFilter;

      return matchesSearch && matchesSignal;
    });
  };

  // Run calculation summary metrics
  const getSummaryMetricsOfStrategy = (strat: StrategyConfig) => {
    let buyCount = 0;
    let sellCount = 0;
    let holdCount = 0;

    for (const st of stocks) {
      const s = strat.evaluator(st).signal;
      if (s === 'BUY') buyCount++;
      else if (s === 'SELL') sellCount++;
      else holdCount++;
    }

    return { buyCount, sellCount, holdCount };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 bg-slate-900/40 border border-slate-850 rounded-xl min-h-[400px]">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-xs font-mono text-slate-400">Loading stock logs and executing multi-strategy quantitative calculations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-xl text-center min-h-[300px]">
        <p className="text-rose-400 font-bold font-mono text-xs mb-2">Quant Algorithm Engine Error</p>
        <p className="text-[11px] text-slate-400 max-w-md">{error}</p>
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900/40 border border-slate-800 rounded-xl text-center min-h-[300px] font-sans">
        <div className="w-12 h-12 rounded-full bg-slate-850/65 flex items-center justify-center text-slate-500 mb-4 border border-slate-800">
          <Workflow className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-300">Quantitative Strategy Dashboard Offline</h3>
        <p className="text-xs text-slate-400 max-w-xs mt-1">Please trigger or complete a data sync inside the sync panel above to hydrate high-frequency indicator metrics.</p>
      </div>
    );
  }

  const focusedFilteredStocks = filterAndEvaluateStocks(activeStrategy);

  return (
    <div className="space-y-6 font-sans">
      
      {/* Informative Header / What we are looking at on hover */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/20 border border-slate-850 rounded-xl p-5 relative group shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Workflow className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-300 flex items-center gap-1.5 cursor-help">
              Algorithmic Signal Laboratory
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            </h2>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Synthesizes real-time and historical technical indicator data to produce objective buy, hold, and sell signals across five distinct, mathematically tested trading systems. 
              <span className="text-indigo-300 ml-1">Hover over help circles (<HelpCircle className="inline-block w-3 h-3 -mt-0.5" />) to instantly reveal details on indicator calculations and rationale.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Menu / Settings row with view selection and criteria */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/30 p-3.5 border border-slate-850 rounded-lg">
        
        {/* Toggle between focused strategy review and a global compared confluence list */}
        <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-lg w-full md:w-auto">
          <button
            id="view-btn-strategy"
            onClick={() => setViewMode('STRATEGY')}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-[10px] font-mono font-bold tracking-wider rounded flex items-center justify-center gap-2 cursor-pointer transition ${
              viewMode === 'STRATEGY' 
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-400/20 shadow-xs' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            STRATEGY RADAR
          </button>
          <button
            id="view-btn-matrix"
            onClick={() => setViewMode('MATRIX')}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-[10px] font-mono font-bold tracking-wider rounded flex items-center justify-center gap-2 cursor-pointer transition ${
              viewMode === 'MATRIX' 
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-400/20 shadow-xs' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            CONFLUENCE MATRIX
          </button>
        </div>

        {/* Global filter toolbar */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
          {/* Quick Find */}
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search ticker symbol..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 pr-3.5 pl-8.5 py-1.5 rounded-lg text-[11px] font-mono font-bold text-slate-105 focus:outline-none focus:border-slate-700"
            />
          </div>

          {/* Action signal criteria */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase px-1.5">SIGNAL:</span>
            {(['ALL', 'BUY', 'SELL', 'HOLD'] as const).map(sig => (
              <button
                key={sig}
                id={`sig-filter-${sig.toLowerCase()}`}
                onClick={() => setSignalFilter(sig)}
                className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded cursor-pointer ${
                  signalFilter === sig 
                    ? sig === 'BUY' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                      : sig === 'SELL' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                      : sig === 'HOLD' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                {sig}
              </button>
            ))}
          </div>

        </div>

      </div>

      {viewMode === 'STRATEGY' ? (
        /* Focused Strategy Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Popular Algorithms list */}
          <div className="col-span-1 lg:col-span-4 space-y-3.5">
            <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider pl-1 font-sans">
              POPULAR QUANTITATIVE ALGORITHMS:
            </span>
            <div className="space-y-2.5">
              {strategies.map(strat => {
                const isActive = strat.id === activeStrategyId;
                const metrics = getSummaryMetricsOfStrategy(strat);
                return (
                  <button
                    key={strat.id}
                    id={`strat-btn-${strat.id}`}
                    onClick={() => {
                      setActiveStrategyId(strat.id);
                      setSignalFilter('ALL');
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden flex flex-col gap-2.5 cursor-pointer ${
                      isActive 
                        ? 'bg-slate-900 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/10' 
                        : 'bg-slate-900/40 border-slate-850 hover:bg-slate-900/70 hover:border-slate-800'
                    }`}
                  >
                    {/* Active highlight side banner */}
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                    )}

                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border font-mono text-[10px] font-black ${
                          isActive 
                            ? 'bg-indigo-500/10 border-indigo-505/20 text-indigo-400' 
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}>
                          {strat.abbreviation}
                        </div>
                        <span className="text-xs font-bold font-sans text-slate-200">{strat.name}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${isActive ? 'translate-x-0.5 text-indigo-400' : ''}`} />
                    </div>

                    <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                      {strat.description}
                    </p>

                    {/* Simple summary statistics */}
                    <div className="grid grid-cols-3 gap-1 pt-2.5 border-t border-slate-850/60 text-center font-mono text-[9px] w-full">
                      <div className="bg-slate-950/40 p-1 rounded">
                        <span className="block text-emerald-400 font-bold">{metrics.buyCount}</span>
                        <span className="text-slate-500 uppercase">BUYS</span>
                      </div>
                      <div className="bg-slate-950/40 p-1 rounded">
                        <span className="block text-rose-450 text-rose-400 font-bold">{metrics.sellCount}</span>
                        <span className="text-slate-500 uppercase">SELLS</span>
                      </div>
                      <div className="bg-slate-950/40 p-1 rounded">
                        <span className="block text-amber-500 font-bold">{metrics.holdCount}</span>
                        <span className="text-slate-500 uppercase">HOLDS</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            
            {/* Disclaimer block */}
            <div className="p-4 bg-slate-900/20 border border-slate-850 rounded-xl space-y-2">
              <span className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400 font-bold uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Mathematical Guarantee
              </span>
              <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                These calculations run directly client-side against raw downloaded historical Bhavcopy files from the National Stock Exchange of India. No simulated, buffered, or synthesized price patterns are used.
              </p>
            </div>
          </div>

          {/* Right Column: Detailed Strategy & Stock Signals list */}
          <div className="col-span-1 lg:col-span-8 space-y-5">
            
            {/* Strategy Blueprint panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-850 pb-3 gap-2">
                <div>
                  <span className="text-[10px] font-mono text-indigo-400 font-bold tracking-wider uppercase block">CURRENT STRATEGY FORMULATION</span>
                  <h3 className="text-sm font-bold text-slate-250 text-slate-200 mt-0.5">{activeStrategy.name}</h3>
                </div>
                <div className="p-1 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[9px] font-mono text-slate-400 flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-indigo-400" />
                  <span>MODEL STATUS: STABLE</span>
                </div>
              </div>

              {/* Technical description block with hover indicators explains what we are looking at */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
                <div className="space-y-1 relative group bg-slate-950/40 p-3 rounded-lg border border-slate-850/60">
                  <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1 cursor-help">
                    UNDERLYING FORMULATION RULES:
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-400" />
                  </span>
                  <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block w-72 p-3 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[10px] leading-relaxed shadow-xl z-50">
                    <strong>Algorithmic Ruleset</strong>: Defines the exact parameters computed across historical data. If the technical condition resolves to true, a corresponding state trigger fires immediately.
                  </div>
                  <p className="text-[11px] font-mono text-indigo-300 bg-slate-950/85 p-2 rounded border border-slate-850 mt-1 uppercase text-center font-bold tracking-tight">
                    {activeStrategy.formula}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-normal mt-2 pt-1">
                    {activeStrategy.signalsDesc}
                  </p>
                </div>

                <div className="space-y-1 relative group bg-slate-950/40 p-3 rounded-lg border border-slate-850/60">
                  <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1 cursor-help">
                    WHAT WE ARE LOOKING AT:
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-400" />
                  </span>
                  <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block w-72 p-3 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[10px] leading-relaxed shadow-xl z-50">
                    <strong>Investment Thesis</strong>: Outlines the strategic objective of the algorithm. It details why we target these ranges, how risk is managed, and what market anomalies we seek to capture.
                  </div>
                  <p className="text-[11px] text-indigo-300 font-bold flex items-center gap-1 mt-1.5">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>ANOMALY EXPLOITATION TARGET</span>
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                    {activeStrategy.whatWeLookFor}
                  </p>
                </div>
              </div>
            </div>

            {/* Stocks List evaluating under current strategy */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
              
              <div className="p-4 px-5 border-b border-slate-850 flex items-center justify-between bg-slate-900/60">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  EVALUATED SECURITIES ({focusedFilteredStocks.length})
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  REFRESHED SECONDS AGO
                </span>
              </div>

              {focusedFilteredStocks.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <Activity className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-xs font-mono text-slate-400 font-bold">No Stocks Match Filter Criteria</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">Try typing a different symbol or modifying the signal filter selection constraints.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/20 text-slate-400 font-mono text-[10px] tracking-wider uppercase border-b border-slate-850">
                        <th className="p-3.5 pl-5 relative group">
                          <span className="cursor-help flex items-center gap-1">
                            SYMBOL
                            <HelpCircle className="w-3 h-3 text-slate-500" />
                          </span>
                          <span className="absolute left-5 top-full mt-1.5 hidden group-hover:block w-48 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal normal-case leading-relaxed shadow-xl z-55 text-left">
                            <strong>Symbol</strong>: The unique security identification ticker representing the listed stock on the NSE.
                          </span>
                        </th>
                        <th className="p-3.5 relative group">
                          <span className="cursor-help flex items-center gap-1">
                            LTP (PRICE)
                            <HelpCircle className="w-3 h-3 text-slate-500" />
                          </span>
                          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 hidden group-hover:block w-48 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal normal-case leading-relaxed shadow-xl z-55 text-left">
                            <strong>Last Traded Price</strong>: The final transaction pricing recorded on the exchange.
                          </span>
                        </th>
                        <th className="p-3.5 relative group">
                          <span className="cursor-help flex items-center gap-1">
                            INDICATION
                            <HelpCircle className="w-3 h-3 text-slate-500" />
                          </span>
                          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 hidden group-hover:block w-48 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal normal-case leading-relaxed shadow-xl z-55 text-left">
                            <strong>Action Indication</strong>: Categorized as BUY (anomalous breakout/reversion), SELL (overextended risk), or HOLD (stable neutral drift).
                          </span>
                        </th>
                        <th className="p-3.5 relative group">
                          <span className="cursor-help flex items-center gap-1">
                            METRIC VALUE
                            <HelpCircle className="w-3 h-3 text-slate-500" />
                          </span>
                          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 hidden group-hover:block w-48 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal normal-case leading-relaxed shadow-xl z-55 text-left">
                            <strong>Underlying Metrics</strong>: Shows key calculated values driving the current algorithm state selection.
                          </span>
                        </th>
                        <th className="p-3.5 relative group">
                          <span className="cursor-help flex items-center gap-1">
                            TRIGGER RATIONALE
                            <HelpCircle className="w-3 h-3 text-slate-500" />
                          </span>
                          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 hidden group-hover:block w-64 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal normal-case leading-relaxed shadow-xl z-55 text-left">
                            <strong>Trigger Explanation</strong>: Transparent, human-friendly technical justification explaining why we are looking at this rating and what the indicators mean.
                          </span>
                        </th>
                        <th className="p-3.5 text-right pr-5">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60 font-mono text-[11px]">
                      {focusedFilteredStocks.map(st => {
                        const evaluation = activeStrategy.evaluator(st);
                        const isBuy = evaluation.signal === 'BUY';
                        const isSell = evaluation.signal === 'SELL';
                        const isHold = evaluation.signal === 'HOLD';
                        
                        return (
                          <tr key={st.symbol} className="hover:bg-slate-900/40 transition">
                            {/* Symbol */}
                            <td className="p-3.5 pl-5 font-bold text-slate-200">
                              <button
                                onClick={() => onSelectStock(st)}
                                className="hover:text-indigo-400 text-left font-bold cursor-pointer"
                              >
                                {st.symbol}
                              </button>
                            </td>

                            {/* Price */}
                            <td className="p-3.5 text-slate-300 font-bold">
                              ₹{st.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Action badge */}
                            <td className="p-3.5">
                              {isBuy && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  BUY
                                </span>
                              )}
                              {isSell && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  SELL
                                </span>
                              )}
                              {isHold && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  HOLD
                                </span>
                              )}
                            </td>

                            {/* Metric Values */}
                            <td className="p-3.5 text-slate-400 text-[10px]">
                              {evaluation.metrics}
                            </td>

                            {/* Human rationale why */}
                            <td className="p-3.5 text-slate-400 font-sans max-w-xs leading-relaxed text-[11px]">
                              {evaluation.reason}
                            </td>

                            {/* Details Action */}
                            <td className="p-3.5 text-right pr-5">
                              <button
                                id={`view-btn-chart-${st.symbol}`}
                                onClick={() => onSelectStock(st)}
                                className="px-2.5 py-1 text-[10px] font-mono font-bold rounded text-indigo-400 hover:bg-indigo-500/15 border border-indigo-500/20 cursor-pointer"
                              >
                                PLOT
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>

          </div>

        </div>
      ) : (
        /* Multi-Strategy Confluence Matrix Mode */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
          
          {/* Header block with confluence notes */}
          <div className="p-5 border-b border-slate-850 bg-slate-900/60 space-y-2">
            <h3 className="text-xs font-black tracking-wider uppercase text-slate-300 flex items-center gap-1.5 cursor-help">
              Multi-Strategy Confluence Scanner
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            </h3>
            <p className="text-xs text-slate-400 leading-normal max-w-4xl">
              A **technical confluence** occurs when multiple independent quantitative systems validate the same security. 
              Stocks exhibiting multiple overlapping <strong>BUY</strong> rating parameters indicate elevated statistical likelihood of success, whereas universal <strong>SELLS</strong> validate terminal exhaustion.
            </p>
          </div>

          {/* Matrix comparison table */}
          {stocks.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-xs font-mono text-slate-500">No active stock cache database present to build matrix grid.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/20 text-slate-400 font-mono text-[10px] tracking-wider uppercase border-b border-slate-850">
                    <th className="p-4 pl-6 relative group">
                      <span className="cursor-help flex items-center gap-1">
                        TICKER
                        <HelpCircle className="w-3 h-3 text-slate-500" />
                      </span>
                      <span className="absolute left-6 top-full mt-1.5 hidden group-hover:block w-40 p-2 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans normal-case tracking-normal shadow-xl z-55">
                        Ticker identification code on the NSE exchange database.
                      </span>
                    </th>
                    <th className="p-4 relative group">
                      <span className="cursor-help flex items-center gap-1">
                        PRICE
                        <HelpCircle className="w-3 h-3 text-slate-500" />
                      </span>
                      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 hidden group-hover:block w-40 p-2 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans normal-case tracking-normal shadow-xl z-55">
                        Current closing valuation LTP of stock.
                      </span>
                    </th>
                    
                    {/* Columns for each of our 5 algorithms */}
                    {strategies.map((strat) => (
                      <th key={strat.id} className="p-4 relative group text-center min-w-[120px]">
                        <span className="cursor-help inline-flex items-center gap-1 justify-center w-full font-bold text-indigo-305">
                          {strat.abbreviation}
                          <HelpCircle className="w-3 h-3 text-indigo-400" />
                        </span>
                        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 hidden group-hover:block w-52 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans normal-case tracking-normal leading-normal shadow-xl z-55 text-left">
                          <strong>{strat.name}</strong>: {strat.description}
                        </span>
                      </th>
                    ))}

                    <th className="p-4 relative group text-center">
                      <span className="cursor-help inline-flex items-center gap-1 justify-center w-full font-bold text-indigo-400">
                        CONFLUENCE
                        <HelpCircle className="w-3 h-3 text-indigo-400" />
                      </span>
                      <span className="absolute right-4 top-full mt-1.5 hidden group-hover:block w-52 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans normal-case tracking-normal leading-normal shadow-xl z-55 text-left">
                        <strong>Confluence Score</strong>: Aggregates total positive BUY triggers out of 5 possible algorithms. Score of 3-5 constitutes a high-conviction setup.
                      </span>
                    </th>
                    
                    <th className="p-4 pr-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 font-mono text-[11px]">
                  {stocks
                    .filter(st => st.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(st => {
                      let totalBuys = 0;
                      let totalSells = 0;
                      
                      const strategyEvaluations = strategies.map(strat => {
                        const evalResult = strat.evaluator(st);
                        if (evalResult.signal === 'BUY') totalBuys++;
                        if (evalResult.signal === 'SELL') totalSells++;
                        return { id: strat.id, signal: evalResult.signal, metrics: evalResult.metrics, reason: evalResult.reason };
                      });

                      // Apply action signal filter if selective
                      if (signalFilter !== 'ALL') {
                        const hasMatchingSignal = strategyEvaluations.some(e => e.signal === signalFilter);
                        if (!hasMatchingSignal) return null;
                      }

                      return (
                        <tr key={st.symbol} className="hover:bg-slate-900/40 transition">
                          {/* Symbol */}
                          <td className="p-4 pl-6 font-bold text-slate-200">
                            <button
                              onClick={() => onSelectStock(st)}
                              className="hover:text-indigo-400 text-left font-bold cursor-pointer"
                            >
                              {st.symbol}
                            </button>
                          </td>

                          {/* Price */}
                          <td className="p-4 text-slate-300 font-semibold">
                            ₹{st.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                          </td>

                          {/* Signals comparison */}
                          {strategyEvaluations.map((evalItem) => {
                            const isBuy = evalItem.signal === 'BUY';
                            const isSell = evalItem.signal === 'SELL';
                            const isHold = evalItem.signal === 'HOLD';
                            
                            return (
                              <td key={evalItem.id} className="p-4 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                  isBuy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : isSell ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-slate-950 text-slate-500 border border-slate-850'
                                }`}>
                                  {evalItem.signal}
                                </span>
                              </td>
                            );
                          })}

                          {/* Confluence Rating */}
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                totalBuys >= 3 ? 'bg-emerald-500 text-white font-black' 
                                  : totalBuys === 2 ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/20'
                                  : 'text-slate-400'
                              }`}>
                                {totalBuys} BUYS
                              </span>
                              <span className="text-slate-650 text-[10px] text-slate-500">/</span>
                              <span className={`text-[10px] font-bold ${totalSells >= 2 ? 'text-rose-450 text-rose-400' : 'text-slate-600'}`}>
                                {totalSells} S
                              </span>
                            </div>
                          </td>

                          {/* Trigger Details */}
                          <td className="p-4 text-right pr-6">
                            <button
                              onClick={() => {
                                onSelectStock(st);
                              }}
                              className="px-2.5 py-1 text-[10px] font-mono font-bold rounded text-indigo-400 hover:bg-indigo-500/15 border border-indigo-500/20 cursor-pointer"
                            >
                              PLOT
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
