// ================================================
// 🔬 REALISTIC BACKTEST ENGINE — NO ILLUSION
// ✅ Entry direction fixed (CALL=low, PUT=high)
// ✅ SL worst-case first
// ✅ Both TP+SL same candle handled
// ✅ Spread + Slippage applied
// ✅ Max hold force-exit
// ================================================

const SPREAD   = 3;  // points per side
const SLIPPAGE = 1;  // points per fill
const MAX_HOLD = 15; // candles before force-exit

export function runBacktest(candles, strategyFn) {
  const trades = [];
  let activeTrade   = null;
  let entryIdx      = -1;

  for (let i = 80; i < candles.length; i++) {
    const candle  = candles[i];
    const history = candles.slice(0, i); // future invisible

    // ── EXIT LOGIC ──────────────────────────────────
    if (activeTrade) {
      let exitType  = null;
      let exitPrice = null;

      const t = activeTrade;

      if (t.dir === "CALL") {
        if (candle.open <= t.sl) {
          // Gap-down — immediate SL
          exitType  = "SL";
          exitPrice = t.sl;
        } else if (candle.open >= t.tp) {
          // Gap-up — immediate TP
          exitType  = "TP";
          exitPrice = t.tp;
        } else if (candle.low <= t.sl && candle.high >= t.tp) {
          // Both hit same candle — candle direction decides
          exitType  = candle.close >= candle.open ? "TP" : "SL";
          exitPrice = exitType === "TP" ? t.tp : t.sl;
        } else if (candle.low <= t.sl) {
          exitType  = "SL";
          exitPrice = t.sl;
        } else if (candle.high >= t.tp) {
          exitType  = "TP";
          exitPrice = t.tp;
        }
      }

      if (t.dir === "PUT") {
        if (candle.open >= t.sl) {
          exitType  = "SL";
          exitPrice = t.sl;
        } else if (candle.open <= t.tp) {
          exitType  = "TP";
          exitPrice = t.tp;
        } else if (candle.high >= t.sl && candle.low <= t.tp) {
          exitType  = candle.close <= candle.open ? "TP" : "SL";
          exitPrice = exitType === "TP" ? t.tp : t.sl;
        } else if (candle.high >= t.sl) {
          exitType  = "SL";
          exitPrice = t.sl;
        } else if (candle.low <= t.tp) {
          exitType  = "TP";
          exitPrice = t.tp;
        }
      }

      // Force-exit after MAX_HOLD candles
      if (!exitType && (i - entryIdx) >= MAX_HOLD) {
        exitType  = "TIMEOUT";
        exitPrice = candle.close;
      }

      if (exitType) {
        // Apply spread on exit
        const actualExit = t.dir === "CALL"
          ? exitPrice - SPREAD
          : exitPrice + SPREAD;

        const pnl = t.dir === "CALL"
          ? actualExit - t.actualEntry
          : t.actualEntry - actualExit;

        trades.push({
          dir:         t.dir,
          market:      t.market,
          entry:       t.entry,
          actualEntry: +t.actualEntry.toFixed(2),
          sl:          t.sl,
          tp:          t.tp,
          exitType,
          exitPrice:   +actualExit.toFixed(2),
          pnl:         +pnl.toFixed(2),
          won:         pnl > 0,
          entryTime:   t.entryTime,
          exitTime:    candle.time,
        });

        activeTrade = null;
        continue;
      }

      continue; // still in trade — no new signal
    }

    // ── SIGNAL GENERATION ───────────────────────────
    const signal = strategyFn(history);
    if (!signal) continue;

    // ── ENTRY VERIFICATION ──────────────────────────
    // CALL = pullback = price must come DOWN to entry
    // PUT  = rally    = price must go UP to entry
    const entryHit =
      (signal.dir === "CALL" && candle.low  <= signal.entry) ||
      (signal.dir === "PUT"  && candle.high >= signal.entry);

    if (!entryHit) continue;

    // Apply spread + slippage on fill
    const fillPrice = signal.dir === "CALL"
      ? signal.entry + SPREAD + SLIPPAGE
      : signal.entry - SPREAD - SLIPPAGE;

    // Recalculate TP/SL from actual fill
    const riskPts = Math.abs(signal.entry - signal.sl);
    const rewPts  = Math.abs(signal.tp    - signal.entry);

    if (!riskPts) continue;

    const tp = signal.dir === "CALL"
      ? fillPrice + rewPts
      : fillPrice - rewPts;

    const sl = signal.dir === "CALL"
      ? fillPrice - riskPts
      : fillPrice + riskPts;

    activeTrade = {
      dir:         signal.dir,
      market:      signal.market,
      rr:          signal.rr,
      entry:       signal.entry,
      actualEntry: fillPrice,
      sl:          +sl.toFixed(2),
      tp:          +tp.toFixed(2),
      entryTime:   candle.time,
    };

    entryIdx = i;
  }

  // ── RESULT ──────────────────────────────────────
  const total   = trades.length;
  const wins    = trades.filter(t => t.won).length;
  const losses  = total - wins;
  const totalPnL = trades.reduce((s, t) => s + t.pnl, 0);

  return {
    total,
    wins,
    losses,
    winrate:  total ? ((wins / total) * 100).toFixed(2) : "0.00",
    totalPnL: +totalPnL.toFixed(2),
    avgPnL:   total ? +(totalPnL / total).toFixed(2) : 0,
    trades,
  };
}
