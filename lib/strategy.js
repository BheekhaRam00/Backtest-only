// ================================================
// 🚀 PRO PULLBACK CONTINUATION STRATEGY V4
// ================================================
//
// DESIGN GOALS
// --------------------------------
// ✅ Upstox 1m compatible
// ✅ Delay tolerant
// ✅ Stable live execution
// ✅ Pullback continuation entries
// ✅ Better profit holding
// ✅ Lower fake breakout entries
// ✅ Crash safe
// ✅ No repaint
// ✅ More robust than EMA crossover
//
// ================================================

const TF_LIST = [1];

// ================================================
// EMA
// ================================================

const EMA_FAST = 11;
const EMA_SLOW = 21;

// ================================================
// ATR
// ================================================

const ATR_PERIOD = 14;

const SL_MULTIPLIER = 1.25;
const TP_MULTIPLIER = 2.4;

// ================================================
// FILTERS
// ================================================

const MIN_BODY_RATIO = 0.35;

const MIN_ATR = 8;

const MIN_VOLUME_FACTOR = 0.90;

const PULLBACK_DISTANCE = 0.45;

// ================================================
// TIME FILTER
// ================================================

const MARKET_START = 9 * 60 + 15;
const MARKET_END = 15 * 60 + 20;

// ================================================
// SAFE NUMBER
// ================================================

function safeNum(v) {

  return Number.isFinite(v)
    ? v
    : 0;
}

// ================================================
// IST TIME
// ================================================

function getISTMinutes(time) {

  try {

    const t = new Date(time);

    const utcH = t.getUTCHours();
    const utcM = t.getUTCMinutes();

    return ((utcH * 60 + utcM) + 330) % 1440;

  } catch {

    return 0;
  }
}

// ================================================
// MARKET OPEN
// ================================================

function isMarketOpen(time) {

  try {

    const total =
      getISTMinutes(time);

    return (
      total >= MARKET_START &&
      total <= MARKET_END
    );

  } catch {

    return false;
  }
}

// ================================================
// BUILD TF
// ================================================

function buildTF(candles, tf) {

  try {

    if (!Array.isArray(candles))
      return [];

    if (tf === 1)
      return candles;

    const result = [];

    let bucket = [];
    let currentKey = null;

    for (const candle of candles) {

      if (!candle)
        continue;

      const t =
        new Date(candle.time);

      const totalMinutes =
        t.getUTCHours() * 60 +
        t.getUTCMinutes();

      const key =
        Math.floor(totalMinutes / tf);

      if (currentKey === null)
        currentKey = key;

      if (key !== currentKey) {

        if (bucket.length) {

          result.push({

            open:
              bucket[0].open,

            high:
              Math.max(...bucket.map(x => x.high)),

            low:
              Math.min(...bucket.map(x => x.low)),

            close:
              bucket[bucket.length - 1].close,

            volume:
              bucket.reduce(
                (s, x) =>
                  s + safeNum(x.volume),
                0
              ),

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

      result.push({

        open:
          bucket[0].open,

        high:
          Math.max(...bucket.map(x => x.high)),

        low:
          Math.min(...bucket.map(x => x.low)),

        close:
          bucket[bucket.length - 1].close,

        volume:
          bucket.reduce(
            (s, x) =>
              s + safeNum(x.volume),
            0
          ),

        time:
          bucket[0].time,
      });
    }

    return result;

  } catch {

    return [];
  }
}

// ================================================
// EMA
// ================================================

function ema(candles, period) {

  try {

    if (!Array.isArray(candles))
      return [];

    if (candles.length < period)
      return candles.map(() => 0);

    const k =
      2 / (period + 1);

    let e =
      candles
        .slice(0, period)
        .reduce(
          (s, x) =>
            s + safeNum(x.close),
          0
        ) / period;

    const arr =
      Array(period).fill(e);

    for (let i = period; i < candles.length; i++) {

      e =
        safeNum(candles[i].close) * k +
        e * (1 - k);

      arr.push(e);
    }

    return arr;

  } catch {

    return [];
  }
}

// ================================================
// ATR
// ================================================

function atr(candles, period = ATR_PERIOD) {

  try {

    if (candles.length < period + 1)
      return 0;

    const slice =
      candles.slice(-(period + 1));

    let sum = 0;

    for (let i = 1; i < slice.length; i++) {

      const cur = slice[i];
      const prev = slice[i - 1];

      sum += Math.max(

        cur.high - cur.low,

        Math.abs(cur.high - prev.close),

        Math.abs(cur.low - prev.close)
      );
    }

    return sum / period;

  } catch {

    return 0;
  }
}

// ================================================
// VWAP
// ================================================

function vwap(candles) {

  try {

    let pv = 0;
    let vol = 0;

    const arr = [];

    for (const c of candles) {

      const typical =
        (
          safeNum(c.high) +
          safeNum(c.low) +
          safeNum(c.close)
        ) / 3;

      const v =
        safeNum(c.volume) || 1;

      pv += typical * v;
      vol += v;

      arr.push(pv / vol);
    }

    return arr;

  } catch {

    return [];
  }
}

// ================================================
// CHOPPY FILTER
// ================================================

function isChoppy(candles) {

  try {

    const recent =
      candles.slice(-8);

    if (!recent.length)
      return true;

    const avgRange =
      recent.reduce(
        (s, x) =>
          s + (x.high - x.low),
        0
      ) / recent.length;

    const atrNow =
      atr(candles);

    if (!atrNow)
      return true;

    return avgRange < atrNow * 0.55;

  } catch {

    return true;
  }
}

// ================================================
// VOLUME FILTER
// ================================================

function hasVolume(candles) {

  try {

    if (candles.length < 10)
      return true;

    const current =
      safeNum(
        candles[candles.length - 1].volume
      );

    const recent =
      candles.slice(-6, -1);

    const avg =
      recent.reduce(
        (s, x) =>
          s + safeNum(x.volume),
        0
      ) / recent.length;

    if (!avg)
      return true;

    return (
      current >=
      avg * MIN_VOLUME_FACTOR
    );

  } catch {

    return true;
  }
}

// ================================================
// MAIN GENERATOR
// ================================================

function generate(candles) {

  try {

    if (!Array.isArray(candles))
      return null;

    if (candles.length < 100)
      return null;

    const cur =
      candles[candles.length - 1];

    const prev =
      candles[candles.length - 2];

    if (!cur || !prev)
      return null;

    if (!isMarketOpen(cur.time))
      return null;

    if (isChoppy(candles))
      return null;

    if (!hasVolume(candles))
      return null;

    // ============================================
    // EMA
    // ============================================

    const emaFast =
      ema(candles, EMA_FAST);

    const emaSlow =
      ema(candles, EMA_SLOW);

    if (
      emaFast.length < 2 ||
      emaSlow.length < 2
    ) {
      return null;
    }

    const fast =
      emaFast[emaFast.length - 1];

    const slow =
      emaSlow[emaSlow.length - 1];

    const fastPrev =
      emaFast[emaFast.length - 2];

    const slowPrev =
      emaSlow[emaSlow.length - 2];

    const fastSlope =
      fast - fastPrev;

    const slowSlope =
      slow - slowPrev;

    // ============================================
    // VWAP
    // ============================================

    const vwapArr =
      vwap(candles);

    if (!vwapArr.length)
      return null;

    const vwapNow =
      vwapArr[vwapArr.length - 1];

    // ============================================
    // ATR
    // ============================================

    const atrVal =
      Math.max(
        atr(candles),
        MIN_ATR
      );

    // ============================================
    // CANDLE STRUCTURE
    // ============================================

    const body =
      Math.abs(
        cur.close - cur.open
      );

    const range =
      cur.high - cur.low;

    if (!range)
      return null;

    const bodyRatio =
      body / range;

    if (
      bodyRatio <
      MIN_BODY_RATIO
    ) {
      return null;
    }

    // ============================================
    // PULLBACK DISTANCE
    // ============================================

    const pullbackDistance =
      Math.abs(
        cur.low - fast
      );

    const pullbackDistancePut =
      Math.abs(
        cur.high - fast
      );

    // ============================================
    // WICKS
    // ============================================

    const upperWick =
      cur.high -
      Math.max(cur.open, cur.close);

    const lowerWick =
      Math.min(cur.open, cur.close) -
      cur.low;

    // ============================================
    // DIRECTION
    // ============================================

    let dir = null;

    // ============================================
    // CALL SETUP
    // ============================================

    if (

      fast > slow &&

      fastSlope > 0 &&

      slowSlope >= 0 &&

      cur.close > vwapNow &&

      cur.close > fast &&

      pullbackDistance <= atrVal * PULLBACK_DISTANCE &&

      lowerWick <= range * 0.45 &&

      cur.close > prev.close

    ) {

      dir = 'CALL';
    }

    // ============================================
    // PUT SETUP
    // ============================================

    else if (

      fast < slow &&

      fastSlope < 0 &&

      slowSlope <= 0 &&

      cur.close < vwapNow &&

      cur.close < fast &&

      pullbackDistancePut <= atrVal * PULLBACK_DISTANCE &&

      upperWick <= range * 0.45 &&

      cur.close < prev.close

    ) {

      dir = 'PUT';
    }

    if (!dir)
      return null;

    // ============================================
    // ENTRY
    // ============================================

    const entry =
      +cur.close.toFixed(2);

    // ============================================
    // STOP LOSS
    // ============================================

    const sl =

      dir === 'CALL'

        ? entry - atrVal * SL_MULTIPLIER

        : entry + atrVal * SL_MULTIPLIER;

    // ============================================
    // TAKE PROFIT
    // ============================================

    const tp =

      dir === 'CALL'

        ? entry + atrVal * TP_MULTIPLIER

        : entry - atrVal * TP_MULTIPLIER;

    // ============================================
    // RR
    // ============================================

    const rr =

      Math.abs(tp - entry) /

      Math.abs(entry - sl);

    if (
      rr < 1.4 ||
      rr > 5
    ) {
      return null;
    }

    // ============================================
    // CONFIDENCE
    // ============================================

    let confidence = 50;

    if (Math.abs(fastSlope) > 0.12)
      confidence += 10;

    if (bodyRatio > 0.60)
      confidence += 10;

    if (atrVal > 12)
      confidence += 10;

    if (hasVolume(candles))
      confidence += 10;

    // ============================================
    // FINAL
    // ============================================

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
        cur.time,

      market:
        'PULLBACK_PRO_V4',

      trail: {

        enabled: true,

        activationRR: 1.0,

        type: 'EMA11_PULLBACK_TRAIL'
      }
    };

  } catch (err) {

    console.error(
      'GENERATE_ERROR',
      err
    );

    return null;
  }
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

      try {

        const tfCandles =
          buildTF(candles, tf);

        if (
          !tfCandles ||
          tfCandles.length < 100
        ) {
          continue;
        }

        const trade =
          generate(tfCandles);

        if (!trade)
          continue;

        if (
          !best ||
          trade.confidence >
          best.confidence
        ) {

          best = trade;
        }

      } catch (innerErr) {

        console.error(
          'TF_ERROR',
          innerErr
        );
      }
    }

    return best;

  } catch (err) {

    console.error(
      'STRATEGY_FATAL_ERROR',
      err
    );

    return null;
  }
  }
