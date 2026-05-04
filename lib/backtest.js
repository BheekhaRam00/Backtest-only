export function runBacktest(candles, strategyFn) {
  const trades = [];

  let activeTrade = null;
  let pendingSignal = null;

  for (let i = 50; i < candles.length; i++) {
    const history = candles.slice(0, i);
    const candle = candles[i];

    const { high, low, time } = candle;

    // ================================
    // 1. EXIT (ACTIVE TRADE)
    // ================================
    if (activeTrade) {
      let exitType = null;
      let exitPrice = null;

      if (activeTrade.dir === "CALL") {
        const slHit = low <= activeTrade.sl;
        const tpHit = high >= activeTrade.tp;

        if (slHit && tpHit) {
          exitType = "SL"; // worst-case realistic
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
    // 2. EXECUTE PENDING SIGNAL (NEXT CANDLE ONLY)
    // ================================
    if (!activeTrade && pendingSignal) {
      let triggered = false;
      let entryPrice = null;

      if (
        pendingSignal.dir === "CALL" &&
        high >= pendingSignal.entry
      ) {
        triggered = true;
        entryPrice = pendingSignal.entry;
      }

      if (
        pendingSignal.dir === "PUT" &&
        low <= pendingSignal.entry
      ) {
        triggered = true;
        entryPrice = pendingSignal.entry;
      }

      if (triggered) {
        activeTrade = {
          ...pendingSignal,
          entryPrice,
          entryTime: time,
        };
      }

      // signal सिर्फ 1 candle के लिए valid
      pendingSignal = null;
    }

    // ================================
    // 3. GENERATE NEW SIGNAL (CURRENT CANDLE)
    // ================================
    if (!activeTrade) {
      const signal = strategyFn(history);
      if (signal) {
        pendingSignal = signal;
      }
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
