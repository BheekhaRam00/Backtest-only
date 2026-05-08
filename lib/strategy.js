// ================================================
// 🚀 STABLE 1M UNIVERSAL STRATEGY
// ================================================

const TF_LIST = [1];

const EMA_FAST = 9;
const EMA_SLOW = 21;

const ATR_PERIOD = 14;

const MIN_RR = 1.5;
const MIN_SL = 9;

const AO_FAST = 5;
const AO_SLOW = 34;

// ================================================
// 🕒 IST TIME HELPER
// ================================================
function getISTMinutes(time) {

  const t = new Date(time);

  const utcH = t.getUTCHours();
  const utcM = t.getUTCMinutes();

  const istTotal =
    (utcH * 60 + utcM) + 330;

  return istTotal % 1440;
}

// ================================================
function isMarketOpen(time) {

  const total =
    getISTMinutes(time);

  return (
    total >= (9 * 60 + 15) &&
    total <= (15 * 60 + 20)
  );
}

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

      time:
        bucket[0].time,
    });
  }

  return res;
}

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
function isChoppy(c) {

  const recent =
    c.slice(-6);

  const avgRange =
    recent.reduce(
      (s, x) => s + (x.high - x.low),
      0
    ) / recent.length;

  const atrNow = atr(c);

  if (!atrNow)
    return true;

  return avgRange < atrNow * 0.7;
}

// ================================================
function generate(c) {

  if (c.length < 80)
    return null;

  const last =
    c[c.length - 1];

  if (!last)
    return null;

  if (!isMarketOpen(last.time))
    return null;

  if (isChoppy(c))
    return null;

  const emaFast =
    ema(c, EMA_FAST);

  const emaSlow =
    ema(c, EMA_SLOW);

  const fast =
    emaFast[emaFast.length - 1];

  const slow =
    emaSlow[emaSlow.length - 1];

  const fastPrev =
    emaFast[emaFast.length - 2];

  const slowPrev =
    emaSlow[emaSlow.length - 2];

  const ao =
    awesomeOscillator(c);

  if (!ao || ao.length < 2)
    return null;

  const aoNow =
    ao[ao.length - 1];

  const atrVal =
    Math.max(
      atr(c),
      MIN_SL
    );

  const cur =
    c[c.length - 1];

  const body =
    Math.abs(cur.close - cur.open);

  const range =
    cur.high - cur.low;

  if (!range)
    return null;

  if (body / range < 0.80)
    return null;

  let dir = null;

  // ================================================
  // TREND FOLLOWING
  // ================================================

  if (
    fast > slow &&
    fastPrev > slowPrev &&
    aoNow > 0 &&
    cur.close > fast
  ) {
    dir = 'CALL';
  }

  else if (
    fast < slow &&
    fastPrev < slowPrev &&
    aoNow < 0 &&
    cur.close < fast
  ) {
    dir = 'PUT';
  }

  if (!dir)
    return null;

  const entry =
    (cur.high + cur.low) / 2;

  const sl =
    dir === 'CALL'
      ? entry - atrVal
      : entry + atrVal;

  const tp =
    dir === 'CALL'
      ? entry + atrVal * 2.1
      : entry - atrVal * 2.1;

  const rr =

    Math.abs(tp - entry) /

    Math.abs(entry - sl);

  if (
    rr < MIN_RR ||
    rr > 5
  ) {
    return null;
  }

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

    market: 'TREND',
  };
}

// ================================================
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
