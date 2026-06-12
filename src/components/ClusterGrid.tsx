/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Search, 
  ChevronRight, 
  TrendingUp, 
  SlidersHorizontal,
  FolderLock,
  Group,
  Zap,
  Tag,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { StockCluster, StockAnalysis } from '../types.js';

interface ClusterGridProps {
  onSelectStock: (stock: StockAnalysis) => void;
  refreshTrigger: number;
}

export default function ClusterGrid({ onSelectStock, refreshTrigger }: ClusterGridProps) {
  const [clusters, setClusters] = useState<StockCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection of active cluster category (0 to 4)
  const [activeTabIdx, setActiveTabIdx] = useState<number>(0);
  
  // Search and priority filters
  const [searchQuery, setSearchQuery] = useState('');
  const [minimumBreakoutScore, setMinimumBreakoutScore] = useState<number>(0);

  useEffect(() => {
    async function fetchClusters() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/stocks/grouped');
        if (!res.ok) {
          throw new Error(`Failed to load technical clusters: ${res.statusText}`);
        }
        const data = await res.json();
        setClusters(data.clusters || []);
      } catch (err: any) {
        setError(err.message || 'An error occurred loading dynamic stock segments.');
      } finally {
        setLoading(false);
      }
    }
    fetchClusters();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 bg-slate-900/40 border border-slate-800 rounded-xl min-h-[400px]">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-mono text-slate-400">Normalizing indicator dimensions and running K-Means cluster partitioning...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-xl text-center min-h-[300px]">
        <p className="text-rose-450 font-bold font-mono text-sm mb-2">Error Partitioning Segments</p>
        <p className="text-xs text-slate-400 max-w-md">{error}</p>
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900/40 border border-slate-800 rounded-xl text-center min-h-[300px] font-sans">
        <div className="w-12 h-12 rounded-full bg-slate-850/65 flex items-center justify-center text-slate-500 mb-4 border border-slate-800">
          <FolderLock className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-300">Technical Clustering Database Empty</h3>
        <p className="text-xs text-slate-400 max-w-xs mt-1">Please launch and complete a data sync in the command desk to partition historical stock vectors.</p>
      </div>
    );
  }

  const activeCluster = clusters[activeTabIdx];
  
  // Filter active cluster's stocks based on user query inputs
  const filteredStocks = activeCluster ? activeCluster.stocks.filter(st => {
    const matchesSearch = st.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesScore = st.breakoutScore >= minimumBreakoutScore;
    return matchesSearch && matchesScore;
  }) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-sans">
      
      {/* Cluster category tab triggers - left rail */}
      <div className="lg:col-span-1 flex flex-col gap-2.5">
        <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest px-1">
          K-MEANS PORTFOLIO DECK (K=5)
        </p>

        <div className="space-y-2">
          {clusters.map((cl, idx) => (
            <button
              key={cl.id}
              onClick={() => {
                setActiveTabIdx(idx);
                setSearchQuery('');
              }}
              className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs flex flex-col justify-between cursor-pointer ${
                activeTabIdx === idx 
                  ? 'bg-indigo-500/10 border-indigo-500/50 text-slate-100 shadow-sm' 
                  : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex justify-between items-center w-full">
                <span className="font-bold tracking-tight text-slate-200">{cl.name}</span>
                <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                  activeTabIdx === idx ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-805 bg-slate-800 text-slate-500'
                }`}>
                  {cl.stocksCount}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-2 mt-1.5 font-sans leading-relaxed">
                {cl.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Clustered stock list - right pane */}
      <div className="lg:col-span-3 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        
        {/* Selected Cluster header details */}
        {activeCluster && (
          <div className="p-5 bg-slate-950/40 border-b border-slate-800">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-1.5 font-sans">
              <Group className="w-4.5 h-4.5 text-indigo-400" />
              {activeCluster.name}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl mt-1 font-sans">
              {activeCluster.description}
            </p>

            <div className="flex flex-wrap gap-1.5 mt-3.5 cursor-default">
              {activeCluster.characteristics.map((char, i) => (
                <span 
                  key={i} 
                  className="px-2.5 py-0.75 rounded-full text-[10px] font-mono font-medium border border-slate-850 bg-slate-900 text-slate-400"
                >
                  {char}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* List filters strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-905 bg-slate-950/20 border-b border-slate-800 text-xs">
          
          {/* Dynamic Search */}
          <div className="relative w-full sm:max-w-[240px]">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search ticker symbol..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 focus:outline-none pl-9.5 pr-4 py-2 rounded-lg text-xs font-mono font-bold text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Breakout intensity select */}
          <div className="flex items-center gap-2 font-mono text-slate-400 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span>MIN BREAKOUT SCORE:</span>
            <select
              value={minimumBreakoutScore}
              onChange={e => setMinimumBreakoutScore(parseInt(e.target.value))}
              className="bg-slate-950 border border-slate-800 p-1 px-2.5 font-bold text-indigo-400 rounded-lg focus:outline-none cursor-pointer"
            >
              <option value={0}>All Levels</option>
              <option value={5}>Mid (5+/10)</option>
              <option value={7}>High (7+/10)</option>
              <option value={9}>Critical (9+/10)</option>
            </select>
          </div>
        </div>

        {/* Stocks Table */}
        <div className="flex-1 overflow-x-auto">
          {filteredStocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 p-4 text-center">
              <p className="text-xs font-mono text-slate-500 uppercase">No stocks match filter constraints</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/20 text-slate-400 font-mono text-[10px] tracking-wider uppercase border-b border-slate-850">
                  <th className="p-3.5 pl-5">Ticker Symbol</th>
                  <th className="p-3.5">Price (LTP)</th>
                  <th className="p-3.5">Daily Change %</th>
                  <th className="p-3.5">RSI (14)</th>
                  <th className="p-3.5">BB Bandwidth</th>
                  <th className="p-3.5 text-center">Breakout Check</th>
                  <th className="p-3.5 pr-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredStocks.map((stock) => {
                  const inds = stock.indicators;
                  return (
                    <tr 
                      key={stock.symbol}
                      onClick={() => onSelectStock(stock)}
                      className="hover:bg-slate-850/30 transition-colors group cursor-pointer"
                    >
                      {/* Name */}
                      <td className="p-3.5 pl-5 font-mono font-bold text-slate-200">
                        {stock.symbol}
                      </td>

                      {/* LTP */}
                      <td className="p-3.5 font-mono font-medium text-slate-300">
                        ₹{stock.price.toFixed(2)}
                      </td>

                      {/* Day % */}
                      <td className="p-3.5 font-mono">
                        <span className={`inline-flex items-center gap-1 font-bold ${
                          stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {stock.change >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                        </span>
                      </td>

                      {/* RSI */}
                      <td className="p-3.5 font-mono">
                        <span className={
                          inds.rsi && inds.rsi <= 30 ? 'text-emerald-450 font-extrabold' : 
                          inds.rsi && inds.rsi >= 70 ? 'text-rose-450 font-extrabold' : 'text-slate-300'
                        }>
                          {inds.rsi ? inds.rsi.toFixed(1) : '—'}
                        </span>
                      </td>

                      {/* BB bandwidth */}
                      <td className="p-3.5 font-mono text-slate-300">
                        {inds.bbWidth ? `${(inds.bbWidth * 100).toFixed(2)}%` : '—'}
                      </td>

                      {/* Breakout metrics bar */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1 font-mono">
                          <span className={`text-[10px] font-bold px-1.5 py-0.25 rounded ${
                            stock.breakoutScore >= 8 ? 'bg-emerald-500/15 text-emerald-400' : 
                            stock.breakoutScore >= 5 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {stock.breakoutScore}/10 Score
                          </span>
                        </div>
                      </td>

                      {/* Action hover icon */}
                      <td className="p-3.5 pr-5 text-right font-mono">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 group-hover:text-indigo-300 group-hover:underline transition-all">
                          CHART
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

    </div>
  );
}
