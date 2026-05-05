// ================================================
// 🚀 FINAL UNIVERSAL STRATEGY V2 (TUNED + SAFE)
// ================================================

const TF_LIST = [3, 5, 15];

const EMA_FAST = 9;
const EMA_SLOW = 21;
const ATR_PERIOD = 14;

// 🔥 relaxed RR
const MIN_RR = 1.25;

// 🔥 SAME ZONE MEMORY
let lastZone = null;

// ================================
// 🕒 MARKET TIME FILTER (IST)
function isMarketOpen(time) {
  const t = new Date(time);

  const hour = t.getHours();
  const min = t.getMinutes();

  const total = hour * 60 + min;

  // tuned window
  return total >= (9 * 60 + 20) && total <= (15 * 60 + 20);
}

// ================================
function isSameZone(entry, atrVal) {
  if (!atrVal) return false;

  // 🔥 relaxed zone
  const zone = Math.round(entry / (atrVal * 0.8));

  if (zone === lastZone) return true;

  lastZone = zone;
  return false;
}

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
// 🔍 MARKET TYPE
function detectMarket(c) {
  const atrNow = atr(c);
  const atrPrev = atr(c.slice(0, -1));

  const emaF = ema(c, EMA_FAST);
  const slope = (emaF.at(-1) - emaF.at(-3)) / emaF.at(-3);

  if (!atrPrev) return "NONE";

  if (atrNow < atrPrev * 0.7) return "CHOPPY";
  if (Math.abs(slope) > 0.0012) return "TREND";
  if (atrNow > atrPrev * 1.4) return "VOLATILE";

  return "RANGE";
}

// ================================
// TREND (TUNED)
function trendLogic(c) {
  const emaF = ema(c, EMA_FAST);
  const emaS = ema(c, EMA_SLOW);

  const fast = emaF.at(-1);
  const slow = emaS.at(-1);

  const atrVal = atr(c);
  if (!atrVal) return null;

  if (Math.abs(fast - slow) / slow < 0.001) return null;

  const dir = fast > slow ? "CALL" : "PUT";

  const last = c.at(-1);

  // 🔥 aggressive entry
  const entry = last.close;

  const sl = dir === "CALL"
    ? entry - atrVal * 0.9
    : entry + atrVal * 0.9;

  const tp = dir === "CALL"
    ? entry + atrVal * 1.8
    : entry - atrVal * 1.8;

  return { dir, entry, sl, tp };
}

// ================================
// RANGE (TUNED)
function rangeLogic(c) {
  const look = c.slice(-14);

  const high = Math.max(...look.map(x => x.high));
  const low = Math.min(...look.map(x => x.low));

  const atrVal = atr(c);
  const cur = c.at(-1);

  if (cur.high >= high) {
    return {
      dir: "PUT",
      entry: high,
      sl: high + atrVal,
      tp: high - atrVal * 1.4,
    };
  }

  if (cur.low <= low) {
    return {
      dir: "CALL",
      entry: low,
      sl: low - atrVal,
      tp: low + atrVal * 1.4,
    };
  }

  return null;
}

// ================================
// VOLATILE (TUNED)
function volatileLogic(c) {
  const cur = c.at(-1);
  const prev = c.at(-2);

  const atrVal = atr(c);

  if (!prev || !atrVal) return null;

  if (cur.close > prev.high) {
    return {
      dir: "CALL",
      entry: cur.close,
      sl: cur.low,
      tp: cur.close + atrVal * 1.9,
    };
  }

  if (cur.close < prev.low) {
    return {
      dir: "PUT",
      entry: cur.close,
      sl: cur.high,
      tp: cur.close - atrVal * 1.9,
    };
  }

  return null;
}

// ================================
// CORE
function generate(c) {
  if (c.length < 80) return null;

  const last = c.at(-1);

  if (!isMarketOpen(last.time)) return null;

  const market = detectMarket(c);

  let trade = null;

  // 🔥 CHOPPY FIX (important)
  if (market === "CHOPPY") {
    trade = rangeLogic(c);
  } else if (market === "TREND") {
    trade = trendLogic(c);
  } else if (market === "RANGE") {
    trade = rangeLogic(c);
  } else if (market === "VOLATILE") {
    trade = volatileLogic(c);
  }

  if (!trade) return null;

  const atrVal = atr(c);

  if (isSameZone(trade.entry, atrVal)) return null;

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
    time: last.time,
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
