// ================================================
// 🚀 REAL BACKTEST ENGINE (NO DUPLICATE GUARANTEED)
// ================================================

import { strategy } from "./strategy.js";

let trades = [];

// 🔥 GLOBAL LOCK SYSTEM
let lastTrade = null;
let lastTradeCandleTime = null;

// ================================
// 🔥 DUPLICATE BLOCK CORE
// ================================
function isDuplicate(signal, candle, index) {
  if (!lastTrade) return false;

  // ❌ SAME CANDLE BLOCK (100%)
  if (lastTradeCandleTime === candle.time) return true;

  // ❌ SAME DIRECTION SPAM BLOCK
  if (
    lastTrade.dir === signal.dir &&
    index - lastTrade.index < 10
  ) {
    return true;
  }

  // ❌ SAME PRICE ZONE BLOCK (VERY IMPORTANT)
  const priceDiff = Math.abs(signal.entry - lastTrade.entry);
  const zoneThreshold = signal.entry * 0.0025; // 0.08%

  if (priceDiff < zoneThreshold) return true;

  // ❌ TOO FAST RE-ENTRY BLOCK
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
    // EXIT LOGIC
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
      const signal = strategy(history);

      if (!signal) continue;

      // 🔥 100% DUPLICATE BLOCK
      if (isDuplicate(signal, current, i)) continue;

      // ✅ EXECUTE TRADE
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
