// ================================================
// 🚀 BACKTEST ENGINE (FINAL - NO DUPLICATE GUARANTEE)
// REALISTIC + UNIVERSAL + STABLE
// ================================================

export function runBacktest(candles, strategyFn) {
  const trades = [];

  let activeTrade = null;
  let cooldown = 0;

  // 🔥 duplicate protection memory
  let lastEntryIndex = -1;
  let lastEntryPrice = null;

  // 🔥 CONFIG
  const COOLDOWN_CANDLES = 3;
  const PRICE_ZONE_THRESHOLD = 0.4; // NIFTY noise zone

  for (let i = 100; i < candles.length - 1; i++) {
    const history = candles.slice(0, i);
    const current = candles[i];
    const next = candles[i + 1];

    // ================================
    // EXIT LOGIC (REALISTIC)
    // ================================
    if (activeTrade) {
      const { dir, sl, tp } = activeTrade;

      const high = current.high;
      const low = current.low;

      let exitType = null;

      if (dir === "CALL") {
        if (low <= sl && high >= tp) {
          exitType =
            Math.abs(sl - current.open) < Math.abs(tp - current.open)
              ? "SL"
              : "TP";
        } else if (low <= sl) {
          exitType = "SL";
        } else if (high >= tp) {
          exitType = "TP";
        }
      }

      if (dir === "PUT") {
        if (high >= sl && low <= tp) {
          exitType =
            Math.abs(sl - current.open) < Math.abs(tp - current.open)
              ? "SL"
              : "TP";
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
          exitTime: current.time,
        });

        activeTrade = null;
        cooldown = COOLDOWN_CANDLES;
      }

      continue;
    }

    // ================================
    // COOLDOWN CONTROL
    // ================================
    if (cooldown > 0) {
      cooldown--;
      continue;
    }

    // ================================
    // SIGNAL GENERATION
    // ================================
    const signal = strategyFn(history);
    if (!signal) continue;

    const entry = signal.entry;

    // ================================
    // 🔥 UNIVERSAL DUPLICATE BLOCK
    // ================================

    // 1. Same candle repeat block
    if (lastEntryIndex === i) continue;

    // 2. Same price zone block
    if (lastEntryPrice !== null) {
      const diff = Math.abs(entry - lastEntryPrice);

      if (diff < PRICE_ZONE_THRESHOLD) {
        continue; // duplicate zone detected
      }
    }

    // ================================
    // ENTRY (NEXT CANDLE ONLY)
    // ================================
    activeTrade = {
      ...signal,
      entryPrice: next.open,
      entryTime: next.time,
    };

    lastEntryIndex = i;
    lastEntryPrice = entry;
  }

  // ================================
  // RESULTS
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
