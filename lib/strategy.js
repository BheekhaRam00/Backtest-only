// ================================================
// 🚀 STRAT1 (PRO FILTERED VERSION)
// ================================================

const TF_LIST   = [1, 2, 3, 5];
const EMA_FAST  = 9;
const EMA_SLOW  = 21;
const MIN_RR    = 1.5;          // 🔥 increased
const ENTRY_BUF = 0.0002;
const ATR_PERIOD = 14;

// ================================
function buildTF(candles, tf) {
  if (tf === 1) return candles;

  const res = [];

  for (let i = 0; i + tf <= candles.length; i += tf) {
    const chunk = candles.slice(i, i + tf);

    res.push({
      open:  chunk[0].open,
      high:  Math.max(...chunk.map((c) => c.high)),
      low:   Math.min(...chunk.map((c) => c.low)),
      close: chunk.at(-1).close,
      time:  chunk.at(-1).time,
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
function adx(c, p = 14) {
  if (c.length < p * 2) return 0;

  let tr = 0, plus = 0, minus = 0;

  const s = c.slice(-(p * 2));

  for (let i = 1; i < s.length; i++) {
    const cur = s[i];
    const prev = s[i - 1];

    const up = cur.high - prev.high;
    const down = prev.low - cur.low;

    plus  += (up > down && up > 0) ? up : 0;
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
// 🔥 NEW: STRONG CANDLE FILTER
// ================================
function isStrongCandle(c) {
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  if (!range) return false;

  return body / range > 0.6;
}

// ================================
// 🔥 NEW: TREND QUALITY FILTER
// ================================
function isTrending(fast, slow) {
  return Math.abs(fast - slow) / slow > 0.0015;
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
  // 🚀 TREND (FILTERED)
  // ================================
  if (adxVal >= 30 && isTrending(fast, slow) && isStrongCandle(cur)) {

    const dir = fast > slow ? "CALL" : "PUT";

    if (dir === "CALL") {
      trade = {
        dir,
        entry: cur.high * (1 + ENTRY_BUF),
        sl: cur.low - atrVal,
        tp: cur.high + atrVal * 2.5,   // 🔥 better RR
      };
    } else {
      trade = {
        dir,
        entry: cur.low * (1 - ENTRY_BUF),
        sl: cur.high + atrVal,
        tp: cur.low - atrVal * 2.5,
      };
    }
  }

  // ================================
  // 🔥 RANGE (STRICT BREAKOUT ONLY)
  // ================================
  else if (adxVal <= 18 && isStrongCandle(cur)) {
    const look = c.slice(-12);
    const high = Math.max(...look.map(x => x.high));
    const low  = Math.min(...look.map(x => x.low));

    // 🔥 false breakout filter (close confirmation)
    if (cur.close > high) {
      trade = {
        dir: "CALL",
        entry: cur.close,
        sl: low - atrVal * 0.8,
        tp: cur.close + atrVal * 2.2,
      };
    }

    if (cur.close < low) {
      trade = {
        dir: "PUT",
        entry: cur.close,
        sl: high + atrVal * 0.8,
        tp: cur.close - atrVal * 2.2,
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

// ================================
export function strategy(candles) {
  let best = null;

  for (const tf of TF_LIST) {
    const tfCandles = buildTF(candles, tf);

    const t = generate(tfCandles);

    if (!t) continue;

    // 🔥 BEST TRADE SELECTOR (RR + QUALITY)
    if (!best || t.rr > best.rr) {
      best = t;
    }
  }

  return best;
}
