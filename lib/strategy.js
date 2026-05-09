// ================================================
// 🚀 PRICE ACTION PRO STRATEGY FINAL
// ================================================
//
// STYLE:
// - Price Action Based
// - Trend Continuation
// - Low Trade Count
// - High Quality Entries
// - Delay Tolerant
// - Crash Safe
// - Upstox 1m Compatible
//
// ================================================

const TF_LIST = [1];

// ================================================
// EMA
// ================================================

const EMA_FAST = 20;

// ================================================
// ATR
// ================================================

const ATR_PERIOD = 14;

const SL_MULTIPLIER = 1.25;
const TP_MULTIPLIER = 2.5;

const MIN_ATR = 10;

// ================================================
// FILTERS
// ================================================

const MIN_BODY_RATIO = 0.60;

// ================================================
// MARKET TIME
// ================================================

const MARKET_START = 9 * 60 + 20;
const MARKET_END = 15 * 60 + 10;

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
// MARKET TIME
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
// 🚫 NO TRADE ZONE
// ================================================

function isNoTradeZone(time) {

  try {

    const total =
      getISTMinutes(time);

    return (
      total >= (12 * 60) &&
      total < (13 * 60 + 30)
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

    return candles;

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
// CHOP FILTER
// ================================================

function isChoppy(candles) {

  try {

    const recent =
      candles.slice(-6);

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

    return avgRange < atrNow * 0.65;

  } catch {

    return true;
  }
}

// ================================================
// PRICE ACTION ENTRY ENGINE
// ================================================

function generate(candles) {

  try {

    if (!Array.isArray(candles))
      return null;

    if (candles.length < 60)
      return null;

    const cur =
      candles[candles.length - 1];

    const prev =
      candles[candles.length - 2];

    const prev2 =
      candles[candles.length - 3];

    if (!cur || !prev || !prev2)
      return null;

    if (!isMarketOpen(cur.time))
      return null;

    if (isNoTradeZone(cur.time))
      return null;

    if (isChoppy(candles))
      return null;

    // ============================================
    // EMA
    // ============================================

    const emaFast =
      ema(candles, EMA_FAST);

    if (emaFast.length < 2)
      return null;

    const emaNow =
      emaFast[emaFast.length - 1];

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
    // BODY
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
    // TREND STRUCTURE
    // ============================================

    const bullishStructure =

      cur.high > prev.high &&

      prev.high > prev2.high &&

      cur.low > prev.low;

    const bearishStructure =

      cur.low < prev.low &&

      prev.low < prev2.low &&

      cur.high < prev.high;

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
    // CALL
    // ============================================

    if (

      bullishStructure &&

      cur.close > emaNow &&

      cur.close > vwapNow &&

      lowerWick < body * 0.4 &&

      cur.close > prev.close

    ) {

      dir = 'CALL';
    }

    // ============================================
    // PUT
    // ============================================

    else if (

      bearishStructure &&

      cur.close < emaNow &&

      cur.close < vwapNow &&

      upperWick < body * 0.4 &&

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
    // SL
    // ============================================

    const sl =

      dir === 'CALL'

        ? entry - atrVal * SL_MULTIPLIER

        : entry + atrVal * SL_MULTIPLIER;

    // ============================================
    // TP
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
      rr < 1.5 ||
      rr > 5
    ) {
      return null;
    }

    // ============================================
    // CONFIDENCE
    // ============================================

    let confidence = 50;

    if (bodyRatio > 0.75)
      confidence += 10;

    if (atrVal > 15)
      confidence += 10;

    if (Math.abs(cur.close - emaNow) > 5)
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
        'PRICE_ACTION_PRO'
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
      candles.length < 60
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
          tfCandles.length < 60
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
