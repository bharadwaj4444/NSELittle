/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StockQuote {
  symbol: string;
  series: string;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  volume: number;
  value: number;
  timestamp: string; // Original timestamp, e.g. 11-JUN-2026
  date: string;      // Normalized date string, e.g. 2026-06-11
  trades?: number;
}

export interface TechnicalIndicators {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi: number | null;
  macdLine: number | null;
  signalLine: number | null;
  macdHist: number | null;
  bbMiddle: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  bbWidth: number | null; // (Upper - Lower) / Middle
  atr: number | null;      // Average True Range (14)
  volatility: number;      // 20-day standard deviation
  volumeRatio: number;     // Volume today / 20-day Average Volume
  closeChange: number;    // % change from prevClose
  high50: number | null;   // 50-day high value
  low50: number | null;    // 50-day low value
}

export interface StockAnalysis {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  value: number;
  change: number;
  date: string;
  indicators: TechnicalIndicators;
  breakoutScore: number;     // 1 to 10 rating of breakout probability
  reversalScore: number;     // 1 to 10 rating of reversal probability
  volatilityScore: number;   // 1 to 10 rating based on BB width expansion & ATR
  patterns: string[];        // list of detected setup names, e.g., ["Squeeze Breakout", "Hammer Reversal"]
}

export interface StockCluster {
  id: string;
  name: string;
  description: string;
  characteristics: string[];
  stocksCount: number;
  stocks: StockAnalysis[];
}

export interface Trade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  entryDate: string;
  targetPrice: number;
  stopLossPrice: number;
  status: 'ACTIVE' | 'CLOSED_PROFIT' | 'CLOSED_LOSS';
  currentPrice?: number;
  exitPrice?: number;
  exitDate?: string;
  notes?: string;
  pnl?: number;       // calculated pnl
  pnlPercent?: number; // calculated pnl %
}

export interface TradingAlert {
  id: string;
  symbol: string;
  price: number;
  change: number;
  signalType: 'BREAKOUT' | 'REVERSAL' | 'VOLATILITY_SPIKE';
  direction: 'BULLISH' | 'BEARISH';
  reason: string;
  indicators: {
    rsi: number | null;
    bbWidth: number | null;
    volumeRatio: number;
    patterns: string[];
  };
  strength: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'completed' | 'error';
  progress: number;
  total: number;
  message: string;
  downloadedCount: number;
  errorCount: number;
  currentFile: string;
  lastSyncedDate?: string;
}
