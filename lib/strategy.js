// ================================================
// 🚀 SMART REGIME STRATEGY (V1 - STABLE CORE)
// TREND + RANGE + VOL + FAKE BREAKOUT
// ================================================

const TF_LIST = [1, 2, 3, 5];

const EMA_FAST = 9;
const EMA_SLOW = 21;

const ATR_PERIOD = 14;

const MIN_RR = 1.3;
const ENTRY_BUF = 0.00012;

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
// ADX (lightweight)
// ================================
function adx(c, p = 14) {
  if (c.length < p * 2) return 0;

  let tr = 0, plus = 0, minus = 0;

  const s = c.slice(-(p * 2));

  for (let i = 1; i < s.length; i++) {
    const cur = s[i];
    const prev = s[i - 1];

    const up = cur.high - prev.high;
    const down = prev.low - cur.low;

    plus += (up > down && up > 0) ? up : 0;
    minus += (down > up && down > 0) ? down : 0;

    tr += Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
  }

  if (!tr) return 0;

  const pdi = (plus / tr) * 100;
  const mdi = (minus / tr) * 100;

  return Math.abs(pdi - mdi) / (pdi + mdi) * 100;
}

// ================================
// 🔍 MARKET DETECTION
// ================================
function detectMarket(c) {
  const adxVal = adx(c);
  const atrVal = atr(c);

  if (!atrVal) return "NONE";

  // DEAD ZONE (stability)
  if (adxVal > 20 && adxVal < 27) return "NO_TRADE";

  if (adxVal >= 27) return "TREND";

  if (adxVal <= 20) return "RANGE";

  return "NONE";
}

// ================================
// 🚀 TREND LOGIC (pullback based)
// ================================
function trendLogic(c) {
  const emaF = ema(c, EMA_FAST);
  const emaS = ema(c, EMA_SLOW);

  const fast = emaF.at(-1);
  const slow = emaS.at(-1);

  if (!fast || !slow) return null;

  if (Math.abs(fast - slow) / slow < 0.0012) return null;

  const cur = c.at(-1);
  const atrVal = atr(c);

  if (!atrVal) return null;

  let dir = fast > slow ? "CALL" : "PUT";

  // 🔥 pullback entry (better winrate)
  let entry, sl, tp;

  if (dir === "CALL") {
    entry = cur.close; // not breakout
    sl = cur.low - atrVal * 0.9;
    tp = entry + atrVal * 1.8;
  } else {
    entry = cur.close;
    sl = cur.high + atrVal * 0.9;
    tp = entry - atrVal * 1.8;
  }

  return { dir, entry, sl, tp };
}

// ================================
// 🟡 RANGE LOGIC (bounce)
// ================================
function rangeLogic(c) {
  const cur = c.at(-1);
  const look = c.slice(-10);

  const high = Math.max(...look.map(x => x.high));
  const low = Math.min(...look.map(x => x.low));

  const atrVal = atr(c);
  if (!atrVal) return null;

  // avoid mid trades
  const mid = (high + low) / 2;

  // 🔥 only extremes
  if (cur.close > mid && cur.high >= high) {
    return {
      dir: "PUT",
      entry: cur.high,
      sl: high + atrVal * 0.7,
      tp: cur.high - atrVal * 1.6,
    };
  }

  if (cur.close < mid && cur.low <= low) {
    return {
      dir: "CALL",
      entry: cur.low,
      sl: low - atrVal * 0.7,
      tp: cur.low + atrVal * 1.6,
    };
  }

  return null;
}

// ================================
// 🔴 FAKE BREAKOUT (EDGE)
// ================================
function fakeBreakout(c) {
  const cur = c.at(-1);
  const prev = c.at(-2);

  if (!prev) return null;

  const range = prev.high - prev.low;
  if (!range) return null;

  // fake upside breakout
  if (cur.high > prev.high && cur.close < prev.high) {
    return {
      dir: "PUT",
      entry: cur.close,
      sl: cur.high,
      tp: cur.close - range * 1.5,
    };
  }

  // fake downside breakout
  if (cur.low < prev.low && cur.close > prev.low) {
    return {
      dir: "CALL",
      entry: cur.close,
      sl: cur.low,
      tp: cur.close + range * 1.5,
    };
  }

  return null;
}

// ================================
// 🚀 CORE GENERATOR
// ================================
function generate(c) {
  if (c.length < 80) return null;

  const market = detectMarket(c);

  let trade = null;

  // PRIORITY SYSTEM
  trade = fakeBreakout(c) || null;

  if (!trade) {
    if (market === "TREND") {
      trade = trendLogic(c);
    } else if (market === "RANGE") {
      trade = rangeLogic(c);
    } else {
      return null;
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
  };
}

// ================================
// 🎯 FINAL EXPORT
// ================================
export function strategy(candles) {
  let best = null;

  for (const tf of TF_LIST) {
    const tfCandles = buildTF(candles, tf);

    if (tfCandles.length < 80) continue;

    const t = generate(tfCandles);

    if (!t) continue;

    // 🔥 pick best RR
    if (!best || t.rr > best.rr) {
      best = t;
    }
  }

  return best;
}
