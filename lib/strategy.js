// ================================================
// 🚀 FINAL UNIVERSAL STRATEGY (LOW DELAY REALTIME)
// ================================================

const EMA_FAST = 3;
const EMA_SLOW = 8;

const ATR_PERIOD = 5;

const MIN_RR = 1.15;

// 🔥 TRADE COOLDOWN MEMORY
let lastTradeTime = 0;

// ================================
// 🕒 MARKET TIME FILTER
function isMarketOpen(time) {
  const t = new Date(time);

  const total =
    t.getHours() * 60 + t.getMinutes();

  // 09:15 → 15:10
  return (
    total >= (9 * 60 + 15) &&
    total <= (15 * 60 + 10)
  );
}

// ================================
// 🚫 NO OVERNIGHT
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
    c
      .slice(0, p)
      .reduce((s, x) => s + x.close, 0) / p;

  const arr = Array(p).fill(e);

  for (let i = p; i < c.length; i++) {

    e =
      c[i].close * k +
      e * (1 - k);

    arr.push(e);
  }

  return arr;
}

// ================================
function atr(c, p = ATR_PERIOD) {

  if (c.length < p + 1)
    return 0;

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
// ⚡ CORE GENERATOR
function generate(c) {

  if (!c || c.length < 20)
    return null;

  const last = c.at(-1);

  if (!last)
    return null;

  // ================================
  // 🕒 MARKET FILTER
  if (!isMarketOpen(last.time))
    return null;

  // ================================
  // 🚫 NO BTST
  if (isEOD(last.time))
    return null;

  // ================================
  // 🚫 COOLDOWN FILTER
  const now =
    new Date(last.time).getTime();

  // 30 sec cooldown
  if (now - lastTradeTime < 30000)
    return null;

  // ================================
  // 📈 EMA
  const emaFast = ema(c, EMA_FAST);
  const emaSlow = ema(c, EMA_SLOW);

  const fastNow = emaFast.at(-1);
  const slowNow = emaSlow.at(-1);

  if (
    fastNow === undefined ||
    slowNow === undefined
  ) {
    return null;
  }

  // ================================
  // 📊 CANDLES
  const cur = c.at(-1);

  if (!cur)
    return null;

  // ================================
  // 📉 ATR
  const atrVal = atr(c);

  if (!atrVal || atrVal <= 0)
    return null;

  // ================================
  // ⚡ MOMENTUM LOGIC

  const bullish =

    cur.close > cur.open &&
    cur.close > fastNow &&
    fastNow > slowNow;

  const bearish =

    cur.close < cur.open &&
    cur.close < fastNow &&
    fastNow < slowNow;

  let dir = null;

  if (bullish) {

    dir = "CALL";

  } else if (bearish) {

    dir = "PUT";
  }

  if (!dir)
    return null;

  // ================================
  // 🎯 ENTRY
  const entry = cur.close;

  let sl;
  let tp;

  // ================================
  // 📌 SL TP

  if (dir === "CALL") {

    sl =
      entry - atrVal * 0.7;

    tp =
      entry + atrVal * 1.3;

  } else {

    sl =
      entry + atrVal * 0.7;

    tp =
      entry - atrVal * 1.3;
  }

  // ================================
  // 📈 RR
  const rr =

    Math.abs(tp - entry) /

    Math.abs(entry - sl);

  if (
    !isFinite(rr) ||
    rr < MIN_RR
  ) {
    return null;
  }

  // ================================
  // 💾 SAVE LAST TRADE
  lastTradeTime = now;

  // ================================
  // ✅ FINAL TRADE
  return {

    dir,

    entry:
      +entry.toFixed(2),

    sl:
      +sl.toFixed(2),

    tp:
      +tp.toFixed(2),

    rr:
      +rr.toFixed(2),

    time:
      last.time,

    market:
      "REALTIME",
  };
}

// ================================
// 🚀 MAIN EXPORT
export function strategy(candles) {

  if (
    !candles ||
    candles.length < 20
  ) {
    return null;
  }

  return generate(candles);
}
