// ================================================
// lib/backtest.js
// 🔬 REALISTIC BACKTEST ENGINE — NO ILLUSION
// ─────────────────────────────────────────────
// ✅ No look-ahead bias
// ✅ Entry verified on NEXT candle only
// ✅ TP/SL resolved via candle high/low
// ✅ Gap-open handled
// ✅ Spread + Slippage applied
// ✅ Max hold force-exit
// ✅ One trade at a time
// ================================================

const SPREAD_POINTS    = 3;   // bid-ask spread per side
const SLIPPAGE_POINTS  = 1;   // execution slippage per fill
const MAX_HOLD_CANDLES = 15;  // force-exit if TP/SL not hit

// ================================
// runBacktest(candles, strategyFn)
// strategyFn = your strategy()
// from strategy.js
// ================================
export function runBacktest(candles, strategyFn, opts = {}) {
  const SPREAD   = opts.spread   ?? SPREAD_POINTS;
  const SLIPPAGE = opts.slippage ?? SLIPPAGE_POINTS;
  const MAX_HOLD = opts.maxHold  ?? MAX_HOLD_CANDLES;

  const trades = [];
  let wins = 0, losses = 0, totalPnL = 0;

  let inTrade       = false;
  let currentTrade  = null;
  let tradeEntryIdx = -1;

  for (let i = 80; i < candles.length - 1; i++) {

    // ── STEP 1: Manage open trade first ──────────────────
    if (inTrade && currentTrade) {
      const c     = candles[i];
      const trade = currentTrade;

      let exitType  = null;
      let exitPrice = null;

      if (trade.dir === "CALL") {
        if (c.open >= trade.tp) {
          // Gap-up open above TP
          exitType  = "TP";
          exitPrice = trade.tp;
        } else if (c.open <= trade.sl) {
          // Gap-down open below SL
          exitType  = "SL";
          exitPrice = trade.sl;
        } else if (c.high >= trade.tp && c.low <= trade.sl) {
          // Both hit same candle — candle direction decides
          exitType  = c.close >= c.open ? "TP" : "SL";
          exitPrice = exitType === "TP" ? trade.tp : trade.sl;
        } else if (c.high >= trade.tp) {
          exitType  = "TP";
          exitPrice = trade.tp;
        } else if (c.low <= trade.sl) {
          exitType  = "SL";
          exitPrice = trade.sl;
        }
      } else {
        // PUT direction — mirror
        if (c.open <= trade.tp) {
          exitType  = "TP";
          exitPrice = trade.tp;
        } else if (c.open >= trade.sl) {
          exitType  = "SL";
          exitPrice = trade.sl;
        } else if (c.low <= trade.tp && c.high >= trade.sl) {
          exitType  = c.close <= c.open ? "TP" : "SL";
          exitPrice = exitType === "TP" ? trade.tp : trade.sl;
        } else if (c.low <= trade.tp) {
          exitType  = "TP";
          exitPrice = trade.tp;
        } else if (c.high >= trade.sl) {
          exitType  = "SL";
          exitPrice = trade.sl;
        }
      }

      // Force-exit after MAX_HOLD candles
      if (!exitType && (i - tradeEntryIdx) >= MAX_HOLD) {
        exitType  = "TIMEOUT";
        exitPrice = c.close;
      }

      if (exitType) {
        // Apply spread on exit
        const actualExit = trade.dir === "CALL"
          ? exitPrice - SPREAD
          : exitPrice + SPREAD;

        const pnl = trade.dir === "CALL"
          ? actualExit - trade.actualEntry
          : trade.actualEntry - actualExit;

        const won = pnl > 0;
        if (won) wins++; else losses++;
        totalPnL += pnl;

        trades.push({
          dir:         trade.dir,
          market:      trade.market,
          rr:          trade.rr,
          entry:       trade.entry,
          actualEntry: +trade.actualEntry.toFixed(2),
          sl:          trade.sl,
          tp:          trade.tp,
          exitType,
          exitPrice:   +actualExit.toFixed(2),
          pnl:         +pnl.toFixed(2),
          won,
          entryTime:   trade.entryTime,
          exitTime:    c.time,
        });

        inTrade      = false;
        currentTrade = null;
      }

      // No new signal while trade is open
      continue;
    }

    // ── STEP 2: Generate signal using ONLY past data ─────
    // candles[0..i] — future is invisible
    const slice  = candles.slice(0, i + 1);
    const signal = strategyFn(slice);

    if (!signal) continue;

    // ── STEP 3: Verify fill on NEXT candle only ──────────
    const next = candles[i + 1];
    if (!next) continue;

    let filled    = false;
    let fillPrice = null;

    if (signal.dir === "CALL") {
      // Must pull back to entry level on next candle
      if (next.low <= signal.entry) {
        filled    = true;
        fillPrice = signal.entry + SPREAD + SLIPPAGE;
      }
    } else {
      // Must rally up to entry level on next candle
      if (next.high >= signal.entry) {
        filled    = true;
        fillPrice = signal.entry - SPREAD - SLIPPAGE;
      }
    }

    if (!filled) continue;

    // ── STEP 4: TP/SL from actual fill price ─────────────
    // Recalculate from fill so levels are honest
    const riskPts = Math.abs(signal.entry - signal.sl);
    const rewPts  = Math.abs(signal.tp    - signal.entry);

    if (!riskPts) continue;

    const tp = signal.dir === "CALL"
      ? fillPrice + rewPts
      : fillPrice - rewPts;

    const sl = signal.dir === "CALL"
      ? fillPrice - riskPts
      : fillPrice + riskPts;

    inTrade       = true;
    tradeEntryIdx = i + 1;
    currentTrade  = {
      dir:         signal.dir,
      market:      signal.market,
      rr:          signal.rr,
      entry:       signal.entry,
      actualEntry: fillPrice,
      sl:          +sl.toFixed(2),
      tp:          +tp.toFixed(2),
      entryTime:   next.time,
    };
  }

  // ── RESULT ───────────────────────────────────────────
  const total   = wins + losses;
  const winRate = total > 0
    ? +((wins / total) * 100).toFixed(2)
    : 0;

  return {
    total,
    wins,
    losses,
    winRate,
    totalPnL: +totalPnL.toFixed(2),
    avgPnL:   total > 0 ? +(totalPnL / total).toFixed(2) : 0,
    trades,
  };
}
