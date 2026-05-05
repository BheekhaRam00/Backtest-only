// ================================================
// 🚀 FINAL UNIVERSAL STRATEGY (STABLE + CLEAN)
// ================================================

const TF_LIST = [10];

const EMA_FAST = 9;
const EMA_SLOW = 21;
const ATR_PERIOD = 14;

const MIN_RR = 1.4;

// 🔥 SAME ZONE MEMORY
let lastZone = null;

// ================================
// 🕒 MARKET TIME FILTER (IST)
function isMarketOpen(time) {
  const t = new Date(time);

  const hour = t.getHours();
  const min = t.getMinutes();

  const total = hour * 60 + min;

  // 09:15 to 15:30
  return total >= (9 * 60 + 15) && total <= (15 * 60 + 30);
}

// ================================
function isSameZone(entry, atrVal) {
  if (!atrVal) return false;

  const zone = Math.round(entry / (atrVal * 0.5));

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
// TREND
function trendLogic(c) {
  const emaF = ema(c, EMA_FAST);
  const emaS = ema(c, EMA_SLOW);

  const fast = emaF.at(-1);
  const slow = emaS.at(-1);

  const atrVal = atr(c);
  if (!atrVal) return null;

  if (Math.abs(fast - slow) / slow < 0.001) return null;

  const dir = fast > slow ? "CALL" : "PUT";

  const entry = fast;

  const sl = dir === "CALL" ? entry - atrVal : entry + atrVal;
  const tp = dir === "CALL" ? entry + atrVal * 1.5 : entry - atrVal * 1.5;

  return { dir, entry, sl, tp };
}

// ================================
// RANGE
function rangeLogic(c) {
  const look = c.slice(-10);

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
// VOLATILE
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
      tp: cur.close + atrVal * 1.6,
    };
  }

  if (cur.close < prev.low) {
    return {
      dir: "PUT",
      entry: cur.close,
      sl: cur.high,
      tp: cur.close - atrVal * 1.6,
    };
  }

  return null;
}

// ================================
// CORE
function generate(c) {
  if (c.length < 80) return null;

  const last = c.at(-1);

  // 🔥 MARKET TIME FILTER
  if (!isMarketOpen(last.time)) return null;

  const market = detectMarket(c);

  if (market === "CHOPPY") return null;

  let trade = null;

  if (market === "TREND") trade = trendLogic(c);
  else if (market === "RANGE") trade = rangeLogic(c);
  else if (market === "VOLATILE") trade = volatileLogic(c);

  if (!trade) return null;

  const atrVal = atr(c);

  // 🔥 SAME ZONE BLOCK
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

// // ===================================================
// 🕒 UNIVERSAL TIME RULE (IST - SAFE INJECTION)
// ===================================================

function __getISTMinutes(time) {
  const d = new Date(time);

  const ist = new Date(
    d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  return ist.getHours() * 60 + ist.getMinutes();
}

// ===================================================
// 🔒 OVERRIDE STRATEGY (NO CHANGE TO ORIGINAL)
// ===================================================

// original reference store
const __original_strategy_fn = strategy;

// override same function name (important)
strategy = function (candles) {

  if (!candles || candles.length === 0) {
    return __original_strategy_fn(candles);
  }

  const last = candles[candles.length - 1];
  const minutes = __getISTMinutes(last.time);

  const ENTRY_CUTOFF = 15 * 60 + 20; // 3:20 PM
  const EXIT_CUTOFF  = 15 * 60 + 26; // 3:26 PM

  // ============================================
  // 🚨 FORCE EXIT AFTER 3:26 PM
  // ============================================
  if (minutes >= EXIT_CUTOFF) {
    return {
      action: "EXIT_ALL",
      reason: "EOD_FORCE_EXIT_3_26",
      time: last.time
    };
  }

  // ============================================
  // 🚫 BLOCK NEW ENTRY AFTER 3:20 PM
  // ============================================
  if (minutes >= ENTRY_CUTOFF) {
    return null;
  }

  // ============================================
  // ✅ NORMAL FLOW (UNCHANGED)
  // ============================================
  return __original_strategy_fn(candles);
};==

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
