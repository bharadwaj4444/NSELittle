/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import AdmZip from "adm-zip";
import { 
  StockQuote, 
  StockAnalysis, 
  StockCluster, 
  Trade, 
  TradingAlert, 
  SyncStatus, 
  TechnicalIndicators 
} from "./src/types";

const app = express();
const PORT = 3000;

// Enable JSON middleware
app.use(express.json());

// Application directories
const DATA_DIR = path.join(process.cwd(), "data");
const DOWNLOADS_DIR = path.join(DATA_DIR, "bhavcopys");
const TRADES_FILE = path.join(DATA_DIR, "trades.json");
const STOCK_DATA_FILE = path.join(DATA_DIR, "stock_cache.json");

// Create directories if they don't exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

// Predefined set of active liquid NSE constituent stocks (Nifty 50 constituents) for focused parsing
const PRIORITY_SYMBOLS = [
  "RELIANCE", "TCS", "INFOSYS", "HDFCBANK", "ICICIBANK", 
  "SBIN", "BHARTIARTL", "L&T", "ITC", "HINDUNILVR", 
  "KOTAKBANK", "AXISBANK", "WIPRO", "TATASTEEL", "MARUTI",
  "M&M", "TATAMOTORS", "BAJFINANCE", "ASIANPAINT", "HCLTECH", 
  "SUNPHARMA", "NTPC", "POWERGRID", "TITAN", "COALINDIA", 
  "NESTLEIND", "ADANIENT", "JSWSTEEL", "ONGC", "ULTRACEMCO",
  "ADANIPORTS", "APOLLOHOSP", "BPCL", "BRITANNIA", "CIPLA",
  "DIVISLAB", "DRREDDY", "EICHERMOT", "GRASIM", "HEROMOTOCO",
  "INDUSINDBK", "JSWSTEEL", "LTIM", "NESTLEIND", "SBILIFE",
  "SHRIRAMFIN", "TATACONSUM", "TECHM", "WIPRO"
];

// Global Sync Status State
let syncStatus: SyncStatus = {
  status: "idle",
  progress: 0,
  total: 0,
  message: "System ready. Trigger a sync to download live exchange data.",
  downloadedCount: 0,
  errorCount: 0,
  currentFile: ""
};

// Global parsed stock timeseries cache (symbol -> Quote[])
let stockHistoryCache: Record<string, StockQuote[]> = {};
// Global calculated stock analysis results
let stockAnalysisResults: StockAnalysis[] = [];
let stockClusters: StockCluster[] = [];
let tradingAlerts: TradingAlert[] = [];

// Helper: Read cached stocks from filesystem if they exist to survive server restarts envs
function loadCacheFromFilesystem() {
  try {
    if (fs.existsSync(STOCK_DATA_FILE)) {
      const data = fs.readFileSync(STOCK_DATA_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed.history && parsed.analysis && parsed.clusters) {
        stockHistoryCache = parsed.history;
        stockAnalysisResults = parsed.analysis;
        stockClusters = parsed.clusters;
        tradingAlerts = parsed.alerts || [];
        syncStatus.lastSyncedDate = parsed.lastSyncedDate;
        syncStatus.message = "Loaded cached historical data. Ready for analysis.";
        console.log(`Loaded cached data for ${Object.keys(stockHistoryCache).length} stocks.`);
        return true;
      }
    }
  } catch (err) {
    console.error("Error loading cache from filesystem:", err);
  }
  return false;
}

// Helper: Save parsed stock cache to filesytem
function saveCacheToFilesystem() {
  try {
    fs.writeFileSync(STOCK_DATA_FILE, JSON.stringify({
      history: stockHistoryCache,
      analysis: stockAnalysisResults,
      clusters: stockClusters,
      alerts: tradingAlerts,
      lastSyncedDate: syncStatus.lastSyncedDate
    }, null, 2));
    console.log("Cached stock data saved to disk.");
  } catch (err) {
    console.error("Failed to save cache to disk:", err);
  }
}

// Initial configuration load
loadCacheFromFilesystem();

// Helper: Generate trading days over the last N months excluding weekends
function generateTradingDays(months: number): Date[] {
  const dates: Date[] = [];
  const end = new Date(); // Today
  const start = new Date();
  start.setMonth(start.getMonth() - months);

  let current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday (0) and Saturday (6)
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates.reverse(); // Newest first
}

// Format month name to NSE standard short upper uppercase representation, e.g. "JAN", "FEB"
function getNseMonthShort(date: Date): string {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return months[date.getMonth()];
}

// Format date day as DD with zero padding
function zeroPad(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

// Helper: Standard sleeping
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Helper: Fetch zipped bhavcopy with proper headers
async function fetchBhavcopy(date: Date, index: number, total: number, abortSignal: AbortSignal): Promise<Buffer | null> {
  const year = date.getFullYear();
  const month = getNseMonthShort(date);
  const day = zeroPad(date.getDate());
  
  // Format: cm11JUN2026bhav.csv.zip
  const fileName = `cm${day}${month}${year}bhav.csv.zip`;
  const url = `https://archives.nseindia.com/content/historical/EQUITIES/${year}/${month}/${fileName}`;
  const localZipPath = path.join(DOWNLOADS_DIR, fileName);

  syncStatus.currentFile = fileName;
  syncStatus.progress = Math.round((index / total) * 100);

  // If already downloaded locally, read and return
  if (fs.existsSync(localZipPath)) {
    return fs.readFileSync(localZipPath);
  }

  try {
    const response = await fetch(url, {
      signal: abortSignal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.nseindia.com/",
        "Connection": "keep-alive"
      }
    });

    if (response.status === 404) {
      // Holiday or non-trading weekday. Safe to ignore.
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Cache the downloaded ZIP to disk
    fs.writeFileSync(localZipPath, buffer);
    return buffer;

  } catch (error: any) {
    if (error.name === "AbortError") {
      throw error;
    }
    console.error(`Error downloading ${fileName}:`, error.message);
    return null;
  }
}

// Parse extracted CSV content from ZIP
function parseBhavcopyCsv(csvText: string, dateStr: string) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return;

  const headers = lines[0].split(",").map(h => h.trim().toUpperCase());
  
  // Find precise indices
  const symIdx = headers.indexOf("SYMBOL");
  const serIdx = headers.indexOf("SERIES");
  const openIdx = headers.indexOf("OPEN");
  const highIdx = headers.indexOf("HIGH");
  const lowIdx = headers.indexOf("LOW");
  const closeIdx = headers.indexOf("CLOSE");
  const prevCloseIdx = headers.indexOf("PREVCLOSE");
  const volIdx = headers.indexOf("TOTTRDQTY");
  const valIdx = headers.indexOf("TOTTRDVAL");
  const stampIdx = headers.indexOf("TIMESTAMP");

  if (symIdx === -1 || closeIdx === -1) {
    console.log("Invalid Bhavcopy header layout skipped column index mapping.");
    return;
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < headers.length) continue;

    const symbol = cols[symIdx];
    const series = cols[serIdx];

    // Filter only standard equities ('EQ' series) for clean signal clustering and to prevent warrants/debts bloat
    if (series !== "EQ") continue;

    // Optional: Filter only priority symbols to speed up calculation, or index all EQ series.
    // To allow comprehensive Nifty 50 search, we'll index all valid EQ securities.
    if (!PRIORITY_SYMBOLS.includes(symbol)) continue;

    const open = parseFloat(cols[openIdx]);
    const high = parseFloat(cols[highIdx]);
    const low = parseFloat(cols[lowIdx]);
    const close = parseFloat(cols[closeIdx]);
    const prevClose = parseFloat(cols[prevCloseIdx]);
    const volume = parseFloat(cols[volIdx]);
    const value = parseFloat(cols[valIdx]);
    const timestamp = cols[stampIdx] || dateStr;

    if (isNaN(close) || isNaN(open)) continue;

    const quote: StockQuote = {
      symbol,
      series,
      open,
      high,
      low,
      close,
      prevClose,
      volume,
      value,
      timestamp,
      date: dateStr
    };

    if (!stockHistoryCache[symbol]) {
      stockHistoryCache[symbol] = [];
    }

    // Check if quote for this date already exists to prevent duplicate indexes
    const exists = stockHistoryCache[symbol].some(q => q.date === dateStr);
    if (!exists) {
      stockHistoryCache[symbol].push(quote);
    }
  }
}

// Core: Calculate comprehensive technical indicator timeseries for a stock
function calculateTechnicalIndicators(quotes: StockQuote[]): StockAnalysis | null {
  if (quotes.length < 20) return null; // Require at least 20 trading days to form solid base indicators (like RSI and BB)

  // Sort chronologically (oldest to newest)
  const sorted = [...quotes].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const len = sorted.length;
  const latest = sorted[len - 1];

  // Helper arrays for indicators
  const closes = sorted.map(q => q.close);
  const volumes = sorted.map(q => q.volume);

  // SMA calculation
  const getSMA = (data: number[], period: number, index: number): number | null => {
    if (index < period - 1) return null;
    let sum = 0;
    for (let i = index - period + 1; i <= index; i++) {
      sum += data[i];
    }
    return sum / period;
  };

  // SMA periods
  const sma20 = getSMA(closes, 20, len - 1);
  const sma50 = getSMA(closes, 50, len - 1);
  const sma200 = getSMA(closes, 200, len - 1);

  // Volume Ratio (current volume / 20-day average volume)
  const volumeSMA20 = getSMA(volumes, 20, len - 1);
  const volumeRatio = volumeSMA20 && volumeSMA20 > 0 ? latest.volume / volumeSMA20 : 1;

  // Standard Deviation
  const getStdDev = (data: number[], mean: number, period: number, index: number): number => {
    let sumSquares = 0;
    for (let i = index - period + 1; i <= index; i++) {
      sumSquares += Math.pow(data[i] - mean, 2);
    }
    return Math.sqrt(sumSquares / period);
  };

  let bbMiddle: number | null = null;
  let bbUpper: number | null = null;
  let bbLower: number | null = null;
  let bbWidth: number | null = null;

  if (sma20 !== null) {
    bbMiddle = sma20;
    const stdDev = getStdDev(closes, sma20, 20, len - 1);
    bbUpper = bbMiddle + (2 * stdDev);
    bbLower = bbMiddle - (2 * stdDev);
    bbWidth = bbMiddle > 0 ? (bbUpper - bbLower) / bbMiddle : 0;
  }

  // RSI-14
  let rsi: number | null = null;
  if (len >= 15) {
    let gains = 0;
    let losses = 0;

    // First RSI step
    for (let i = 1; i <= 14; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / 14;
    let avgLoss = losses / 14;

    // Wilder's smoothing
    for (let i = 15; i < len; i++) {
      const diff = closes[i] - closes[i - 1];
      let gain = 0;
      let loss = 0;
      if (diff > 0) gain = diff;
      else loss = -diff;

      avgGain = ((avgGain * 13) + gain) / 14;
      avgLoss = ((avgLoss * 13) + loss) / 14;
    }

    if (avgLoss === 0) rsi = 100;
    else {
      const rs = avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
    }
  }

  // MACD (12, 26, 9)
  const getEMA = (data: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const ema: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      ema.push((data[i] * k) + (ema[i - 1] * (1 - k)));
    }
    return ema;
  };

  let macdLine: number | null = null;
  let signalLine: number | null = null;
  let macdHist: number | null = null;

  if (len >= 26) {
    const ema12 = getEMA(closes, 12);
    const ema26 = getEMA(closes, 26);
    const macdVals: number[] = [];

    for (let i = 0; i < len; i++) {
      macdVals.push(ema12[i] - ema26[i]);
    }

    macdLine = macdVals[len - 1];
    const signalVals = getEMA(macdVals.slice(25), 9); // EMA of MACD Line
    signalLine = signalVals[signalVals.length - 1];
    macdHist = macdLine - signalLine;
  }

  // ATR (Average True Range - 14)
  let atr: number | null = null;
  if (len >= 15) {
    const trs: number[] = [];
    for (let i = 1; i < len; i++) {
      const tr = Math.max(
        sorted[i].high - sorted[i].low,
        Math.abs(sorted[i].high - sorted[i - 1].close),
        Math.abs(sorted[i].low - sorted[i - 1].close)
      );
      trs.push(tr);
    }
    // ATR calculation
    let trSum = 0;
    for (let i = 0; i < 14; i++) {
      trSum += trs[i];
    }
    atr = trSum / 14;
    for (let i = 14; i < trs.length; i++) {
      atr = ((atr * 13) + trs[i]) / 14;
    }
  }

  // 20-day Volatility (standard deviation of percent changes)
  const dailyReturns: number[] = [];
  for (let i = Math.max(1, len - 21); i < len; i++) {
    dailyReturns.push(((closes[i] - closes[i - 1]) / closes[i - 1]) * 100);
  }
  const meanReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / dailyReturns.length;
  const volatility = Math.sqrt(variance);

  // 50-day High & Low
  const sub50 = closes.slice(Math.max(0, len - 50));
  const high50 = Math.max(...sub50);
  const low50 = Math.min(...sub50);

  // Close Change
  const closeChange = ((latest.close - latest.prevClose) / latest.prevClose) * 100;

  // Patterns Analysis
  const patterns: string[] = [];
  
  // 1. Bollinger Band Squeeze pattern check
  const isSqueeze = bbWidth !== null && bbWidth < 0.08;
  if (isSqueeze) patterns.push("Bollinger Squeeze");

  // 2. Breakout criteria (High volume spike combined with breakout of resistance)
  const isVolumeSpike = volumeRatio > 2.0;
  const isPriceNewHigh = latest.close >= high50 * 0.99 && closeChange > 1.0;
  if (isVolumeSpike && isPriceNewHigh) {
    patterns.push("High-Volume Breakout");
  } else if (isPriceNewHigh) {
    patterns.push("Resistance Breakout");
  }

  // 3. Reversal check (RSI oversold + positive MACD cross OR bullish candlestick)
  const isOversold = rsi !== null && rsi < 30;
  const isMacdCrossBullish = macdHist !== null && macdHist > 0 && (len >= 2 && (getSMA(closes, 12, len - 2) || 0) < 0);
  const isHammer = (latest.close - latest.low) / (latest.high - latest.low) > 0.6 && Math.abs(latest.close - latest.open) / (latest.high - latest.low) < 0.25;
  if (isOversold && (isHammer || closeChange > 1.0)) {
    patterns.push("Oversold Hammer Reversal");
  } else if (rsi !== null && rsi > 70 && closeChange < -1.5) {
    patterns.push("Overbought Mean Reversal");
  }

  // Calculate scores (1-10 based on probability triggers)
  let breakoutScore = 1;
  if (isPriceNewHigh) breakoutScore += 4;
  if (isVolumeSpike) breakoutScore += 3;
  if (isSqueeze) breakoutScore += 2;
  breakoutScore = Math.min(10, breakoutScore);

  let reversalScore = 1;
  if (isOversold) reversalScore += 4;
  if (isHammer) reversalScore += 3;
  if (isMacdCrossBullish) reversalScore += 2;
  reversalScore = Math.min(10, reversalScore);

  let volatilityScore = 1;
  const currentAtrPercent = atr && latest.close > 0 ? (atr / latest.close) * 100 : 0;
  volatilityScore += Math.floor(Math.min(9, volatility * 2 + currentAtrPercent * 2));

  const indicators: TechnicalIndicators = {
    sma20,
    sma50,
    sma200,
    rsi,
    macdLine,
    signalLine,
    macdHist,
    bbMiddle,
    bbUpper,
    bbLower,
    bbWidth,
    atr,
    volatility,
    volumeRatio,
    closeChange,
    high50,
    low50
  };

  return {
    symbol: latest.symbol,
    price: latest.close,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    volume: latest.volume,
    value: latest.value,
    change: closeChange,
    date: latest.date,
    indicators,
    breakoutScore,
    reversalScore,
    volatilityScore,
    patterns
  };
}

// Implement K-Means clustering algorithm on custom Technical Features of stocks
function clusterStocks(analysisList: StockAnalysis[]): StockCluster[] {
  if (analysisList.length === 0) return [];

  const K = 5; // Set 5 dynamic breakout/trend categories
  const maxIterations = 25;

  // Features mapping per stock: [normalized rsi, normalized bbWidth, normalized volatility, normalized volumeRatio, normalized closeChange, normalized breakoutScore]
  const stocksFeatures = analysisList.map(stock => {
    const inds = stock.indicators;
    return {
      stock,
      features: [
        inds.rsi || 50,
        inds.bbWidth || 0.15,
        inds.volatility,
        inds.volumeRatio,
        inds.closeChange,
        stock.breakoutScore
      ]
    };
  });

  // Simple min-max standardizer
  const numFeatures = 6;
  const mins = Array(numFeatures).fill(Infinity);
  const maxs = Array(numFeatures).fill(-Infinity);

  for (const sf of stocksFeatures) {
    for (let f = 0; f < numFeatures; f++) {
      if (sf.features[f] < mins[f]) mins[f] = sf.features[f];
      if (sf.features[f] > maxs[f]) maxs[f] = sf.features[f];
    }
  }

  // Extract min-max scaled vectors
  const scaledStocks = stocksFeatures.map(sf => {
    const scaled = sf.features.map((v, f) => {
      const range = maxs[f] - mins[f];
      return range === 0 ? 0 : (v - mins[f]) / range;
    });
    return { stock: sf.stock, vector: scaled };
  });

  // Initialize Centroids randomly from data points
  let centroids: number[][] = [];
  const selectedIndices = new Set<number>();
  while (centroids.length < K && centroids.length < scaledStocks.length) {
    const randIdx = Math.floor(Math.random() * scaledStocks.length);
    if (!selectedIndices.has(randIdx)) {
      selectedIndices.add(randIdx);
      centroids.push([...scaledStocks[randIdx].vector]);
    }
  }

  // Handle boundary
  if (centroids.length < K) {
    for (let i = 0; i < K - centroids.length; i++) {
      centroids.push(Array(numFeatures).fill(0.5));
    }
  }

  // Iteration loops
  let assignments = Array(scaledStocks.length).fill(-1);
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // 1. Assign each stock to closest centroid
    for (let s = 0; s < scaledStocks.length; s++) {
      let minDst = Infinity;
      let closestCentroid = -1;

      for (let c = 0; c < K; c++) {
        // Euclidean distance
        let sumSqr = 0;
        for (let f = 0; f < numFeatures; f++) {
          sumSqr += Math.pow(scaledStocks[s].vector[f] - centroids[c][f], 2);
        }
        const dist = Math.sqrt(sumSqr);
        if (dist < minDst) {
          minDst = dist;
          closestCentroid = c;
        }
      }

      if (assignments[s] !== closestCentroid) {
        assignments[s] = closestCentroid;
        changed = true;
      }
    }

    if (!changed && iter > 0) break; // Stabilized early

    // 2. Re-calculate centroids
    const centroidSums = Array(K).fill(0).map(() => Array(numFeatures).fill(0));
    const centroidCounts = Array(K).fill(0);

    for (let s = 0; s < scaledStocks.length; s++) {
      const c = assignments[s];
      centroidCounts[c]++;
      for (let f = 0; f < numFeatures; f++) {
        centroidSums[c][f] += scaledStocks[s].vector[f];
      }
    }

    for (let c = 0; c < K; c++) {
      if (centroidCounts[c] > 0) {
        for (let f = 0; f < numFeatures; f++) {
          centroids[c][f] = centroidSums[c][f] / centroidCounts[c];
        }
      }
    }
  }

  // Cluster descriptive definitions mapping Centroid averages
  const clusterDefinitions = [
    {
      id: "squeeze_breakout",
      name: "BB Squeeze & Consolidation",
      description: "Stocks demonstrating low standard deviation, narrowing Bollinger Bands (low channel width), and resting volume. These represent high-probability breakout catalysts.",
      characteristics: ["Low Volatility", "Tight Bollinger Bands", "Low Relative Volume", "Accumulation Phase"]
    },
    {
      id: "bullish_momentum",
      name: "High-Volume Momentum Breakouts",
      description: "High-beta equities experiencing major breakout patterns. High standard deviation, closing above key resistance tables, paired with a massive surge in volume trading.",
      characteristics: ["High Price Increase", "Massive Volume Surge", "Near 52-week High", "Strong Trend Slope"]
    },
    {
      id: "oversold_mean_reversion",
      name: "Oversold Trend Reversals",
      description: "Equities displaying extremely oversold conditions on relative strength indicators (low RSI), testing historical multi-day floor supports, and printing bullish reversal candles.",
      characteristics: ["Low RSI (< 35)", "Bullish Engulfing/Hammer Candlestick", "Long Decline Relief Setup", "Deep Discount valuation"]
    },
    {
      id: "stable_uptrend",
      name: "Steady Trend Riders (Bluechips)",
      description: "Low-risk, high-consistency companies riding cleanly above major moving averages (50 SMA and 200 SMA) with steady positive daily returns and moderate RSI.",
      characteristics: ["Consistent Uptrend", "Sustained Higher Lows", "Above 50 and 200 SMA", "Stable Institutional Support"]
    },
    {
      id: "high_beta_volatility",
      name: "Highly Volatile Mean Reversion",
      description: "Extremely wide Bollinger Bands with dramatic high-velocity pricing swings. Excellent candidates for short-term swing traders looking to capture extreme overbought standard levels.",
      characteristics: ["Wide Bollinger Bands", "Extreme Beta & Swings", "RSI Swings 30 to 70", "Swing Trading Potential"]
    }
  ];

  // Group stocks by assignments
  const clusters: StockCluster[] = clusterDefinitions.map((def, cIdx) => {
    const list: StockAnalysis[] = [];
    for (let s = 0; s < scaledStocks.length; s++) {
      if (assignments[s] === cIdx) {
        list.push(scaledStocks[s].stock);
      }
    }
    
    // Sort stocks inside the cluster by their affinity (highest breakout/reversal scores first)
    list.sort((a, b) => b.breakoutScore - a.breakoutScore);

    return {
      ...def,
      stocksCount: list.length,
      stocks: list
    };
  });

  return clusters;
}

// Generate real daily alerts from current stock structures
function generateTradingAlerts(analysisList: StockAnalysis[]): TradingAlert[] {
  const alerts: TradingAlert[] = [];
  
  for (const item of analysisList) {
    const inds = item.indicators;

    // Alert 1: Bullish Squeeze Breakout (Highly explosive setup)
    if (item.patterns.includes("Bollinger Squeeze") && item.patterns.includes("High-Volume Breakout")) {
      alerts.push({
        id: `alert-${item.symbol}-squeeze-breakout`,
        symbol: item.symbol,
        price: item.price,
        change: item.change,
        signalType: "BREAKOUT",
        direction: "BULLISH",
        reason: "Explosive Bollinger Band Squeeze Breakout with volume index validation (>2x average).",
        indicators: {
          rsi: Math.round(inds.rsi || 50),
          bbWidth: parseFloat((inds.bbWidth || 0).toFixed(4)),
          volumeRatio: parseFloat(inds.volumeRatio.toFixed(2)),
          patterns: [...item.patterns]
        },
        strength: "HIGH",
        timestamp: new Date().toISOString()
      });
      continue;
    }

    // Alert 2: Major Price High Breakout
    if (item.patterns.includes("Resistance Breakout") && inds.volumeRatio > 2.5) {
      alerts.push({
        id: `alert-${item.symbol}-res-breakout`,
        symbol: item.symbol,
        price: item.price,
        change: item.change,
        signalType: "BREAKOUT",
        direction: "BULLISH",
        reason: "Clean break above 50-day resistance peak supported by heavy institutional volume ratios.",
        indicators: {
          rsi: Math.round(inds.rsi || 50),
          bbWidth: parseFloat((inds.bbWidth || 0).toFixed(4)),
          volumeRatio: parseFloat(inds.volumeRatio.toFixed(2)),
          patterns: [...item.patterns]
        },
        strength: "HIGH",
        timestamp: new Date().toISOString()
      });
      continue;
    }

    // Alert 3: Bullish Divergence / Oversold Reversal Hammer
    if (item.patterns.includes("Oversold Hammer Reversal")) {
      alerts.push({
        id: `alert-${item.symbol}-reversal`,
        symbol: item.symbol,
        price: item.price,
        change: item.change,
        signalType: "REVERSAL",
        direction: "BULLISH",
        reason: "Oversold RSI condition (<30) printed a classic bullish hammer candlestick at critical support floor.",
        indicators: {
          rsi: Math.round(inds.rsi || 15),
          bbWidth: parseFloat((inds.bbWidth || 0).toFixed(4)),
          volumeRatio: parseFloat(inds.volumeRatio.toFixed(2)),
          patterns: [...item.patterns]
        },
        strength: "MEDIUM",
        timestamp: new Date().toISOString()
      });
      continue;
    }

    // Alert 4: Severe Volatility Swing
    if (inds.volatility > 4.5 && inds.volumeRatio > 3.0) {
      alerts.push({
        id: `alert-${item.symbol}-vol-spike`,
        symbol: item.symbol,
        price: item.price,
        change: item.change,
        signalType: "VOLATILITY_SPIKE",
        direction: item.change > 0 ? "BULLISH" : "BEARISH",
        reason: "High Beta volatility breakout. Volume shock triggers momentum expansion beyond Bollinger Bands.",
        indicators: {
          rsi: Math.round(inds.rsi || 50),
          bbWidth: parseFloat((inds.bbWidth || 0).toFixed(4)),
          volumeRatio: parseFloat(inds.volumeRatio.toFixed(2)),
          patterns: ["Volatility Spike", ...item.patterns]
        },
        strength: "MEDIUM",
        timestamp: new Date().toISOString()
      });
    }
  }

  // Sort alerts by severity (strength high first)
  return alerts.sort((a,b) => (a.strength === 'HIGH' ? -1 : 1));
}

// Global controllers for the background sync process
let activeAbortController: AbortController | null = null;

async function runBhavcopySyncTask(monthsSelection: number) {
  if (syncStatus.status === "syncing") return;

  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;

  syncStatus.status = "syncing";
  syncStatus.progress = 0;
  syncStatus.downloadedCount = 0;
  syncStatus.errorCount = 0;
  syncStatus.message = "Initializing NSE historical calendar analyzer...";

  try {
    const tradingDates = generateTradingDays(monthsSelection);
    syncStatus.total = tradingDates.length;
    console.log(`Prepared list of calendar weekdays to fetch: ${tradingDates.length} days.`);

    // To prevent aggressive server lock, fetch in sequence with smart delays
    for (let i = 0; i < tradingDates.length; i++) {
      if (signal.aborted) {
        throw new Error("Synchronization Task manually aborted.");
      }

      const dateObj = tradingDates[i];
      const year = dateObj.getFullYear();
      const month = getNseMonthShort(dateObj);
      const day = zeroPad(dateObj.getDate());
      const dateStr = `${year}-${zeroPad(dateObj.getMonth()+1)}-${day}`;

      syncStatus.message = `Processing historical bhavcopy for date: ${dateStr}`;

      const zipBuf = await fetchBhavcopy(dateObj, i + 1, tradingDates.length, signal);
      
      if (zipBuf) {
        try {
          const zip = new AdmZip(zipBuf);
          const zipEntries = zip.getEntries();
          
          if (zipEntries.length > 0) {
            const csvEntry = zipEntries[0]; // Standard structure: singular CSV in primary path
            const csvText = csvEntry.getData().toString("utf8");
            
            parseBhavcopyCsv(csvText, dateStr);
            syncStatus.downloadedCount++;
          }
        } catch (zipErr: any) {
          console.error(`Zip extraction error for date ${dateStr}:`, zipErr.message);
          syncStatus.errorCount++;
        }
      } else {
        // Weekend or NSE Holiday
        syncStatus.errorCount++;
      }

      // Respect exchange guidelines: 125ms delay between local/remote loops to keep operations clean
      await delay(125);
    }

    if (signal.aborted) {
      throw new Error("Task was aborted.");
    }

    // Execution calculations & Clustering starts
    syncStatus.message = "Running algorithmic clustering of technical structures...";
    const symbols = Object.keys(stockHistoryCache);
    const calculated: StockAnalysis[] = [];

    for (const sym of symbols) {
      const analysis = calculateTechnicalIndicators(stockHistoryCache[sym]);
      if (analysis) {
        calculated.push(analysis);
      }
    }

    stockAnalysisResults = calculated;
    
    // Cluster the companies
    stockClusters = clusterStocks(calculated);
    
    // Detect breakout signals & reversals
    tradingAlerts = generateTradingAlerts(calculated);

    // Update synced marker
    if (tradingDates.length > 0) {
      const newestDate = tradingDates.find(d => {
        const year = d.getFullYear();
        const month = getNseMonthShort(d);
        const day = zeroPad(d.getDate());
        const dateStr = `${year}-${zeroPad(d.getMonth()+1)}-${day}`;
        return stockHistoryCache[Object.keys(stockHistoryCache)[0]]?.some(q => q.date === dateStr);
      });
      if (newestDate) {
        const year = newestDate.getFullYear();
        const month = getNseMonthShort(newestDate);
        const day = zeroPad(newestDate.getDate());
        syncStatus.lastSyncedDate = `${year}-${zeroPad(newestDate.getMonth()+1)}-${day}`;
      } else if (calculated.length > 0) {
        syncStatus.lastSyncedDate = calculated[0].date;
      }
    }

    syncStatus.status = "completed";
    syncStatus.progress = 100;
    syncStatus.message = `Successfully synced market data! Dynamic analytical groups loaded.`;
    
    // Persist to Surival file for instant bootups next runtime 
    saveCacheToFilesystem();

  } catch (error: any) {
    console.error("Sync background task failed:", error.message);
    syncStatus.status = error.message.includes("aborted") ? "idle" : "error";
    syncStatus.message = error.message || "An unexpected error occurred during sync operations.";
  } finally {
    activeAbortController = null;
  }
}

// Trade Tracking File Helpers
function readTradesFromFile(): Trade[] {
  try {
    if (fs.existsSync(TRADES_FILE)) {
      const raw = fs.readFileSync(TRADES_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Failed to read trades database.", err);
  }
  return [];
}

function writeTradesToFile(trades: Trade[]): boolean {
  try {
    fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
    return true;
  } catch (err) {
    console.error("Failed to write to trades database.", err);
    return false;
  }
}

// API: Check current download/parse operation state
app.get("/api/sync/status", (req, res) => {
  res.json({
    ...syncStatus,
    activeStocks: Object.keys(stockHistoryCache).length,
    analyzedStocksCount: stockAnalysisResults.length
  });
});

// API: Start background task processing for NSE download
app.post("/api/sync/start", (req, res) => {
  const months = parseInt(req.body.months || "3"); // Default to last 3 months for perfect balanced speed
  if (syncStatus.status === "syncing") {
    return res.status(400).json({ error: "Sync operation is already in progress, please wait." });
  }
  
  // Launch asynchronous task background
  runBhavcopySyncTask(months);
  res.json({ message: "Bhavcopy download task launched successfully." });
});

// API: Stop active synchronization background worker
app.post("/api/sync/stop", (req, res) => {
  if (activeAbortController) {
    activeAbortController.abort();
    syncStatus.status = "idle";
    syncStatus.message = "Sync task manually cancelled by operator.";
    res.json({ message: "Cancellation signal issued." });
  } else {
    res.status(400).json({ error: "No active synchronization process currently running." });
  }
});

// API: Fetch analysis clusters list
app.get("/api/stocks/grouped", (req, res) => {
  res.json({
    clusters: stockClusters,
    unclusteredCount: Object.keys(stockHistoryCache).length - stockAnalysisResults.length,
    lastUpdated: syncStatus.lastSyncedDate
  });
});

// API: Fetch historical detail quotes for a particular ticker symbol to draw charts
app.get("/api/stocks/history", (req, res) => {
  const symbol = (req.query.symbol as string || "").toUpperCase();
  if (!symbol) return res.status(400).json({ error: "Query parameter 'symbol' is required." });

  const history = stockHistoryCache[symbol];
  if (!history) {
    return res.status(404).json({ error: `No historical bhavcopy records found for symbol: ${symbol}` });
  }

  // Sort chronological
  const sorted = [...history].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  res.json({ symbol, history: sorted });
});

// API: Get live calculated trading signals and daily breakout setups
app.get("/api/alerts", (req, res) => {
  res.json({ alerts: tradingAlerts });
});

// API: Trade tracking database triggers
app.get("/api/trades", (req, res) => {
  const trades = readTradesFromFile();
  // Decorate trade records with current live prices
  const decorated = trades.map(t => {
    const cachedStock = stockAnalysisResults.find(s => s.symbol === t.symbol);
    if (cachedStock && t.status === "ACTIVE") {
      const curPrice = cachedStock.price;
      const profit = t.direction === "LONG" ? (curPrice - t.entryPrice) : (t.entryPrice - curPrice);
      const pnl = profit * t.quantity;
      const pnlPercent = (profit / t.entryPrice) * 100;
      return {
        ...t,
        currentPrice: curPrice,
        pnl,
        pnlPercent
      };
    }
    return t;
  });
  res.json({ trades: decorated });
});

app.post("/api/trades", (req, res) => {
  const { symbol, direction, entryPrice, quantity, targetPrice, stopLossPrice, notes } = req.body;
  
  if (!symbol || !direction || !entryPrice || !quantity) {
    return res.status(400).json({ error: "Required fields (symbol, direction, entryPrice, quantity) are missing." });
  }

  const trades = readTradesFromFile();
  const newTrade: Trade = {
    id: `trade-${Date.now()}`,
    symbol: symbol.toUpperCase(),
    direction,
    entryPrice: parseFloat(entryPrice),
    quantity: parseInt(quantity),
    entryDate: new Date().toISOString().split("T")[0],
    targetPrice: parseFloat(targetPrice || "0"),
    stopLossPrice: parseFloat(stopLossPrice || "0"),
    status: "ACTIVE",
    notes: notes || ""
  };

  trades.push(newTrade);
  if (writeTradesToFile(trades)) {
    res.status(201).json({ message: "New trade tracking record logged.", trade: newTrade });
  } else {
    res.status(500).json({ error: "Failed to persist new trade record." });
  }
});

app.post("/api/trades/close", (req, res) => {
  const { id, exitPrice, status } = req.body;

  if (!id || !exitPrice || !status) {
    return res.status(400).json({ error: "Required post parameters (id, exitPrice, status) must be supplied." });
  }

  const trades = readTradesFromFile();
  const tradeIdx = trades.findIndex(t => t.id === id);

  if (tradeIdx === -1) return res.status(404).json({ error: "Trade tracking record not found." });

  const trade = trades[tradeIdx];
  const finalPrice = parseFloat(exitPrice);
  const profit = trade.direction === "LONG" ? (finalPrice - trade.entryPrice) : (trade.entryPrice - finalPrice);

  trade.status = status; // e.g. "CLOSED_PROFIT" or "CLOSED_LOSS"
  trade.exitPrice = finalPrice;
  trade.exitDate = new Date().toISOString().split("T")[0];
  trade.pnl = profit * trade.quantity;
  trade.pnlPercent = (profit / trade.entryPrice) * 100;

  if (writeTradesToFile(trades)) {
    res.json({ message: "Trade tracked record finalized and archived.", trade });
  } else {
    res.status(500).json({ error: "Failed to archive trade parameters." });
  }
});

app.delete("/api/trades", (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Track parameter 'id' is required." });

  const trades = readTradesFromFile();
  const filtered = trades.filter(t => t.id !== id);

  if (writeTradesToFile(filtered)) {
    res.json({ message: "Trade record successfully removed." });
  } else {
    res.status(500).json({ error: "Failed to delete trade record." });
  }
});

// Configure Vite integration as middleware first
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server launched successfully and is listening on http://0.0.0.0:${PORT}`);
  });
}

initializeServer();
