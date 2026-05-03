export function runBacktest(candles, strategyFn) {
  const trades = [];
  let activeTrade = null;

  for (let i = 50; i < candles.length; i++) {
    const history = candles.slice(0, i);
    const candle = candles[i];

    const { high, low, time } = candle;

    // ================================
    // EXIT (STRICT REALISTIC)
    // ================================
    if (activeTrade) {
      let exitType = null;
      let exitPrice = null;

      if (activeTrade.dir === "CALL") {
        const slHit = low <= activeTrade.sl;
        const tpHit = high >= activeTrade.tp;

        if (slHit && tpHit) {
          // 🔥 Worst case assumption
          exitType = "SL";
          exitPrice = activeTrade.sl;
        } else if (slHit) {
          exitType = "SL";
          exitPrice = activeTrade.sl;
        } else if (tpHit) {
          exitType = "TP";
          exitPrice = activeTrade.tp;
        }
      }

      if (activeTrade.dir === "PUT") {
        const slHit = high >= activeTrade.sl;
        const tpHit = low <= activeTrade.tp;

        if (slHit && tpHit) {
          exitType = "SL";
          exitPrice = activeTrade.sl;
        } else if (slHit) {
          exitType = "SL";
          exitPrice = activeTrade.sl;
        } else if (tpHit) {
          exitType = "TP";
          exitPrice = activeTrade.tp;
        }
      }

      if (exitType) {
        trades.push({
          ...activeTrade,
          exitType,
          exitPrice,
          exitTime: time,
        });

        activeTrade = null;
        continue;
      }
    }

    // ================================
    // ENTRY (REALISTIC)
    // ================================
    if (!activeTrade) {
      const signal = strategyFn(history);
      if (!signal) continue;

      let entryTriggered = false;
      let entryPrice = null;

      if (signal.dir === "CALL" && candle.high >= signal.entry) {
        entryTriggered = true;
        entryPrice = signal.entry;
      }

      if (signal.dir === "PUT" && candle.low <= signal.entry) {
        entryTriggered = true;
        entryPrice = signal.entry;
      }

      if (!entryTriggered) continue;

      activeTrade = {
        ...signal,
        entryPrice,
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
