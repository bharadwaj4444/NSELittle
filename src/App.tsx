/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Network, 
  TrendingUp, 
  Bell, 
  Briefcase, 
  Search, 
  HelpCircle, 
  Activity, 
  Timer, 
  BarChart2, 
  Github,
  Moon,
  Sun,
  LayoutGrid,
  Workflow
} from 'lucide-react';
import { StockAnalysis } from './types';
import SyncPanel from './components/SyncPanel';
import ClusterGrid from './components/ClusterGrid';
import AlertPanel from './components/AlertPanel';
import TradeTracker from './components/TradeTracker';
import StockChartModal from './components/StockChartModal';
import AlgorithmLab from './components/AlgorithmLab';

export default function App() {
  const [activeTab, setActiveTab] = useState<'CLUSTERS' | 'ALERTS' | 'TRADES' | 'ALGORITHMS'>('CLUSTERS');
  
  // Selected stock model representing target active modal chart
  const [selectedStock, setSelectedStock] = useState<StockAnalysis | null>(null);
  
  // Global dynamic statistics counter to auto-trigger multi-component state refreshes when sync is finalized
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  
  // Search bar query to find specific stock chart instantly
  const [quickSearch, setQuickSearch] = useState('');
  const [allStocks, setAllStocks] = useState<StockAnalysis[]>([]);

  // Function to pull summary of current stock lists to power direct top search bar lookups
  async function fetchStocksSummary() {
    try {
      const res = await fetch('/api/stocks/grouped');
      if (res.ok) {
        const data = await res.json();
        const merged: StockAnalysis[] = [];
        if (data.clusters) {
          for (const cl of data.clusters) {
            merged.push(...cl.stocks);
          }
        }
        setAllStocks(merged);
      }
    } catch (err) {
      console.error("Failed to load search list summary:", err);
    }
  }

  useEffect(() => {
    fetchStocksSummary();
  }, [refreshTrigger]);

  function triggerRefresh() {
    setRefreshTrigger(prev => prev + 1);
  }

  function handleQuickSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickSearch) return;

    const matched = allStocks.find(s => s.symbol === quickSearch.toUpperCase());
    if (matched) {
      setSelectedStock(matched);
      setQuickSearch('');
    } else {
      alert(`Symbol "${quickSearch.toUpperCase()}" not found in current analyzed set. Perform a sync first or verify symbol.`);
    }
  }

  // Handle direct navigation to symbol chart from other panels
  function handleSelectSymbolString(symbol: string) {
    const matched = allStocks.find(s => s.symbol === symbol);
    if (matched) {
      setSelectedStock(matched);
    } else {
      // Find default fallback parameters if history exists, or calculate
      alert(`Please verify "${symbol}" is loaded. Run a Sync first.`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-205">
      
      {/* Header Toolbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-850/80 px-4 md:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-9.5 h-9.5 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/20 shadow-inner">
            <Network className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="flex items-center gap-1.5 leading-none">
              <h1 className="text-sm font-black font-sans tracking-tight text-white">NSE BHAVCOPY QUANTS</h1>
              <span className="px-1.5 py-0.25 text-[8px] font-mono font-bold bg-indigo-500 text-white rounded">V1.5</span>
            </span>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">Breakout Clustering & Setup Alerts Console</p>
          </div>
        </div>

        {/* Global Toolbar and Ticker lookup */}
        <div className="flex flex-wrap items-center justify-end gap-3.5 w-full sm:w-auto text-xs">
          
          {/* Quick search */}
          <form onSubmit={handleQuickSearchSubmit} className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Instant symbol chart lookup..."
              value={quickSearch}
              onChange={e => setQuickSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 pr-3.5 pl-8.5 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-slate-700 placeholder-slate-500"
            />
          </form>

          {/* Time indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 font-mono text-[10px]">
            <Timer className="w-3.5 h-3.5 text-indigo-400" />
            <span>UTC TICK:</span>
            <span className="font-bold text-slate-200">2026-06-12 10:40:00</span>
          </div>
        </div>

      </header>

      {/* Main Console Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* Dynamic Sync Center */}
        <SyncPanel onSyncComplete={triggerRefresh} />

        {/* Nav Tabs Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-850 gap-4">
          <div className="flex items-center gap-1.5 w-full overflow-x-auto whitespace-nowrap scrollbar-none">
            {/* Tab 1: K-Means Clusters */}
            <button
              id="tab-btn-clusters"
              onClick={() => setActiveTab('CLUSTERS')}
              className={`flex items-center gap-2 px-4.5 py-3 text-xs font-mono font-bold uppercase transition-[color,border] border-b-2 cursor-pointer ${
                activeTab === 'CLUSTERS' 
                  ? 'border-indigo-500 text-indigo-450 text-indigo-400 font-black' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              K-Means Strategy Clusters
            </button>

            {/* Tab 2: Alerts room */}
            <button
              id="tab-btn-alerts"
              onClick={() => setActiveTab('ALERTS')}
              className={`flex items-center gap-2 px-4.5 py-3 text-xs font-mono font-bold uppercase transition-[color,border] border-b-2 cursor-pointer ${
                activeTab === 'ALERTS' 
                  ? 'border-indigo-500 text-indigo-455 text-indigo-400 font-black' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="w-4 h-4" />
              Daily Breakout Alerts
            </button>

            {/* Tab 3: Trade ledger */}
            <button
              id="tab-btn-trades"
              onClick={() => setActiveTab('TRADES')}
              className={`flex items-center gap-2 px-4.5 py-3 text-xs font-mono font-bold uppercase transition-[color,border] border-b-2 cursor-pointer ${
                activeTab === 'TRADES' 
                  ? 'border-indigo-500 text-indigo-460 text-indigo-400 font-black' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Portfolio Trade Tracker
            </button>

            {/* Tab 4: Quantitative Algorithms */}
            <button
              id="tab-btn-algorithms"
              onClick={() => setActiveTab('ALGORITHMS')}
              className={`flex items-center gap-2 px-4.5 py-3 text-xs font-mono font-bold uppercase transition-[color,border] border-b-2 cursor-pointer ${
                activeTab === 'ALGORITHMS' 
                  ? 'border-indigo-505 border-indigo-500 text-indigo-400 font-black' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Workflow className="w-4 h-4" />
              Quant Algorithms Lab
            </button>
          </div>

          <div className="text-[10px] text-slate-500 font-mono uppercase font-bold shrink-0 text-right">
            <span>DATABASE ENGINES: OK/LOCAL EXPORT</span>
          </div>
        </div>

        {/* Tab content viewer */}
        <div className="transition-opacity duration-200">
          {activeTab === 'CLUSTERS' && (
            <ClusterGrid onSelectStock={setSelectedStock} refreshTrigger={refreshTrigger} />
          )}
          {activeTab === 'ALERTS' && (
            <AlertPanel onSelectSymbol={handleSelectSymbolString} refreshTrigger={refreshTrigger} />
          )}
          {activeTab === 'TRADES' && (
            <TradeTracker refreshTrigger={refreshTrigger} triggerRefresh={triggerRefresh} />
          )}
          {activeTab === 'ALGORITHMS' && (
            <AlgorithmLab onSelectStock={setSelectedStock} refreshTrigger={refreshTrigger} />
          )}
        </div>

      </main>

      {/* Candlestick Modal Overlay */}
      {selectedStock && (
        <StockChartModal 
          stock={selectedStock} 
          onClose={() => setSelectedStock(null)} 
        />
      )}

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 px-4 md:px-8 mt-12 text-center text-[10px] font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 NSE Bhavcopy Breakout Engine. Authenticated, direct quantitative models. Strictly no simulator data.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              SYSTEM NODE: ONLINE
            </span>
            <span>PORT 3000 / EXPRESS ROUTER</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
