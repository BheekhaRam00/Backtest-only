// ================================================
// 🚀 SMART REGIME STRATEGY (V4 - ENTRY FIRST ENGINE)
// TARGET: HIGH ACCURACY + CONTROLLED TRADES
// ================================================

const TF_LIST = [1, 2, 3, 5];

const EMA_FAST = 9;
const EMA_SLOW = 21;

const ATR_PERIOD = 14;

const MIN_RR = 1.25;
const MAX_RR = 1.8;

// ================================
// BUILD TF
// ================================
function buildTF(candles, tf) {
  if (tf === 1) return candles;

  const res = [];

  for (let i = 0; i + tf <= candles.length; i += tf) {
    const chunk = candles.slice(i, i + tf);

    res.push({
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk.at(-1).close,
      time: chunk.at(-1).time,
    });
  }

  return res;
}

// ================================
// EMA
// ================================
function ema(c, p) {
  if (c.length < p) return c.map(() => 0);

  const k = 2 / (p + 1);

  let e = c.slice(0, p).reduce((s, x) => s + x.close, 0) / p;
  const arr = Array(p).fill(e);

  for (let i = p; i < c.length; i++) {
    e = c[i].close * k + e * (1 - k);
    arr.push(e);
  }

  return arr;
}

// ================================
// ATR
// ================================
function atr(c, p = ATR_PERIOD) {
  if (c.length < p + 1) return 0;

  let sum = 0;
  const s = c.slice(-(p + 1));

  for (let i = 1; i < s.length; i++) {
    const cur = s[i];
    const prev = s[i - 1];

    sum += Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
  }

  return sum / p;
}

// ================================
// MARKET DETECTION (NON-LAG)
// ================================
function detectMarket(c) {
  const emaF = ema(c, EMA_FAST);
  const fast = emaF.at(-1);
  const prevFast = emaF.at(-3);

  const slope = (fast - prevFast) / prevFast;

  if (Math.abs(slope) > 0.0015) return "TREND";
  if (Math.abs(slope) > 0.0007) return "WEAK_TREND";

  return "RANGE";
}

// ================================
// 🔥 TREND ENTRY (PULLBACK BASED)
// ================================
function trendLogic(c) {
  const emaF = ema(c, EMA_FAST);
  const emaS = ema(c, EMA_SLOW);

  const fast = emaF.at(-1);
  const slow = emaS.at(-1);

  const cur = c.at(-1);
  const atrVal = atr(c);

  if (!fast || !slow || !atrVal) return null;

  if (Math.abs(fast - slow) / slow < 0.001) return null;

  const dir = fast > slow ? "CALL" : "PUT";

  // 🔥 REAL EDGE: pullback entry (not late)
  let entry = dir === "CALL"
    ? fast * 0.999
    : fast * 1.001;

  let sl = dir === "CALL"
    ? entry - atrVal * 0.9
    : entry + atrVal * 0.9;

  let tp = dir === "CALL"
    ? entry + atrVal * 1.5
    : entry - atrVal * 1.5;

  return { dir, entry, sl, tp };
}

// ================================
// 🔥 RANGE ENTRY (EXTREME ONLY)
// ================================
function rangeLogic(c) {
  const cur = c.at(-1);
  const look = c.slice(-12);

  const high = Math.max(...look.map(x => x.high));
  const low = Math.min(...look.map(x => x.low));

  const atrVal = atr(c);
  if (!atrVal) return null;

  const range = high - low;

  // only take strong extremes
  if (cur.high >= high) {
    return {
      dir: "PUT",
      entry: high - atrVal * 0.2,
      sl: high + atrVal * 0.7,
      tp: high - atrVal * 1.3,
    };
  }

  if (cur.low <= low) {
    return {
      dir: "CALL",
      entry: low + atrVal * 0.2,
      sl: low - atrVal * 0.7,
      tp: low + atrVal * 1.3,
    };
  }

  return null;
}

// ================================
// 🔥 OVERTRADING CONTROL
// ================================
function tradeSpacingFilter(c) {
  const cur = c.at(-1);
  const prev = c.at(-2);

  if (!prev) return true;

  const move = Math.abs(cur.close - prev.close);
  const atrVal = atr(c);

  if (move < atrVal * 0.25) return false;

  return true;
}

// ================================
// CORE
// ================================
function generate(c) {
  if (c.length < 80) return null;

  if (!tradeSpacingFilter(c)) return null;

  const market = detectMarket(c);

  let trade = null;

  if (market === "TREND") {
    trade = trendLogic(c);
  } else {
    trade = rangeLogic(c);
  }

  if (!trade) return null;

  const rr =
    Math.abs(trade.tp - trade.entry) /
    Math.abs(trade.entry - trade.sl);

  // 🔥 realistic RR band
  if (rr < MIN_RR || rr > MAX_RR) return null;

  return {
    ...trade,
    entry: +trade.entry.toFixed(2),
    sl: +trade.sl.toFixed(2),
    tp: +trade.tp.toFixed(2),
    rr: +rr.toFixed(2),
    time: c.at(-1).time,
    market,
  };
}

// ================================
// FINAL EXPORT
// ================================
export function strategy(candles) {
  let best = null;

  for (const tf of TF_LIST) {
    const tfCandles = buildTF(candles, tf);

    if (tfCandles.length < 80) continue;

    const t = generate(tfCandles);

    if (!t) continue;

    if (!best || t.rr > best.rr) {
      best = t;
    }
  }

  return best;
}
