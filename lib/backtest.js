// ================================================
// 🚀 SIMPLE BACKTEST ENGINE (DETERMINISTIC)
// ================================================

export function runBacktest(candles, strategyFn) {
  const trades = [];
  let activeTrade = null;

  for (let i = 50; i < candles.length; i++) {
    const history = candles.slice(0, i);
    const candle = candles[i];

    const price = candle.close;
    const time = candle.time;

    // ================================
    // EXIT
    // ================================
    if (activeTrade) {
      let exitType = null;

      if (activeTrade.dir === "CALL") {
        if (price <= activeTrade.sl) exitType = "SL";
        else if (price >= activeTrade.tp) exitType = "TP";
      }

      if (activeTrade.dir === "PUT") {
        if (price >= activeTrade.sl) exitType = "SL";
        else if (price <= activeTrade.tp) exitType = "TP";
      }

      if (exitType) {
        trades.push({
          ...activeTrade,
          exitType,
          exitPrice: price,
          exitTime: time,
        });

        activeTrade = null;
        continue;
      }
    }

    // ================================
    // ENTRY
    // ================================
    if (!activeTrade) {
      const signal = strategyFn(history);

      if (!signal) continue;

      const trigger =
        (signal.dir === "CALL" && price >= signal.entry) ||
        (signal.dir === "PUT" && price <= signal.entry);

      if (!trigger) continue;

      activeTrade = {
        ...signal,
        entryPrice: price,
        entryTime: time,
      };
    }
  }

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
