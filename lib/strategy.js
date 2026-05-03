const MIN_RR = 1.3;   // 🔥 reduce slightly

// ================================
// NEW: relaxed strong candle
function isGoodCandle(c) {
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  if (!range) return false;

  return body / range > 0.4; // 🔥 relaxed
}

// ================================
function generate(c) {
  if (c.length < 80) return null;

  const cur = c.at(-1);

  const emaF = ema(c, EMA_FAST);
  const emaS = ema(c, EMA_SLOW);

  const fast = emaF.at(-1);
  const slow = emaS.at(-1);

  const atrVal = atr(c);
  const adxVal = adx(c);

  if (!atrVal || !fast || !slow) return null;

  let trade = null;

  // ================================
  // 🔥 TREND (RELAXED)
  // ================================
  if (adxVal >= 23) {   // 🔥 was 30

    if (Math.abs(fast - slow) / slow < 0.0012) return null;

    if (!isGoodCandle(cur)) return null;

    const dir = fast > slow ? "CALL" : "PUT";

    if (dir === "CALL") {
      trade = {
        dir,
        entry: cur.high,
        sl: cur.low - atrVal * 0.8,
        tp: cur.high + atrVal * 2,
      };
    } else {
      trade = {
        dir,
        entry: cur.low,
        sl: cur.high + atrVal * 0.8,
        tp: cur.low - atrVal * 2,
      };
    }
  }

  // ================================
  // 🔥 RANGE (LESS STRICT)
  // ================================
  else if (adxVal <= 22) {

    const look = c.slice(-10);
    const high = Math.max(...look.map(x => x.high));
    const low  = Math.min(...look.map(x => x.low));

    // 🔥 allow wick breakout also
    if (cur.high >= high && isGoodCandle(cur)) {
      trade = {
        dir: "PUT",
        entry: cur.high,
        sl: high + atrVal * 0.6,
        tp: cur.high - atrVal * 1.8,
      };
    }

    if (cur.low <= low && isGoodCandle(cur)) {
      trade = {
        dir: "CALL",
        entry: cur.low,
        sl: low - atrVal * 0.6,
        tp: cur.low + atrVal * 1.8,
      };
    }
  }

  if (!trade) return null;

  const rr =
    Math.abs(trade.tp - trade.entry) /
    Math.abs(trade.entry - trade.sl);

  if (rr < MIN_RR) return null;

  return {
    ...trade,
    entry: +trade.entry.toFixed(2),
    sl: +trade.sl.toFixed(2),
    tp: +trade.tp.toFixed(2),
    rr: +rr.toFixed(2),
    time: cur.time,
  };
}
