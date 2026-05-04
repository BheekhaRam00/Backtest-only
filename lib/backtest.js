// ================================================
// 🚀 REALISTIC BACKTEST ENGINE (FINAL FIXED)
// ================================================

export function runBacktest(candles, strategyFn) {
  const trades = [];
  let activeTrade = null;

  let lastSignalTime = null;
  let cooldown = 0;

  for (let i = 80; i < candles.length; i++) {
    const history = candles.slice(0, i);
    const candle = candles[i];

    const price = candle.close;
    const time = candle.time;

    // ================================
    // EXIT (intrabar realistic)
    // ================================
    if (activeTrade) {
      let exitType = null;

      if (activeTrade.dir === "CALL") {
        if (candle.low <= activeTrade.sl) exitType = "SL";
        else if (candle.high >= activeTrade.tp) exitType = "TP";
      }

      if (activeTrade.dir === "PUT") {
        if (candle.high >= activeTrade.sl) exitType = "SL";
        else if (candle.low <= activeTrade.tp) exitType = "TP";
      }

      if (exitType) {
        trades.push({
          ...activeTrade,
          exitType,
          exitPrice: exitType === "TP" ? activeTrade.tp : activeTrade.sl,
          exitTime: time,
        });

        activeTrade = null;
        cooldown = 2; // 🔥 anti overtrading
        continue;
      }
    }

    // ================================
    // ENTRY
    // ================================
    if (!activeTrade && cooldown === 0) {
      const signal = strategyFn(history);

      if (!signal) continue;

      // 🔥 duplicate signal block
      if (lastSignalTime === signal.time) continue;

      const trigger =
        (signal.dir === "CALL" && candle.high >= signal.entry) ||
        (signal.dir === "PUT" && candle.low <= signal.entry);

      if (!trigger) continue;

      activeTrade = {
        ...signal,
        entryPrice: signal.entry,
        entryTime: time,
      };

      lastSignalTime = signal.time;
      continue;
    }

    if (cooldown > 0) cooldown--;
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
