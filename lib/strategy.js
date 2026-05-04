// ================================================
// 🚀 UNIVERSAL MARKET STRATEGY (V2 - BALANCED)
// 4 REGIME SYSTEM (TREND + RANGE + VOL + CHOPPY OFF)
// ================================================

const TF_LIST = [5, 15];

const EMA_FAST = 9;
const EMA_SLOW = 21;
const ATR_PERIOD = 14;

const MIN_RR = 1.3;

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
// 🔍 MARKET DETECTION (FIXED)
// ================================
function detectMarket(c) {
  const atrNow = atr(c);
  const atrPrev = atr(c.slice(0, -1));

  const emaF = ema(c, EMA_FAST);
  const emaS = ema(c, EMA_SLOW);

  const fast = emaF.at(-1);
  const slow = emaS.at(-1);

  const slope = (fast - emaF.at(-3)) / emaF.at(-3);

  if (!atrPrev || !fast || !slow) return "NONE";

  // 🔴 CHOPPY (shutdown)
  if (
    atrNow < atrPrev * 0.65 &&
    Math.abs(fast - slow) / slow < 0.0008
  ) {
    return "CHOPPY";
  }

  // 🟢 TREND (strong + direction confirmed)
  if (
    Math.abs(fast - slow) / slow > 0.0015 &&
    Math.abs(slope) > 0.0012
  ) {
    return "TREND";
  }

  // 🔵 VOLATILE (early detect)
  if (atrNow > atrPrev * 1.25) {
    return "VOLATILE";
  }

  // 🟡 RANGE (only fallback)
  return "RANGE";
}

// ================================
// 🚀 TREND LOGIC (UPGRADED)
// ================================
function trendLogic(c) {
  const emaF = ema(c, EMA_FAST);
  const emaS = ema(c, EMA_SLOW);

  const fast = emaF.at(-1);
  const slow = emaS.at(-1);

  const atrVal = atr(c);
  if (!atrVal) return null;

  if (Math.abs(fast - slow) / slow < 0.0012) return null;

  const dir = fast > slow ? "CALL" : "PUT";

  const last = c.at(-1);
  const prev = c.at(-2);

  // 🔥 momentum confirmation
  if (dir === "CALL" && last.close < prev.close) return null;
  if (dir === "PUT" && last.close > prev.close) return null;

  const entry = fast;

  const sl = dir === "CALL"
    ? entry - atrVal
    : entry + atrVal;

  const tp = dir === "CALL"
    ? entry + atrVal * 1.6
    : entry - atrVal * 1.6;

  return { dir, entry, sl, tp };
}

// ================================
// 🟡 RANGE LOGIC (STRICT FIX)
// ================================
function rangeLogic(c) {
  const look = c.slice(-12);

  const high = Math.max(...look.map(x => x.high));
  const low = Math.min(...look.map(x => x.low));

  const atrVal = atr(c);
  const cur = c.at(-1);

  const mid = (high + low) / 2;

  // 🔥 strong rejection only (major fix)
  if (cur.high >= high && cur.close < cur.open && cur.close > mid) {
    return {
      dir: "PUT",
      entry: cur.close,
      sl: high + atrVal * 0.8,
      tp: cur.close - atrVal * 1.4,
    };
  }

  if (cur.low <= low && cur.close > cur.open && cur.close < mid) {
    return {
      dir: "CALL",
      entry: cur.close,
      sl: low - atrVal * 0.8,
      tp: cur.close + atrVal * 1.4,
    };
  }

  return null;
}

// ================================
// 🔥 VOLATILE (BREAKOUT)
// ================================
function volatileLogic(c) {
  const cur = c.at(-1);
  const prev = c.at(-2);

  const atrVal = atr(c);

  if (!prev || !atrVal) return null;

  const body = Math.abs(cur.close - cur.open);
  const range = cur.high - cur.low;

  // 🔥 strong candle only
  if (!range || body / range < 0.5) return null;

  if (cur.high > prev.high) {
    return {
      dir: "CALL",
      entry: cur.high,
      sl: cur.low,
      tp: cur.high + atrVal * 1.8,
    };
  }

  if (cur.low < prev.low) {
    return {
      dir: "PUT",
      entry: cur.low,
      sl: cur.high,
      tp: cur.low - atrVal * 1.8,
    };
  }

  return null;
}

// ================================
// CORE
// ================================
function generate(c) {
  if (c.length < 80) return null;

  const market = detectMarket(c);

  if (market === "CHOPPY") return null;

  let trade = null;

  // 🔥 priority fixed
  if (market === "TREND") trade = trendLogic(c);
  else if (market === "VOLATILE") trade = volatileLogic(c);
  else if (market === "RANGE") trade = rangeLogic(c);

  if (!trade) return null;

  // 🔥 noise filter (global)
  const last = c.at(-1);
  const range = last.high - last.low;
  const body = Math.abs(last.close - last.open);

  if (!range || body / range < 0.4) return null;

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
    time: c.at(-1).time,
    market,
  };
}

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
