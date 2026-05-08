// ================================================
// 🚀 FINAL UNIVERSAL STRATEGY (1M STABLE + CLEAN)
// ================================================

const TF_LIST = [1];

const EMA_FAST = 9;
const EMA_SLOW = 21;
const ATR_PERIOD = 14;

const MIN_RR = 1.5;

const MIN_SL = 12;

const AO_FAST = 5;
const AO_SLOW = 34;

const ADX_PERIOD = 14;

const MIN_ADX = 18;

const AO_MIN_THRESHOLD = 0.5;

// ================================
// 🕒 IST TIME HELPER
function getISTMinutes(time) {

  const t = new Date(time);

  const utcH = t.getUTCHours();
  const utcM = t.getUTCMinutes();

  const istTotal =
    (utcH * 60 + utcM) + 330;

  return istTotal % 1440;
}

// ================================
function isMarketOpen(time) {

  const total =
    getISTMinutes(time);

  return (
    total >= (9 * 60 + 15) &&
    total <= (15 * 60 + 30)
  );
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
            bucket[
              bucket.length - 1
            ].close,

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
        bucket[
          bucket.length - 1
        ].close,

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

function sma(values, period) {

  if (values.length < period)
    return [];

  const result = [];

  for (let i = 0; i <= values.length - period; i++) {

    const slice =
      values.slice(i, i + period);

    const avg =
      slice.reduce((a, b) => a + b, 0) / period;

    result.push(avg);
  }

  return result;
}

// =================================
function awesomeOscillator(c) {

  if (c.length < AO_SLOW + 5)
    return null;

  const medianPrices =
    c.map(x =>
      (x.high + x.low) / 2
    );

  const smaFast =
    sma(medianPrices, AO_FAST);

  const smaSlow =
    sma(medianPrices, AO_SLOW);

  if (
    !smaFast.length ||
    !smaSlow.length
  ) {
    return null;
  }

  const offset =
    smaFast.length - smaSlow.length;

  const ao = [];

  for (let i = 0; i < smaSlow.length; i++) {

    ao.push(
      smaFast[i + offset] -
      smaSlow[i]
    );
  }

  return ao;
}

// =================================
function adx(c, period = ADX_PERIOD) {

  if (c.length < period + 5)
    return 0;

  let trSum = 0;
  let plusDMSum = 0;
  let minusDMSum = 0;

  for (
    let i = c.length - period;
    i < c.length;
    i++
  ) {

    const cur = c[i];
    const prev = c[i - 1];

    const upMove =
      cur.high - prev.high;

    const downMove =
      prev.low - cur.low;

    const plusDM =
      upMove > downMove && upMove > 0
        ? upMove
        : 0;

    const minusDM =
      downMove > upMove && downMove > 0
        ? downMove
        : 0;

    const tr =
      Math.max(
        cur.high - cur.low,
        Math.abs(cur.high - prev.close),
        Math.abs(cur.low - prev.close)
      );

    trSum += tr;
    plusDMSum += plusDM;
    minusDMSum += minusDM;
  }

  if (!trSum)
    return 0;

  const plusDI =
    (plusDMSum / trSum) * 100;

  const minusDI =
    (minusDMSum / trSum) * 100;

  const dx =
    Math.abs(plusDI - minusDI) /
    (plusDI + minusDI);

  return dx * 100;
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
function detectMarket(c) {

  const atrNow =
    atr(c);

  const atrPrev =
    atr(c.slice(0, -1));

  const emaF =
    ema(c, EMA_FAST);

  const slope =

    (
      emaF[
        emaF.length - 1
      ] -

      emaF[
        emaF.length - 3
      ]
    ) /

    emaF[
      emaF.length - 3
    ];

  if (!atrPrev)
    return "NONE";

  if (atrNow < atrPrev * 0.75)
    return "CHOPPY";

  if (Math.abs(slope) > 0.0015)
    return "TREND";

  if (atrNow > atrPrev * 1.4)
    return "VOLATILE";

  return "RANGE";
}

// ================================
function trendLogic(c) {

  const emaF =
    ema(c, EMA_FAST);

  const emaS =
    ema(c, EMA_SLOW);

  const fast =
    emaF[
      emaF.length - 1
    ];

  const slow =
    emaS[
      emaS.length - 1
    ];

  const atrVal =
    Math.max(
      atr(c),
      MIN_SL
    );

  if (!atrVal)
    return null;

  if (
    Math.abs(fast - slow) / slow < 0.0025
  ) {
    return null;
  }

  const cur =
    c[
      c.length - 1
    ];

  if (!cur)
    return null;

  const body =
    Math.abs(cur.close - cur.open);

  const range =
    cur.high - cur.low;

  if (!range)
    return null;

  if (body / range < 0.55)
    return null;

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

  const entry =
    (cur.high + cur.low) / 2;

  const sl =
    dir === "CALL"
      ? entry - atrVal
      : entry + atrVal;

  const tp =
    dir === "CALL"
      ? entry + atrVal * 1.8
      : entry - atrVal * 1.8;

  return {
    dir,
    entry,
    sl,
    tp,
  };
}

// ================================
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
    Math.max(
      atr(c),
      MIN_SL
    );

  const cur =
    c[
      c.length - 1
    ];

  if (!cur)
    return null;

  if (cur.high >= high) {

    const entry =
      (cur.high + cur.low) / 2;

    return {

      dir: "PUT",

      entry,

      sl:
        entry + atrVal,

      tp:
        entry - atrVal * 1.5,
    };
  }

  if (cur.low <= low) {

    const entry =
      (cur.high + cur.low) / 2;

    return {

      dir: "CALL",

      entry,

      sl:
        entry - atrVal,

      tp:
        entry + atrVal * 1.5,
    };
  }

  return null;
}

// ================================
function volatileLogic(c) {

  const cur =
    c[
      c.length - 1
    ];

  const prev =
    c[
      c.length - 2
    ];

  const atrVal =
    Math.max(
      atr(c),
      MIN_SL
    );

  if (
    !prev ||
    !cur ||
    !atrVal
  ) {
    return null;
  }

  const body =
    Math.abs(cur.close - cur.open);

  const range =
    cur.high - cur.low;

  if (!range)
    return null;

  if (body / range < 0.6)
    return null;

  if (cur.close > prev.high) {

    const entry =
      (cur.high + cur.low) / 2;

    return {

      dir: "CALL",

      entry,

      sl:
        entry - atrVal,

      tp:
        entry + atrVal * 2,
    };
  }

  if (cur.close < prev.low) {

    const entry =
      (cur.high + cur.low) / 2;

    return {

      dir: "PUT",

      entry,

      sl:
        entry + atrVal,

      tp:
        entry - atrVal * 2,
    };
  }

  return null;
}

// ================================
function generate(c) {

  if (c.length < 80)
    return null;

  const last =
    c[
      c.length - 1
    ];

  if (!last)
    return null;

  if (!isMarketOpen(last.time))
    return null;

  const market =
    detectMarket(c);

  if (market === "CHOPPY")
  return null;

const ao =
  awesomeOscillator(c);

if (
  !ao ||
  ao.length < 3
) {
  return null;
}

const aoNow =
  ao[ao.length - 1];

const aoPrev =
  ao[ao.length - 2];

if (
  Math.abs(aoNow) <
  AO_MIN_THRESHOLD
) {
  return null;
}

const adxVal =
  adx(c);

if (
  adxVal < MIN_ADX
) {
  return null;
}

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

if (
  trade.dir === "CALL"
) {

  if (
    aoNow <= 0 ||
    aoNow <= aoPrev
  ) {
    return null;
  }

} else {

  if (
    aoNow >= 0 ||
    aoNow >= aoPrev
  ) {
    return null;
  }
}

  const rr =

    Math.abs(
      trade.tp - trade.entry
    ) /

    Math.abs(
      trade.entry - trade.sl
    );

  if (
    rr < MIN_RR ||
    rr > 5
  ) {
    return null;
  }

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
