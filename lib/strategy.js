// ================================================
// 🚀 UNIVERSAL MARKET STRATEGY (FINAL STABLE v2)
// STRUCTURE + REGIME + REALISTIC LOGIC
// ================================================

const TF_LIST = [1, 2, 3, 5, 15];

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
// 🔍 MARKET DETECTION (IMPROVED)
// ================================
function detectMarket(c) {
  const atrVal = atr(c);
  if (!atrVal) return "NONE";

  const highs = c.slice(-20).map(x => x.high);
  const lows = c.slice(-20).map(x => x.low);

  const rangeSize = Math.max(...highs) - Math.min(...lows);

  const emaF = ema(c, EMA_FAST);
  const slope =
    (emaF.at(-1) - emaF.at(-3)) / emaF.at(-3);

  if (rangeSize < atrVal * 6) return "CHOPPY";

  if (Math.abs(slope) > 0.0015) return "TREND";

  if (rangeSize > atrVal * 10) return "VOLATILE";

  return "RANGE";
}

// ================================
// 🚀 TREND LOGIC (STRUCTURE BASED)
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

  const lastHigh = Math.max(...c.slice(-10).map(x => x.high));
  const lastLow = Math.min(...c.slice(-10).map(x => x.low));

  const cur = c.at(-1);

  // 🔥 STRUCTURE BREAK (KEY EDGE)
  if (dir === "CALL" && cur.close < lastHigh) return null;
  if (dir === "PUT" && cur.close > lastLow) return null;

  // 🔥 EARLY ENTRY (NOT LATE)
  const entry = dir === "CALL"
    ? fast - atrVal * 0.2
    : fast + atrVal * 0.2;

  const sl = dir === "CALL"
    ? entry - atrVal
    : entry + atrVal;

  const tp = dir === "CALL"
    ? entry + atrVal * 1.5
    : entry - atrVal * 1.5;

  return { dir, entry, sl, tp };
}

// ================================
// 🟡 RANGE LOGIC (REALISTIC)
// ================================
function rangeLogic(c) {
  const look = c.slice(-12);

  const high = Math.max(...look.map(x => x.high));
  const low = Math.min(...look.map(x => x.low));

  const atrVal = atr(c);
  if (!atrVal) return null;

  const cur = c.at(-1);

  if (cur.high >= high) {
    return {
      dir: "PUT",
      entry: high,
      sl: high + atrVal,
      tp: high - atrVal * 1.2,
    };
  }

  if (cur.low <= low) {
    return {
      dir: "CALL",
      entry: low,
      sl: low - atrVal,
      tp: low + atrVal * 1.2,
    };
  }

  return null;
}

// ================================
// 🔥 VOLATILE LOGIC (BREAKOUT)
// ================================
function volatileLogic(c) {
  const cur = c.at(-1);
  const prev = c.at(-2);

  const atrVal = atr(c);
  if (!prev || !atrVal) return null;

  // 🔥 ONLY STRONG BREAK
  if (
    cur.high > prev.high &&
    cur.close > prev.high
  ) {
    return {
      dir: "CALL",
      entry: cur.close,
      sl: cur.low,
      tp: cur.close + atrVal * 1.8,
    };
  }

  if (
    cur.low < prev.low &&
    cur.close < prev.low
  ) {
    return {
      dir: "PUT",
      entry: cur.close,
      sl: cur.high,
      tp: cur.close - atrVal * 1.8,
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

  if (market === "TREND") trade = trendLogic(c);
  else if (market === "RANGE") trade = rangeLogic(c);
  else if (market === "VOLATILE") trade = volatileLogic(c);

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
