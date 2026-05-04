// ================================================
// 🚀 REAL BACKTEST ENGINE (FINAL - STRICT)
// OLDEST → NEWEST REPLAY
// NEXT-CANDLE ENTRY + SL/TP RACE
// 100% DUPLICATE BLOCK (INDEX + PRICE + COOLDOWN)
// ================================================

export function runBacktest(candles, strategyFn) {
  const trades = [];

  let activeTrade = null;

  // 🔒 duplicate protection
  let lastEntryIndex = -1000;
  let lastEntryPrice = null;

  // 🔧 config
  const COOLDOWN = 3;               // min candles between trades
  const PRICE_EPS = 0.5;           // NIFTY price zone (~0.5–1 ok)
  const MIN_START = 120;           // warmup

  for (let i = MIN_START; i < candles.length - 1; i++) {
    const history = candles.slice(0, i);
    const cur = candles[i];
    const next = candles[i + 1];

    // =================================================
    // 1) EXIT (STRICT, NO CHEAT)
    // =================================================
    if (activeTrade) {
      const { dir, sl, tp } = activeTrade;

      const high = cur.high;
      const low = cur.low;
      const open = cur.open;

      let exitType = null;

      // --- SL/TP race ---
      if (dir === "CALL") {
        if (low <= sl && high >= tp) {
          // both touched → which closer to open
          exitType =
            Math.abs(open - sl) < Math.abs(open - tp) ? "SL" : "TP";
        } else if (low <= sl) {
          exitType = "SL";
        } else if (high >= tp) {
          exitType = "TP";
        }
      }

      if (dir === "PUT") {
        if (high >= sl && low <= tp) {
          exitType =
            Math.abs(open - sl) < Math.abs(open - tp) ? "SL" : "TP";
        } else if (high >= sl) {
          exitType = "SL";
        } else if (low <= tp) {
          exitType = "TP";
        }
      }

      if (exitType) {
        trades.push({
          ...activeTrade,
          exitType,
          exitPrice: exitType === "TP" ? tp : sl,
          exitTime: cur.time,
        });

        activeTrade = null;
      }

      continue; // जब तक trade open है, नई entry नहीं
    }

    // =================================================
    // 2) SIGNAL
    // =================================================
    const signal = strategyFn(history);
    if (!signal) continue;

    // 👉 REAL ENTRY PRICE = NEXT CANDLE OPEN
    const entryPrice = next.open;

    // =================================================
    // 3) 🔥 HARD DUPLICATE BLOCK
    // =================================================

    // (A) same/near index (cooldown)
    if (i - lastEntryIndex < COOLDOWN) continue;

    // (B) same price zone
    if (
      lastEntryPrice !== null &&
      Math.abs(entryPrice - lastEntryPrice) < PRICE_EPS
    ) {
      continue;
    }

    // =================================================
    // 4) EXECUTE TRADE (REAL)
    // =================================================
    activeTrade = {
      ...signal,
      entryPrice,
      entryTime: next.time,
    };

    lastEntryIndex = i;
    lastEntryPrice = entryPrice;
  }

  // =================================================
  // RESULT
  // =================================================
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
