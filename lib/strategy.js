// ================================================
// 🚀 FINAL STABLE STRATEGY V2 (ACCURACY BOOSTED)
// ================================================

const TF_LIST = [5, 15];

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
// CORE GENERATE (UPGRADED)
// ================================
function generate(c) {
  if (c.length < 80) return null;

  const emaF = ema(c, EMA_FAST);
  const emaS = ema(c, EMA_SLOW);

  const fast = emaF.at(-1);
  const slow = emaS.at(-1);

  if (!fast || !slow) return null;

  const atrVal = atr(c);
  if (!atrVal) return null;

  // 🔥 stronger trend filter (noise cut)
  if (Math.abs(fast - slow) / slow < 0.0015) return null;

  const dir = fast > slow ? "CALL" : "PUT";

  const last = c.at(-1);
  const prev = c.at(-2);

  if (!prev) return null;

  // 🔥 momentum confirmation (key winrate booster)
  if (dir === "CALL" && last.close < prev.close) return null;
  if (dir === "PUT" && last.close > prev.close) return null;

  // 🔥 pullback entry (most important improvement)
  const entry = dir === "CALL"
    ? Math.min(last.close, fast)
    : Math.max(last.close, fast);

  const sl = dir === "CALL"
    ? entry - atrVal * 1.0
    : entry + atrVal * 1.0;

  const tp = dir === "CALL"
    ? entry + atrVal * 1.6
    : entry - atrVal * 1.6;

  const rr =
    Math.abs(tp - entry) /
    Math.abs(entry - sl);

  if (rr < MIN_RR) return null;

  return {
    dir,
    entry: +entry.toFixed(2),
    sl: +sl.toFixed(2),
    tp: +tp.toFixed(2),
    rr: +rr.toFixed(2),
    time: last.time,
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

    // best RR selector
    if (!best || t.rr > best.rr) {
      best = t;
    }
  }

  return best;
}
