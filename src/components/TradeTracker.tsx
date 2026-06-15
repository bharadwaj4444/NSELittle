/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Check, 
  X,
  Target,
  FileMinus,
  Briefcase,
  PieChart,
  Grid,
  Percent,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { Trade } from '../types.js';

interface TradeTrackerProps {
  refreshTrigger: number;
  triggerRefresh: () => void;
}

export default function TradeTracker({ refreshTrigger, triggerRefresh }: TradeTrackerProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form to execute/record trade states
  const [showAddForm, setShowAddForm] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [entryPrice, setEntryPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [notes, setNotes] = useState('');

  // Closing execution Dialog variables
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [closingPrice, setClosingPrice] = useState('');

  // Load tracked log
  useEffect(() => {
    async function fetchTrades() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/trades');
        if (!res.ok) throw new Error('Failed to retrieve tracked trades.');
        const data = await res.json();
        setTrades(data.trades || []);
      } catch (err: any) {
        setError(err.message || 'Failed to sync trade logs.');
      } finally {
        setLoading(false);
      }
    }
    fetchTrades();
  }, [refreshTrigger]);

  async function saveTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol || !entryPrice || !quantity) {
      alert("Please specify Ticker, Entry Price, and Quantity.");
      return;
    }

    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          direction,
          entryPrice,
          quantity,
          targetPrice,
          stopLossPrice,
          notes
        })
      });

      if (!res.ok) throw new Error('Failed to log trade positions.');
      
      // Cleanup inputs
      setShowAddForm(false);
      setSymbol('');
      setEntryPrice('');
      setQuantity('');
      setTargetPrice('');
      setStopLossPrice('');
      setNotes('');
      
      triggerRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function closePosition(id: string, exitPriceVal: string, winState: 'CLOSED_PROFIT' | 'CLOSED_LOSS') {
    if (!exitPriceVal) {
      alert("Specify exit price to finalize trade.");
      return;
    }
    try {
      const res = await fetch('/api/trades/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          exitPrice: exitPriceVal,
          status: winState
        })
      });
      if (!res.ok) throw new Error('Failed to register exit stats.');
      
      setClosingTradeId(null);
      setClosingPrice('');
      triggerRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function deleteTrade(id: string) {
    if (!confirm("Are you sure you want to delete this recorded log?")) return;
    try {
      const res = await fetch(`/api/trades?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to purge trade log.');
      triggerRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Calculate Metrics from trade list
  const activeTrades = trades.filter(t => t.status === 'ACTIVE');
  const closedTrades = trades.filter(t => t.status !== 'ACTIVE');

  const totalOpenPnl = activeTrades.reduce((acc, curr) => acc + (curr.pnl || 0), 0);
  const totalRealizedPnl = closedTrades.reduce((acc, curr) => acc + (curr.pnl || 0), 0);
  
  const profitTradeCount = closedTrades.filter(t => t.status === 'CLOSED_PROFIT').length;
  const winRate = closedTrades.length > 0 ? (profitTradeCount / closedTrades.length) * 100 : 0;

  return (
    <div className="space-y-6 font-sans">
      
      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Open P&L */}
        <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-xl flex items-center justify-between shadow-xs relative group">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-help flex items-center gap-1">
              LIVE OPEN P&L
              <HelpCircle className="w-3 h-3 text-indigo-400" />
            </span>
            <div className={`text-xl font-bold font-mono ${totalOpenPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{totalOpenPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-400">Calculated in real-time on synced prices</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalOpenPnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            <Briefcase className="w-5 h-5" />
          </div>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal leading-normal shadow-xl z-55 text-center">
            <strong>Live Open P&L</strong>: Sum of unrealized paper gains/losses for all active positions, computed using latest synced NSE bhavcopy prices.
          </span>
        </div>

        {/* Metric 2: Realized profits */}
        <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-xl flex items-center justify-between shadow-xs relative group">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-help flex items-center gap-1">
              ARCHIVED PROFITS
              <HelpCircle className="w-3 h-3 text-indigo-400" />
            </span>
            <div className={`text-xl font-bold font-mono ${totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{totalRealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-400">Archived from closed positions</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalRealizedPnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal leading-normal shadow-xl z-55 text-center">
            <strong>Archived Profits</strong>: Total realized returns calculated from completed setups that reached target or triggered stop-loss.
          </span>
        </div>

        {/* Metric 3: Win Rate */}
        <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-xl flex items-center justify-between shadow-xs relative group">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-help flex items-center gap-1">
              SWING WIN RATE
              <HelpCircle className="w-3 h-3 text-indigo-400" />
            </span>
            <div className="text-xl font-bold font-mono text-slate-100">
              {winRate.toFixed(1)}%
            </div>
            <p className="text-[10px] text-slate-400">{profitTradeCount} of {closedTrades.length} setups closed profitable</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal leading-normal shadow-xl z-55 text-center">
            <strong>Swing Win Rate</strong>: Percentage of closed positions terminated above entry price versus below. Aim for &gt; 50% with positive risk-reward.
          </span>
        </div>

        {/* Metric 4: Ratio allocations */}
        <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-xl flex items-center justify-between shadow-xs relative group">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase cursor-help flex items-center gap-1">
              RUNNING SETUPS
              <HelpCircle className="w-3 h-3 text-indigo-400" />
            </span>
            <div className="text-xl font-bold font-mono text-slate-100">
              {activeTrades.length} Open
            </div>
            <p className="text-[10px] text-slate-400">Across Nifty Priority listings</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[9px] font-sans font-normal leading-normal shadow-xl z-55 text-center">
            <strong>Running Setups</strong>: Number of currently active positions outstanding. Good risk management suggests limiting to 5-7 active listings simultaneously.
          </span>
        </div>

      </div>

      {/* Main Trackings Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        
        {/* Table Title strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-slate-950/40 border-b border-slate-800">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-1.5 font-sans">
            <Briefcase className="w-4.5 h-4.5 text-indigo-400" />
            TRADE TRACKING LOGS
          </h2>

          <button
            id="open-add-trade-btn"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 cursor-pointer px-4 py-1.5 text-xs font-mono font-bold uppercase rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors border border-indigo-400/20"
          >
            <Plus className="w-4 h-4" />
            RECORD POSITION
          </button>
        </div>

        {/* Modal: Add Trade positioning */}
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-200 uppercase font-mono">Record Trade Allocation</h3>
                <button 
                  onClick={() => setShowAddForm(false)} 
                  className="text-slate-440 hover:text-slate-200 cursor-pointer text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={saveTrade} className="p-5 space-y-4 font-sans text-xs">
                
                {/* Symbol & Direction row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-mono font-medium">SYMBOL *</label>
                    <input
                      type="text"
                      placeholder="e.g. RELIANCE"
                      required
                      value={symbol}
                      onChange={e => setSymbol(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-205 focus:outline-none focus:border-slate-700 text-slate-300 font-mono font-bold uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-mono font-medium">DIRECTION *</label>
                    <select
                      value={direction}
                      onChange={e => setDirection(e.target.value as 'LONG' | 'SHORT')}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 font-mono font-bold text-indigo-400 focus:outline-none text-xs cursor-pointer"
                    >
                      <option value="LONG">LONG (BUY)</option>
                      <option value="SHORT">SHORT (SELL)</option>
                    </select>
                  </div>
                </div>

                {/* Entry Price & Quantity row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-mono font-medium">ENTRY PRICE *</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="₹"
                      required
                      value={entryPrice}
                      onChange={e => setEntryPrice(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-mono font-medium">QUANTITY *</label>
                    <input
                      type="number"
                      placeholder="Units count"
                      required
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-mono"
                    />
                  </div>
                </div>

                {/* Target & Stop Loss */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-mono font-medium">TARGET PRICE</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Exit ceiling"
                      value={targetPrice}
                      onChange={e => setTargetPrice(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-mono text-emerald-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-mono font-medium">STOP LOSS</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Loss floor limit"
                      value={stopLossPrice}
                      onChange={e => setStopLossPrice(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-mono text-rose-450"
                    />
                  </div>
                </div>

                {/* notes */}
                <div className="space-y-1">
                  <label className="text-slate-400 font-mono font-medium">setup TRADING NOTES</label>
                  <textarea
                    rows={2}
                    placeholder="Describe breakout criteria or indicators used..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-sans text-xs focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 font-mono font-bold uppercase text-xs rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition cursor-pointer"
                  >
                    LOG POSITION
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Close POSITION */}
        {closingTradeId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-250 uppercase font-mono">Close active Position</h3>
                <button 
                  onClick={() => setClosingTradeId(null)} 
                  className="text-slate-440 hover:text-slate-200 cursor-pointer text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1 font-mono text-xs">
                  <label className="text-slate-400 font-medium">EXIT SETTLEMENT PRICE (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Enter final price reached..."
                    value={closingPrice}
                    onChange={e => setClosingPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => closePosition(closingTradeId, closingPrice, 'CLOSED_PROFIT')}
                    className="py-2 rounded font-mono font-bold text-xs uppercase bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 cursor-pointer"
                  >
                    CLOSE PROFIT STATE
                  </button>
                  <button
                    onClick={() => closePosition(closingTradeId, closingPrice, 'CLOSED_LOSS')}
                    className="py-2 rounded font-mono font-bold text-xs uppercase bg-rose-500/15 text-rose-450 hover:bg-rose-500/25 border border-rose-500/20 cursor-pointer"
                  >
                    CLOSE LOSS STATE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trades table log */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-3" />
              <p className="text-xs font-mono text-slate-500 uppercase">Synchronizing trades log database...</p>
            </div>
          ) : error ? (
            <div className="px-5 py-4 text-xs font-mono text-rose-400 uppercase">
              Database Sync Failed: {error}
            </div>
          ) : trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-11 h-11 bg-slate-850 rounded-full flex items-center justify-center text-slate-500 border border-slate-805 border-slate-800 mb-3">
                <FileMinus className="w-5 h-5" />
              </div>
              <p className="text-xs font-mono text-slate-500 uppercase">No active tracked trades logged</p>
              <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                Found a high probability setup in the Alerts or Clusters room? High-conviction setups can be tracked by clicking <strong>"Record Position"</strong>.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/20 text-slate-400 font-mono text-[10px] tracking-wider uppercase border-b border-slate-850">
                  <th className="p-3.5 pl-5">Symbol</th>
                  <th className="p-3.5">Settlement (L/S)</th>
                  <th className="p-3.5 font-mono">Entry Date</th>
                  <th className="p-3.5 font-mono">Entry / Current Price</th>
                  <th className="p-3.5 font-mono">Target / Stop Loss</th>
                  <th className="p-3.5 font-mono">P&L Status</th>
                  <th className="p-3.5 pr-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {trades.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-850/15 transition-all text-xs">
                    
                    {/* Symbol */}
                    <td className="p-3.5 pl-5">
                      <div className="font-mono font-bold text-slate-200">{tr.symbol}</div>
                      <div className="text-[9px] text-slate-500 font-mono uppercase tracking-wide">QTY: {tr.quantity}</div>
                    </td>

                    {/* Direction */}
                    <td className="p-3.5">
                      <span className={`inline-block font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        tr.direction === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-450'
                      }`}>
                        {tr.direction}
                      </span>
                    </td>

                    {/* date */}
                    <td className="p-3.5 text-slate-400 font-mono">
                      {tr.entryDate}
                    </td>

                    {/* Entry price / live price */}
                    <td className="p-3.5 font-mono space-y-0.5">
                      <div className="text-slate-355 text-slate-400">Entry: ₹{tr.entryPrice.toFixed(2)}</div>
                      {tr.status === 'ACTIVE' ? (
                        <div className="text-slate-100 font-semibold">Live: ₹{(tr.currentPrice || tr.entryPrice).toFixed(2)}</div>
                      ) : (
                        <div className="text-slate-355 text-slate-400 font-semibold">Exit: ₹{(tr.exitPrice || 0).toFixed(2)}</div>
                      )}
                    </td>

                    {/* Target Stop Loss */}
                    <td className="p-3.5 font-mono text-[10px] space-y-0.5">
                      <div className="text-emerald-400 font-semibold">Tgt: ₹{tr.targetPrice ? tr.targetPrice.toFixed(2) : '—'}</div>
                      <div className="text-rose-400 font-semibold font-bold">SL: ₹{tr.stopLossPrice ? tr.stopLossPrice.toFixed(2) : '—'}</div>
                    </td>

                    {/* PNL calculations */}
                    <td className="p-3.5 font-mono">
                      {tr.status === 'ACTIVE' ? (
                        <div className="space-y-0.5">
                          <span className={`inline-flex items-center gap-1 font-bold ${
                            (tr.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {(tr.pnl || 0) >= 0 ? '+' : ''}₹{(tr.pnl || 0).toFixed(2)}
                          </span>
                          <span className={`block text-[9px] font-medium leading-none ${
                            (tr.pnlPercent || 0) >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'
                          }`}>
                            ({(tr.pnlPercent || 0) >= 0 ? '+' : ''}{(tr.pnlPercent || 0).toFixed(2)}%)
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className={`inline-flex items-center gap-1 font-bold ${
                            tr.status === 'CLOSED_PROFIT' ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {tr.status === 'CLOSED_PROFIT' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" /> : <XCircle className="w-3.5 h-3.5 text-rose-400 inline" />}
                            ₹{(tr.pnl || 0).toFixed(2)}
                          </span>
                          <span className="block text-[9px] text-slate-500 font-mono font-bold uppercase">{tr.status.replace("CLOSED_", "")}</span>
                        </div>
                      )}
                    </td>

                    {/* Actions row triggers */}
                    <td className="p-3.5 pr-5 text-right font-mono">
                      <div className="flex items-center justify-end gap-2">
                        {tr.status === 'ACTIVE' && (
                          <button
                            id={`settle-trade-btn-${tr.id}`}
                            onClick={() => {
                              setClosingTradeId(tr.id);
                              setClosingPrice(tr.currentPrice ? tr.currentPrice.toString() : tr.entryPrice.toString());
                            }}
                            className="px-2 py-1 rounded text-[10px] font-bold tracking-tight bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white border border-indigo-400/25 cursor-pointer transition-all"
                          >
                            SETTLE
                          </button>
                        )}
                        <button
                          id={`delete-trade-btn-${tr.id}`}
                          onClick={() => deleteTrade(tr.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border border-transparent hover:border-rose-400/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

    </div>
  );
}
