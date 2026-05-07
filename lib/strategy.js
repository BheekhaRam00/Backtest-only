// ================================================
// 🚀 FINAL UNIVERSAL STRATEGY (1M STABLE + CLEAN)
// ================================================

const TF_LIST = [1];

const EMA_FAST = 9;
const EMA_SLOW = 21;
const ATR_PERIOD = 14;

const MIN_RR = 1.5;

// 🔥 SAME ZONE MEMORY
let lastZone = null;

// ================================
// 🕒 IST TIME HELPER
function getISTMinutes(time) {

  const t = new Date(time);

  const utcH = t.getUTCHours();
  const utcM = t.getUTCMinutes();

  // UTC → IST
  const istTotal =
    (utcH * 60 + utcM) + 330;

  return istTotal % 1440;
}

// ================================
// 🕒 MARKET TIME FILTER
function isMarketOpen(time) {

  const total =
    getISTMinutes(time);

  // 09:15 → 15:30 IST
  return (
    total >= (9 * 60 + 15) &&
    total <= (15 * 60 + 30)
  );
}

// ================================
function isSameZone(entry, atrVal) {

  if (!atrVal)
    return false;

  const zone =
    Math.round(
      entry / (atrVal * 0.5)
    );

  if (zone === lastZone)
    return true;

  lastZone = zone;

  return false;
}

// ================================
function buildTF(candles, tf) {

  if (tf === 1)
    return candles;

  const res = [];

  let bucket = [];

  let currentKey = null;

  for (const candle of candles) {

    const t = new Date(candle.time);

    const totalMinutes =

      t.getUTCHours() * 60 +
      t.getUTCMinutes();

    const key =
      Math.floor(totalMinutes / tf);

    if (currentKey === null) {
      currentKey = key;
    }

    if (key !== currentKey) {

      if (bucket.length) {

        res.push({

          open:
            bucket[0].open,

          high:
            Math.max(
              ...bucket.map(x => x.high)
            ),

          low:
            Math.min(
              ...bucket.map(x => x.low)
            ),

          close:
            bucket.at(-1).close,

          time:
            bucket[0].time,
        });
      }

      bucket = [];
      currentKey = key;
    }

    bucket.push(candle);
  }

  if (bucket.length) {

    res.push({

      open:
        bucket[0].open,

      high:
        Math.max(
          ...bucket.map(x => x.high)
        ),

      low:
        Math.min(
          ...bucket.map(x => x.low)
        ),

      close:
        bucket.at(-1).close,

      time:
        bucket[0].time,
    });
  }

  return res;
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

  const arr =
    Array(p).fill(e);

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

  const s =
    c.slice(-(p + 1));

  for (let i = 1; i < s.length; i++) {

    const cur = s[i];
    const prev = s[i - 1];

    sum += Math.max(

      cur.high - cur.low,

      Math.abs(
        cur.high - prev.close
      ),

      Math.abs(
        cur.low - prev.close
      )
    );
  }

  return sum / p;
}

// ================================
// 🔍 MARKET TYPE
function detectMarket(c) {

  const atrNow =
    atr(c);

  const atrPrev =
    atr(c.slice(0, -1));

  const emaF =
    ema(c, EMA_FAST);

  const slope =

    (emaF.at(-1) - emaF.at(-3)) /

    emaF.at(-3);

  if (!atrPrev)
    return "NONE";

  // 🔥 LOW VOLATILITY FILTER
  if (atrNow < atrPrev * 0.75)
    return "CHOPPY";

  // 🔥 STRONG TREND FILTER
  if (Math.abs(slope) > 0.0015)
    return "TREND";

  // 🔥 HIGH VOLATILITY
  if (atrNow > atrPrev * 1.4)
    return "VOLATILE";

  return "RANGE";
}

// ================================
// 📈 TREND
function trendLogic(c) {

  const emaF =
    ema(c, EMA_FAST);

  const emaS =
    ema(c, EMA_SLOW);

  const fast =
    emaF.at(-1);

  const slow =
    emaS.at(-1);

  const atrVal =
    atr(c);

  if (!atrVal)
    return null;

  // 🔥 STRONG EMA GAP
  if (
    Math.abs(fast - slow) / slow < 0.0025
  ) {
    return null;
  }

  const cur =
    c.at(-1);

  if (!cur)
    return null;

  // 🔥 STRONG BODY FILTER
  const body =
    Math.abs(cur.close - cur.open);

  const range =
    cur.high - cur.low;

  if (!range)
    return null;

  if (body / range < 0.55)
    return null;

  // 🔥 ATR EXPANSION
  const atrNow =
    atr(c);

  const atrPrev =
    atr(c.slice(0, -3));

  if (atrNow < atrPrev * 1.1)
    return null;

  const dir =
    fast > slow
      ? "CALL"
      : "PUT";

  // 🔥 REALISTIC MID ENTRY
  const entry =
    (cur.high + cur.low) / 2;

  const sl =

    dir === "CALL"

      ? entry - atrVal

      : entry + atrVal;

  const tp =

    dir === "CALL"

      ? entry + atrVal * 1.5

      : entry - atrVal * 1.5;

  return {
    dir,
    entry,
    sl,
    tp,
  };
}

// ================================
// 📊 RANGE
function rangeLogic(c) {

  const look =
    c.slice(-11, -1);

  const high =
    Math.max(
      ...look.map(x => x.high)
    );

  const low =
    Math.min(
      ...look.map(x => x.low)
    );

  const atrVal =
    atr(c);

  const cur =
    c.at(-1);

  if (!cur)
    return null;

  if (cur.high >= high) {

    return {

      dir: "PUT",

      entry:
        (cur.high + cur.low) / 2,

      sl:
        cur.close + atrVal,

      tp:
        cur.close - atrVal * 1.4,
    };
  }

  if (cur.low <= low) {

    return {

      dir: "CALL",

      entry:
        (cur.high + cur.low) / 2,

      sl:
        cur.close - atrVal,

      tp:
        cur.close + atrVal * 1.4,
    };
  }

  return null;
}

// ================================
// ⚡ VOLATILE
function volatileLogic(c) {

  const cur =
    c.at(-1);

  const prev =
    c.at(-2);

  const atrVal =
    atr(c);

  if (
    !prev ||
    !cur ||
    !atrVal
  ) {
    return null;
  }

  // 🔥 STRONG BODY ONLY
  const body =
    Math.abs(cur.close - cur.open);

  const range =
    cur.high - cur.low;

  if (!range)
    return null;

  if (body / range < 0.6)
    return null;

  if (cur.close > prev.high) {

    return {

      dir: "CALL",

      entry:
        (cur.high + cur.low) / 2,

      sl:
        cur.low,

      tp:
        cur.close + atrVal * 1.6,
    };
  }

  if (cur.close < prev.low) {

    return {

      dir: "PUT",

      entry:
        (cur.high + cur.low) / 2,

      sl:
        cur.high,

      tp:
        cur.close - atrVal * 1.6,
    };
  }

  return null;
}

// ================================
// 🚀 CORE
function generate(c) {

  if (c.length < 80)
    return null;

  const last =
    c.at(-1);

  if (!last)
    return null;

  // 🔥 MARKET TIME FILTER
  if (!isMarketOpen(last.time))
    return null;

  const market =
    detectMarket(c);

  // 🔥 CHOPPY BLOCK
  if (market === "CHOPPY")
    return null;

  let trade = null;

  if (market === "TREND") {

    trade =
      trendLogic(c);

  } else if (market === "RANGE") {

    trade =
      rangeLogic(c);

  } else if (market === "VOLATILE") {

    trade =
      volatileLogic(c);
  }

  if (!trade)
    return null;

  const atrVal =
    atr(c);

  // 🔥 SAME ZONE BLOCK
  if (
    isSameZone(
      trade.entry,
      atrVal
    )
  ) {
    return null;
  }

  const rr =

    Math.abs(
      trade.tp - trade.entry
    ) /

    Math.abs(
      trade.entry - trade.sl
    );

  if (rr < MIN_RR)
    return null;

  return {

    ...trade,

    entry:
      +trade.entry.toFixed(2),

    sl:
      +trade.sl.toFixed(2),

    tp:
      +trade.tp.toFixed(2),

    rr:
      +rr.toFixed(2),

    time:
      last.time,

    market,
  };
}

// ================================
// 🚀 MAIN EXPORT
export function strategy(candles) {

  let best = null;

  for (const tf of TF_LIST) {

    const tfCandles =
      buildTF(candles, tf);

    if (tfCandles.length < 80)
      continue;

    const t =
      generate(tfCandles);

    if (!t)
      continue;

    if (
      !best ||
      t.rr > best.rr
    ) {
      best = t;
    }
  }

  return best;
        }
