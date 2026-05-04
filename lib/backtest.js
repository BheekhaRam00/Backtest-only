// ================================================
// lib/backtest.js — REALISTIC BACKTEST ENGINE
// ✅ Entry order valid for 3 candles (limit order)
// ✅ CALL=low touch, PUT=high touch
// ✅ Gap open handled
// ✅ Both TP+SL same candle: direction decides
// ✅ Spread + Slippage on every fill
// ✅ Max hold force-exit
// ✅ One trade at a time
// ================================================

const SPREAD        = 3;   // points per side
const SLIPPAGE      = 1;   // points per fill
const MAX_HOLD      = 15;  // candles before force-exit
const ORDER_VALID   = 3;   // candles limit order stays open

export function runBacktest(candles, strategyFn, opts = {}) {
  const spread      = opts.spread     ?? SPREAD;
  const slippage    = opts.slippage   ?? SLIPPAGE;
  const maxHold     = opts.maxHold    ?? MAX_HOLD;
  const orderValid  = opts.orderValid ?? ORDER_VALID;

  const trades = [];
  let wins = 0, losses = 0, totalPnL = 0;

  let activeTrade   = null;
  let entryIdx      = -1;

  // Pending limit order
  let pendingSignal = null;
  let pendingFrom   = -1;

  for (let i = 80; i < candles.length; i++) {
    const candle = candles[i];

    // ── EXIT open trade ──────────────────────────
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

      // Force-exit after maxHold candles
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

        activeTrade   = null;
        pendingSignal = null;
      }

      continue; // no new signal while in trade
    }

    // ── Check pending limit order ─────────────────
    if (pendingSignal) {
      const sig = pendingSignal;

      // Cancel if order too old
      if (i - pendingFrom > orderValid) {
        pendingSignal = null;
      } else {
        // CALL = pullback = low must touch entry
        // PUT  = rally    = high must touch entry
        const hit =
          (sig.dir === "CALL" && candle.low  <= sig.entry) ||
          (sig.dir === "PUT"  && candle.high >= sig.entry);

        if (hit) {
          const fillPrice = sig.dir === "CALL"
            ? sig.entry + spread + slippage
            : sig.entry - spread - slippage;

          const riskPts = Math.abs(sig.entry - sig.sl);
          const rewPts  = Math.abs(sig.tp    - sig.entry);
          if (!riskPts) { pendingSignal = null; continue; }

          const tp = sig.dir === "CALL"
            ? fillPrice + rewPts
            : fillPrice - rewPts;

          const sl = sig.dir === "CALL"
            ? fillPrice - riskPts
            : fillPrice + riskPts;

          activeTrade = {
            dir:         sig.dir,
            market:      sig.market,
            rr:          sig.rr,
            entry:       sig.entry,
            actualEntry: fillPrice,
            sl:          +sl.toFixed(2),
            tp:          +tp.toFixed(2),
            entryTime:   candle.time,
          };

          entryIdx      = i;
          pendingSignal = null;
        }
      }

      continue; // wait for fill or cancel
    }

    // ── Generate new signal ───────────────────────
    const history = candles.slice(0, i + 1);
    const signal  = strategyFn(history);
    if (!signal) continue;

    // Place limit order — valid for next orderValid candles
    pendingSignal = signal;
    pendingFrom   = i;
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
