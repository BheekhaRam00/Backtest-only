// ================================================
// 🚀 SMART REGIME STRATEGY (V3 - INTELLIGENT SWITCH)
// TREND + RANGE + FAKE + VOL + CONTEXT AWARE
// ================================================

const TF_LIST = [1, 2, 3, 5];

const EMA_FAST = 9;
const EMA_SLOW = 21;

const ATR_PERIOD = 14;

const MIN_RR = 1.3;

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
// 🔥 ADVANCED MARKET DETECTION
// ================================
function detectMarket(c) {
  const atrNow = atr(c);
  const atrPrev = atr(c.slice(0, -1));

  const emaF = ema(c, EMA_FAST);
  const emaS = ema(c, EMA_SLOW);

  const fast = emaF.at(-1);
  const slow = emaS.at(-1);

  const cur = c.at(-1);
  const prev = c.at(-2);

  if (!atrNow || !atrPrev || !prev) return "NONE";

  const slope = (fast - emaF.at(-3)) / emaF.at(-3);

  const volState =
    atrNow > atrPrev * 1.2 ? "HIGH" :
    atrNow < atrPrev * 0.8 ? "LOW" :
    "NORMAL";

  const hh = cur.high > prev.high;
  const ll = cur.low < prev.low;

  if (Math.abs(slope) > 0.0015 && volState !== "LOW") {
    return "STRONG_TREND";
  }

  if (Math.abs(slope) > 0.0007) {
    return "WEAK_TREND";
  }

  if (!hh && !ll && volState !== "HIGH") {
    return "RANGE";
  }

  if (hh && ll && volState === "HIGH") {
    return "FAKE";
  }

  return "NONE";
}

// ================================
// BASE FILTER (LIGHT)
// ================================
function baseFilter(c) {
  const cur = c.at(-1);
  const body = Math.abs(cur.close - cur.open);
  const range = cur.high - cur.low;

  if (!range || body / range < 0.25) return false;

  return true;
}

// ================================
// TREND LOGIC
// ================================
function trendLogic(c, mode = "normal") {
  if (!baseFilter(c)) return null;

  const emaF = ema(c, EMA_FAST);
  const emaS = ema(c, EMA_SLOW);

  const fast = emaF.at(-1);
  const slow = emaS.at(-1);

  if (!fast || !slow) return null;

  if (Math.abs(fast - slow) / slow < 0.001) return null;

  const cur = c.at(-1);
  const atrVal = atr(c);

  if (!atrVal) return null;

  const dir = fast > slow ? "CALL" : "PUT";

  if (dir === "CALL" && cur.close < fast) return null;
  if (dir === "PUT" && cur.close > fast) return null;

  let entry = cur.close;
  let sl = dir === "CALL"
    ? cur.low - atrVal * 0.9
    : cur.high + atrVal * 0.9;

  let tp = dir === "CALL"
    ? entry + atrVal * 1.8
    : entry - atrVal * 1.8;

  // 🔥 weak trend safer TP
  if (mode === "weak") {
    tp = dir === "CALL"
      ? entry + atrVal * 1.2
      : entry - atrVal * 1.2;
  }

  return { dir, entry, sl, tp };
}

// ================================
// RANGE LOGIC
// ================================
function rangeLogic(c) {
  if (!baseFilter(c)) return null;

  const cur = c.at(-1);
  const look = c.slice(-10);

  const high = Math.max(...look.map(x => x.high));
  const low = Math.min(...look.map(x => x.low));

  const atrVal = atr(c);
  if (!atrVal) return null;

  const mid = (high + low) / 2;

  if (cur.high >= high && cur.close < cur.open && cur.close > mid) {
    return {
      dir: "PUT",
      entry: cur.close,
      sl: high + atrVal * 0.6,
      tp: cur.close - atrVal * 1.4,
    };
  }

  if (cur.low <= low && cur.close > cur.open && cur.close < mid) {
    return {
      dir: "CALL",
      entry: cur.close,
      sl: low - atrVal * 0.6,
      tp: cur.close + atrVal * 1.4,
    };
  }

  return null;
}

// ================================
// FAKE BREAKOUT
// ================================
function fakeBreakout(c) {
  const cur = c.at(-1);
  const prev = c.at(-2);

  if (!prev) return null;

  const range = prev.high - prev.low;
  if (!range) return null;

  const body = Math.abs(cur.close - cur.open);
  const full = cur.high - cur.low;

  if (!full || body / full < 0.35) return null;

  if (cur.high > prev.high && cur.close < prev.high) {
    return {
      dir: "PUT",
      entry: cur.close,
      sl: cur.high,
      tp: cur.close - range * 1.3,
    };
  }

  if (cur.low < prev.low && cur.close > prev.low) {
    return {
      dir: "CALL",
      entry: cur.close,
      sl: cur.low,
      tp: cur.close + range * 1.3,
    };
  }

  return null;
}

// ================================
// CORE GENERATOR
// ================================
function generate(c) {
  if (c.length < 80) return null;

  const market = detectMarket(c);

  let trade = null;

  // 🔥 smart switching
  if (market === "FAKE") {
    trade = fakeBreakout(c);
  }

  if (!trade) {
    if (market === "STRONG_TREND") {
      trade = trendLogic(c, "strong");
    }

    else if (market === "WEAK_TREND") {
      trade = trendLogic(c, "weak");
    }

    else if (market === "RANGE") {
      trade = rangeLogic(c);
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
