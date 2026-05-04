// ================================================
// 🚀 REAL BACKTEST ENGINE (FINAL)
// ================================================

import { strategy } from "./strategy.js";

export function backtest(candles) {
  if (!candles || candles.length < 100) {
    return { error: "Not enough data" };
  }

  // 🔥 ensure order: oldest → newest
  candles = candles.sort((a, b) => new Date(a.time) - new Date(b.time));

  let trades = [];
  let activeTrade = null;

  let wins = 0;
  let losses = 0;

  // 🔥 universal duplicate block
  let lastTradeCandleTime = null;

  for (let i = 100; i < candles.length; i++) {
    const slice = candles.slice(0, i + 1);
    const current = candles[i];

    // =========================
    // EXIT CHECK
    // =========================
    if (activeTrade) {
      const { dir, sl, tp } = activeTrade;

      if (dir === "CALL") {
        if (current.low <= sl) {
          losses++;
          trades.push({ ...activeTrade, exitType: "SL", exitPrice: sl, exitTime: current.time });
          activeTrade = null;
        } else if (current.high >= tp) {
          wins++;
          trades.push({ ...activeTrade, exitType: "TP", exitPrice: tp, exitTime: current.time });
          activeTrade = null;
        }
      } else {
        if (current.high >= sl) {
          losses++;
          trades.push({ ...activeTrade, exitType: "SL", exitPrice: sl, exitTime: current.time });
          activeTrade = null;
        } else if (current.low <= tp) {
          wins++;
          trades.push({ ...activeTrade, exitType: "TP", exitPrice: tp, exitTime: current.time });
          activeTrade = null;
        }
      }
    }

    // =========================
    // ENTRY CHECK
    // =========================
    if (!activeTrade) {
      const signal = strategy(slice);

      if (!signal) continue;

      // 🔥 duplicate block (same candle entry not allowed)
      if (lastTradeCandleTime === current.time) continue;

      activeTrade = {
        ...signal,
        entryTime: current.time,
      };

      lastTradeCandleTime = current.time;
    }
  }

  const total = wins + losses;
  const winrate = total ? ((wins / total) * 100).toFixed(2) : 0;

  return {
    total,
    wins,
    losses,
    winrate,
    trades,
  };
}
