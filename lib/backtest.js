// ================================================
// 🚀 REALISTIC BACKTEST ENGINE (FINAL FIXED)
// NO FAKE WINRATE / NO CLOSE-BASED BUG
// ================================================

export function runBacktest(candles, strategyFn) {
  const trades = [];
  let activeTrade = null;

  for (let i = 80; i < candles.length; i++) {
    const history = candles.slice(0, i);
    const candle = candles[i];

    // ================================
    // EXIT (REALISTIC — HIGH/LOW BASED)
    // ================================
    if (activeTrade) {
      let exitType = null;
      let exitPrice = null;

      if (activeTrade.dir === "CALL") {
        // SL first (worst case realistic)
        if (candle.low <= activeTrade.sl) {
          exitType = "SL";
          exitPrice = activeTrade.sl;
        } else if (candle.high >= activeTrade.tp) {
          exitType = "TP";
          exitPrice = activeTrade.tp;
        }
      }

      if (activeTrade.dir === "PUT") {
        if (candle.high >= activeTrade.sl) {
          exitType = "SL";
          exitPrice = activeTrade.sl;
        } else if (candle.low <= activeTrade.tp) {
          exitType = "TP";
          exitPrice = activeTrade.tp;
        }
      }

      if (exitType) {
        trades.push({
          ...activeTrade,
          exitType,
          exitPrice,
          exitTime: candle.time,
        });

        activeTrade = null;
        continue;
      }
    }

    // ================================
    // ENTRY (REALISTIC — HIGH/LOW TRIGGER)
    // ================================
    if (!activeTrade) {
      const signal = strategyFn(history);
      if (!signal) continue;

      const entryHit =
        (signal.dir === "CALL" && candle.high >= signal.entry) ||
        (signal.dir === "PUT" && candle.low <= signal.entry);

      if (!entryHit) continue;

      activeTrade = {
        ...signal,
        entryPrice: signal.entry, // realistic fill
        entryTime: candle.time,
      };
    }
  }

  // ================================
  // RESULT
  // ================================
  const total = trades.length;
  const wins = trades.filter(t => t.exitType === "TP").length;

  return {
    total,
    wins,
    losses: total - wins,
    winrate: total ? ((wins / total) * 100).toFixed(2) : "0.00",
    trades,
  };
}
