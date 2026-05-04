// ================================================
// 🚀 FINAL REALISTIC BACKTEST ENGINE (NO CHEAT)
// ================================================

export function runBacktest(candles, strategyFn) {
  const trades = [];
  let activeTrade = null;
  let entryCandleTime = null;

  for (let i = 80; i < candles.length; i++) {
    const history = candles.slice(0, i);
    const candle = candles[i];

    // ================================
    // EXIT (REALISTIC WITH AMBIGUITY FIX)
    // ================================
    if (activeTrade) {
      // ❗ skip same candle exit (important)
      if (candle.time === entryCandleTime) {
        continue;
      }

      let exitType = null;
      let exitPrice = null;

      const hitSL =
        activeTrade.dir === "CALL"
          ? candle.low <= activeTrade.sl
          : candle.high >= activeTrade.sl;

      const hitTP =
        activeTrade.dir === "CALL"
          ? candle.high >= activeTrade.tp
          : candle.low <= activeTrade.tp;

      // 🔥 CASE 1: BOTH HIT → assume SL (worst-case realistic)
      if (hitSL && hitTP) {
        exitType = "SL";
        exitPrice = activeTrade.sl;
      }

      // 🔥 CASE 2: ONLY SL
      else if (hitSL) {
        exitType = "SL";
        exitPrice = activeTrade.sl;
      }

      // 🔥 CASE 3: ONLY TP
      else if (hitTP) {
        exitType = "TP";
        exitPrice = activeTrade.tp;
      }

      if (exitType) {
        trades.push({
          ...activeTrade,
          exitType,
          exitPrice,
          exitTime: candle.time,
        });

        activeTrade = null;
        entryCandleTime = null;
        continue;
      }
    }

    // ================================
    // ENTRY (STRICT TRIGGER)
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
        entryPrice: signal.entry,
        entryTime: candle.time,
      };

      entryCandleTime = candle.time;
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
