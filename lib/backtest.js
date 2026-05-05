// ================================================
// 🚀 REAL BACKTEST ENGINE (NO DUPLICATE GUARANTEED)
// ================================================

import { strategy as baseStrategy } from "./strategy.js";
import { withTimeFilter } from "./timeFilter.js";

const strategy = withTimeFilter(baseStrategy);

let trades = [];

// 🔥 GLOBAL LOCK SYSTEM
let lastTrade = null;
let lastTradeCandleTime = null;

// ================================
// 🔥 DUPLICATE BLOCK CORE
// ================================
function isDuplicate(signal, candle, index) {
  if (!lastTrade) return false;

  if (lastTradeCandleTime === candle.time) return true;

  if (
    lastTrade.dir === signal.dir &&
    index - lastTrade.index < 10
  ) {
    return true;
  }

  const priceDiff = Math.abs(signal.entry - lastTrade.entry);
  const zoneThreshold = signal.entry * 0.0025;

  if (priceDiff < zoneThreshold) return true;

  if (index - lastTrade.index < 5) return true;

  return false;
}

// ================================
// 🚀 BACKTEST LOOP (REAL SIMULATION)
// ================================
export function runBacktest(candles) {
  trades = [];
  lastTrade = null;
  lastTradeCandleTime = null;

  let position = null;

  for (let i = 100; i < candles.length; i++) {
    const history = candles.slice(0, i + 1);
    const current = candles[i];

    // ============================
    // 🔥 UNIVERSAL EXIT (ADDED)
    // ============================
    const signal = strategy(history);

    if (signal?.action === "EXIT_ALL" && position) {
      trades.push({
        ...position,
        exitPrice: current.close,
        exitTime: current.time,
        exitType: "TIME_EXIT",
      });

      position = null;
      continue;
    }

    // ============================
    // EXIT LOGIC (SL/TP)
    // ============================
    if (position) {
      const { dir, sl, tp } = position;

      if (dir === "CALL") {
        if (current.low <= sl) {
          trades.push({
            ...position,
            exitPrice: sl,
            exitTime: current.time,
            exitType: "SL",
          });
          position = null;
        } else if (current.high >= tp) {
          trades.push({
            ...position,
            exitPrice: tp,
            exitTime: current.time,
            exitType: "TP",
          });
          position = null;
        }
      } else {
        if (current.high >= sl) {
          trades.push({
            ...position,
            exitPrice: sl,
            exitTime: current.time,
            exitType: "SL",
          });
          position = null;
        } else if (current.low <= tp) {
          trades.push({
            ...position,
            exitPrice: tp,
            exitTime: current.time,
            exitType: "TP",
          });
          position = null;
        }
      }
    }

    // ============================
    // ENTRY LOGIC
    // ============================
    if (!position) {

      // ⚠️ IMPORTANT: signal already ऊपर लिया गया है
      if (!signal || signal.action === "EXIT_ALL") continue;

      if (isDuplicate(signal, current, i)) continue;

      position = {
        ...signal,
        entryTime: current.time,
        index: i,
      };

      lastTrade = position;
      lastTradeCandleTime = current.time;
    }
  }

  return analyze(trades);
}

// ================================
// 📊 RESULT ANALYSIS
// ================================
function analyze(trades) {
  let wins = 0;
  let losses = 0;

  for (const t of trades) {
    if (
      (t.dir === "CALL" && t.exitPrice >= t.tp) ||
      (t.dir === "PUT" && t.exitPrice <= t.tp)
    ) {
      wins++;
    } else {
      losses++;
    }
  }

  const total = trades.length;
  const winrate = total ? (wins / total) * 100 : 0;

  return {
    total,
    wins,
    losses,
    winrate: +winrate.toFixed(2),
    trades,
  };
}
