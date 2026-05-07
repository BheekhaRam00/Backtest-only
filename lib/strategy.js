// ================================================
// 🚀 FINAL UNIVERSAL STRATEGY (LOW DELAY REALTIME)
// ================================================

const EMA_FAST = 5;
const EMA_SLOW = 13;

const ATR_PERIOD = 7;

const MIN_RR = 1.2;

let lastTradeTime = 0;

// ================================
// 🕒 MARKET TIME FILTER
function isMarketOpen(time) {
  const t = new Date(time);

  const total =
    t.getHours() * 60 + t.getMinutes();

  return total >= (9 * 60 + 15)
      && total <= (15 * 60 + 10);
}

// ================================
// 🚫 FORCE NO OVERNIGHT
function isEOD(time) {
  const t = new Date(time);

  const total =
    t.getHours() * 60 + t.getMinutes();

  return total >= (15 * 60 + 10);
}

// ================================
function ema(c, p) {
  if (c.length < p)
    return c.map(() => 0);

  const k = 2 / (p + 1);

  let e =
    c.slice(0, p)
    .reduce((s, x) => s + x.close, 0) / p;

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
// ⚡ FAST MOMENTUM DETECTION
function generate(c) {

  if (c.length < 30)
    return null;

  const last = c.at(-1);

  if (!isMarketOpen(last.time))
    return null;

  if (isEOD(last.time))
    return null;

  // 🚫 avoid spam entries
  const now = new Date(last.time).getTime();

  if (now - lastTradeTime < 120000)
    return null;

  const emaFast = ema(c, EMA_FAST);
  const emaSlow = ema(c, EMA_SLOW);

  const fastNow = emaFast.at(-1);
  const fastPrev = emaFast.at(-2);

  const slowNow = emaSlow.at(-1);

  const cur = c.at(-1);
  const prev = c.at(-2);

  const atrVal = atr(c);

  if (!atrVal)
    return null;

  let dir = null;

  // =================================
  // ⚡ INSTANT LONG
  if (
    fastNow > slowNow &&
    fastNow > fastPrev &&
    cur.close > prev.high
  ) {
    dir = "CALL";
  }

  // =================================
  // ⚡ INSTANT SHORT
  else if (
    fastNow < slowNow &&
    fastNow < fastPrev &&
    cur.close < prev.low
  ) {
    dir = "PUT";
  }

  if (!dir)
    return null;

  const entry = cur.close;

  let sl;
  let tp;

  if (dir === "CALL") {
    sl = entry - atrVal * 0.8;
    tp = entry + atrVal * 1.4;
  } else {
    sl = entry + atrVal * 0.8;
    tp = entry - atrVal * 1.4;
  }

  const rr =
    Math.abs(tp - entry) /
    Math.abs(entry - sl);

  if (rr < MIN_RR)
    return null;

  lastTradeTime = now;

  return {
    dir,

    entry: +entry.toFixed(2),

    sl: +sl.toFixed(2),

    tp: +tp.toFixed(2),

    rr: +rr.toFixed(2),

    time: last.time,

    market: "REALTIME",
  };
}

// ================================
export function strategy(candles) {

  if (!candles || candles.length < 30)
    return null;

  return generate(candles);
}
