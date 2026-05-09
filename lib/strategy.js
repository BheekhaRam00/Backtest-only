// ================================================
// 🚀 PRO STABLE 1M UNIVERSAL STRATEGY V2
// Designed For:
// - Upstox 1m candles
// - Delayed execution tolerance
// - Stable intraday trend continuation
// - Less fake breakout exits
// - Better profit holding
// ================================================

// ================================================
// ⚠️ CORE DESIGN GOALS
// ================================================
//
// 1. NO ultra-tight SL
// 2. Entry survives 1 candle delay
// 3. Less dependence on exact tick entry
// 4. No repaint
// 5. Stable under websocket/API delay
// 6. Lower fake breakout frequency
// 7. More trend holding capability
//
// ================================================

const TF_LIST = [1];

// ================================================
// TREND
// ================================================

const EMA_FAST = 11;
const EMA_SLOW = 21;

// ================================================
// ATR
// ================================================

const ATR_PERIOD = 14;

const BASE_SL_MULTIPLIER = 1.35;
const STRONG_SL_MULTIPLIER = 1.6;

// ================================================
// RR
// ================================================

const MIN_RR = 1.2;
const MAX_RR = 4.5;

// ================================================
// AO
// ================================================

const AO_FAST = 4;
const AO_SLOW = 34;

// ================================================
// FILTERS
// ================================================

const MIN_BODY_RATIO = 0.55;

const MIN_EMA_SLOPE = 0.15;

const MIN_VOLUME_FACTOR = 1.2;

const MIN_ATR = 8;

// ================================================
// TIME FILTERS
// ================================================

const NO_TRADE_START_1 = 11 * 60 + 25;
const NO_TRADE_END_1 = 13 * 60 + 15;

// ================================================
// 🕒 IST HELPERS
// ================================================

function getISTMinutes(time) {

  const t = new Date(time);

  const utcH = t.getUTCHours();
  const utcM = t.getUTCMinutes();

  return ((utcH * 60 + utcM) + 330) % 1440;
}

// ================================================

function isMarketOpen(time) {

  const total = getISTMinutes(time);

  return (
    total >= (9 * 60 + 15) &&
    total <= (15 * 60 + 20)
  );
}

// ================================================

function isNoTradeZone(time) {

  const total = getISTMinutes(time);

  return (
    total >= NO_TRADE_START_1 &&
    total <= NO_TRADE_END_1
  );
}

// ================================================
// BUILD TF
// ================================================

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

    if (currentKey === null)
      currentKey = key;

    if (key !== currentKey) {

      if (bucket.length) {

        res.push({

          open: bucket[0].open,

          high:
            Math.max(...bucket.map(x => x.high)),

          low:
            Math.min(...bucket.map(x => x.low)),

          close:
            bucket[bucket.length - 1].close,

          volume:
            bucket.reduce((s, x) =>
              s + (x.volume || 0), 0),

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

      open: bucket[0].open,

      high:
        Math.max(...bucket.map(x => x.high)),

      low:
        Math.min(...bucket.map(x => x.low)),

      close:
        bucket[bucket.length - 1].close,

      volume:
        bucket.reduce((s, x) =>
          s + (x.volume || 0), 0),

      time:
        bucket[0].time,
    });
  }

  return res;
}

// ================================================
// EMA
// ================================================

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

// ================================================
// SMA
// ================================================

function sma(values, period) {

  if (values.length < period)
    return [];

  const result = [];

  for (let i = 0; i <= values.length - period; i++) {

    const slice =
      values.slice(i, i + period);

    result.push(
      slice.reduce((a, b) => a + b, 0) / period
    );
  }

  return result;
}

// ================================================
// AO
// ================================================

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

// ================================================
// ATR
// ================================================

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

      Math.abs(cur.high - prev.close),

      Math.abs(cur.low - prev.close)
    );
  }

  return sum / p;
}

// ================================================
// CHOPPY FILTER
// ================================================

function isChoppy(c) {

  const recent =
    c.slice(-8);

  const avgRange =
    recent.reduce(
      (s, x) =>
        s + (x.high - x.low),
      0
    ) / recent.length;

  const atrNow = atr(c);

  if (!atrNow)
    return true;

  return avgRange < atrNow * 0.85;
}

// ================================================
// VOLUME FILTER
// ================================================

function hasStrongVolume(c) {

  if (c.length < 10)
    return false;

  const current =
    c[c.length - 1].volume || 0;

  const recent =
    c.slice(-6, -1);

  const avg =
    recent.reduce(
      (s, x) =>
        s + (x.volume || 0),
      0
    ) / recent.length;

  if (!avg)
    return false;

  return (
    current >=
    avg * MIN_VOLUME_FACTOR
  );
}

// ================================================
// VWAP
// ================================================

function vwap(candles) {

  let pv = 0;
  let vol = 0;

  const arr = [];

  for (const c of candles) {

    const typical =
      (c.high + c.low + c.close) / 3;

    const v =
      c.volume || 1;

    pv += typical * v;
    vol += v;

    arr.push(pv / vol);
  }

  return arr;
}

// ================================================
// MAIN GENERATOR
// ================================================

function generate(c) {

  if (c.length < 100)
    return null;

  const last =
    c[c.length - 1];

  if (!last)
    return null;

  if (!isMarketOpen(last.time))
    return null;

  if (isNoTradeZone(last.time))
    return null;

  if (isChoppy(c))
    return null;

  if (!hasStrongVolume(c))
    return null;

  const emaFast =
    ema(c, EMA_FAST);

  const emaSlow =
    ema(c, EMA_SLOW);

  const vwapArr =
    vwap(c);

  const fast =
    emaFast[emaFast.length - 1];

  const slow =
    emaSlow[emaSlow.length - 1];

  const fastPrev =
    emaFast[emaFast.length - 2];

  const slowPrev =
    emaSlow[emaSlow.length - 2];

  const vwapNow =
    vwapArr[vwapArr.length - 1];

  const fastSlope =
    fast - fastPrev;

  const slowSlope =
    slow - slowPrev;

  const ao =
    awesomeOscillator(c);

  if (!ao || ao.length < 2)
    return null;

  const aoNow =
    ao[ao.length - 1];

  const atrVal =
    Math.max(
      atr(c),
      MIN_ATR
    );

  const cur =
    c[c.length - 1];

  const prev =
    c[c.length - 2];

  const body =
    Math.abs(cur.close - cur.open);

  const range =
    cur.high - cur.low;

  if (!range)
    return null;

  // ================================================
  // BODY FILTER
  // ================================================

  if (
    body / range <
    MIN_BODY_RATIO
  ) {
    return null;
  }

  // ================================================
  // REJECTION WICK FILTER
  // ================================================

  const upperWick =
    cur.high -
    Math.max(cur.open, cur.close);

  const lowerWick =
    Math.min(cur.open, cur.close) -
    cur.low;

  // ================================================
  // TREND CONDITIONS
  // ================================================

  let dir = null;

  // ================================================
  // CALL
  // ================================================

  if (

    fast > slow &&

    fastPrev > slowPrev &&

    fastSlope > MIN_EMA_SLOPE &&

    slowSlope > 0 &&

    aoNow > 0 &&

    cur.close > fast &&

    cur.close > vwapNow &&

    lowerWick < body * 0.6 &&

    cur.close > prev.high

  ) {

    dir = 'CALL';
  }

  // ================================================
  // PUT
  // ================================================

  else if (

    fast < slow &&

    fastPrev < slowPrev &&

    fastSlope < -MIN_EMA_SLOPE &&

    slowSlope < 0 &&

    aoNow < 0 &&

    cur.close < fast &&

    cur.close < vwapNow &&

    upperWick < body * 0.6 &&

    cur.close < prev.low

  ) {

    dir = 'PUT';
  }

  if (!dir)
    return null;

  // ================================================
  // DELAY-TOLERANT ENTRY
  // ================================================

  const entry =

    dir === 'CALL'

      ? cur.high + (atrVal * 0.08)

      : cur.low - (atrVal * 0.08);

  // ================================================
  // DYNAMIC SL
  // ================================================

  const strongBody =
    body / range > 0.8;

  const slMultiplier =

    strongBody

      ? STRONG_SL_MULTIPLIER

      : BASE_SL_MULTIPLIER;

  const sl =

    dir === 'CALL'

      ? entry - atrVal * slMultiplier

      : entry + atrVal * slMultiplier;

  // ================================================
  // TREND HOLD TP
  // ================================================

  const tp =

    dir === 'CALL'

      ? entry + atrVal * 2.4

      : entry - atrVal * 2.4;

  // ================================================
  // RR
  // ================================================

  const rr =

    Math.abs(tp - entry) /

    Math.abs(entry - sl);

  if (
    rr < MIN_RR ||
    rr > MAX_RR
  ) {
    return null;
  }

  // ================================================
  // CONFIDENCE SCORE
  // ================================================

  let confidence = 50;

  if (Math.abs(fastSlope) > 0.3)
    confidence += 10;

  if (Math.abs(slowSlope) > 0.15)
    confidence += 10;

  if (body / range > 0.75)
    confidence += 10;

  if (atrVal > 15)
    confidence += 10;

  if (hasStrongVolume(c))
    confidence += 10;

  // ================================================
  // FINAL
  // ================================================

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

    confidence,

    atr:
      +atrVal.toFixed(2),

    time:
      last.time,

    market: 'TREND_PRO',

    trail: {

      enabled: true,

      activationRR: 1.0,

      type: 'EMA11_DYNAMIC'
    }
  };
}

// ================================================
// MAIN STRATEGY
// ================================================

export function strategy(candles) {

  try {

    if (
      !Array.isArray(candles) ||
      candles.length < 100
    ) {
      return null;
    }

    let best = null;

    for (const tf of TF_LIST) {

      const tfCandles =
        buildTF(candles, tf);

      if (
        !tfCandles ||
        tfCandles.length < 100
      ) {
        continue;
      }

      const t =
        generate(tfCandles);

      if (!t)
        continue;

      if (

        !best ||

        t.confidence >
        best.confidence

      ) {

        best = t;
      }
    }

    return best;

  } catch (err) {

    console.error(
      'STRATEGY_ERROR',
      err
    );

    return null;
  }
}
