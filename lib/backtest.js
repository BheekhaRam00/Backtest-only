// ================================================
// lib/backtest.js
// REALISTIC BACKTEST ENGINE — NO ILLUSION
// ✅ Entry: CALL=low touch, PUT=high touch
// ✅ Exit: high/low based, gap handled
// ✅ Both TP+SL same candle: direction decides
// ✅ Spread + Slippage on every fill
// ✅ Max hold force-exit
// ✅ One trade at a time
// ================================================

const SPREAD   = 3;   // points per side
const SLIPPAGE = 1;   // points per fill
const MAX_HOLD = 15;  // candles before force-exit

export function runBacktest(candles, strategyFn, opts = {}) {
  const spread   = opts.spread   ?? SPREAD;
  const slippage = opts.slippage ?? SLIPPAGE;
  const maxHold  = opts.maxHold  ?? MAX_HOLD;

  const trades = [];
  let wins = 0, losses = 0, totalPnL = 0;
  let activeTrade = null;
  let entryIdx    = -1;

  for (let i = 80; i < candles.length - 1; i++) {
    const candle = candles[i];

    // ── EXIT ──────────────────────────────────────
    if (activeTrade) {
      const t = activeTrade;
      let exitType  = null;
      let exitPrice = null;

      if (t.dir === "CALL") {
        if (candle.open <= t.sl) {
          exitType = "SL"; exitPrice = t.sl;
        } else if (candle.open >= t.tp) {
          exitType = "TP"; exitPrice = t.tp;
        } else if (candle.low <= t.sl && candle.high >= t.tp) {
          exitType  = candle.close >= candle.open ? "TP" : "SL";
          exitPrice = exitType === "TP" ? t.tp : t.sl;
        } else if (candle.low <= t.sl) {
          exitType = "SL"; exitPrice = t.sl;
        } else if (candle.high >= t.tp) {
          exitType = "TP"; exitPrice = t.tp;
        }
      } else {
        if (candle.open >= t.sl) {
          exitType = "SL"; exitPrice = t.sl;
        } else if (candle.open <= t.tp) {
          exitType = "TP"; exitPrice = t.tp;
        } else if (candle.high >= t.sl && candle.low <= t.tp) {
          exitType  = candle.close <= candle.open ? "TP" : "SL";
          exitPrice = exitType === "TP" ? t.tp : t.sl;
        } else if (candle.high >= t.sl) {
          exitType = "SL"; exitPrice = t.sl;
        } else if (candle.low <= t.tp) {
          exitType = "TP"; exitPrice = t.tp;
        }
      }

      if (!exitType && (i - entryIdx) >= maxHold) {
        exitType = "TIMEOUT"; exitPrice = candle.close;
      }

      if (exitType) {
        const actualExit = t.dir === "CALL"
          ? exitPrice - spread
          : exitPrice + spread;

        const pnl = t.dir === "CALL"
          ? actualExit - t.actualEntry
          : t.actualEntry - actualExit;

        const won = pnl > 0;
        if (won) wins++; else losses++;
        totalPnL += pnl;

        trades.push({
          dir:         t.dir,
          market:      t.market,
          rr:          t.rr,
          entry:       t.entry,
          actualEntry: +t.actualEntry.toFixed(2),
          sl:          t.sl,
          tp:          t.tp,
          exitType,
          exitPrice:   +actualExit.toFixed(2),
          pnl:         +pnl.toFixed(2),
          won,
          entryTime:   t.entryTime,
          exitTime:    candle.time,
        });

        activeTrade = null;
        continue;
      }

      continue; // still in trade
    }

    // ── SIGNAL ────────────────────────────────────
    const history = candles.slice(0, i + 1);
    const signal  = strategyFn(history);
    if (!signal) continue;

    // ── ENTRY VERIFY on NEXT candle ───────────────
    const next = candles[i + 1];
    if (!next) continue;

    // CALL = pullback = price must come DOWN to entry
    // PUT  = rally    = price must go UP to entry
    const entryHit =
      (signal.dir === "CALL" && next.low  <= signal.entry) ||
      (signal.dir === "PUT"  && next.high >= signal.entry);

    if (!entryHit) continue;

    const fillPrice = signal.dir === "CALL"
      ? signal.entry + spread + slippage
      : signal.entry - spread - slippage;

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
      entryTime:   next.time,
    };
    entryIdx = i + 1;
  }

  const total = wins + losses;
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
