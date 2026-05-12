// ================================================
// 🚀 NIFTY BTST ENGINE V2 (RELAXED + DEBUGGED)
// ================================================

// ================================================
// IMPORTANT
// ================================================
// ✅ USE ONLY ORIGINAL 1 MINUTE UPSTOX DATA
// ✅ NO TF CONVERSION
// ✅ MORE TRADES
// ✅ LESS STRICT
// ✅ STABLE
// ✅ NO CRASH
// ================================================

// --------------------------------
// SETTINGS
// --------------------------------
const EMA_FAST = 20;
const ATR_PERIOD = 14;

// 🔥 RELAXED SCORE
const MIN_SCORE = 5;

// --------------------------------
// ENTRY WINDOW
// --------------------------------
const ENTRY_START = 15 * 60 + 10; // 3:10
const ENTRY_END   = 15 * 60 + 29; // 3:29

// ================================================
// SAFE NUMBER
// ================================================
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ================================================
// MARKET HOURS
// ================================================
function isMarketOpen(time) {
  try {
    const t = new Date(time);

    const total =
      t.getHours() * 60 +
      t.getMinutes();

    return (
      total >= (9 * 60 + 15) &&
      total <= (15 * 60 + 30)
    );
  } catch {
    return false;
  }
}

// ================================================
// ENTRY WINDOW
// ================================================
function isEntryWindow(time) {
  try {
    const t = new Date(time);

    const total =
      t.getHours() * 60 +
      t.getMinutes();

    return (
      total >= ENTRY_START &&
      total <= ENTRY_END
    );
  } catch {
    return false;
  }
}

// ================================================
// EMA
// ================================================
function ema(c, p) {
  try {
    if (!Array.isArray(c)) return [];

    if (c.length < p) {
      return c.map(() => 0);
    }

    const k = 2 / (p + 1);

    let e =
      c
        .slice(0, p)
        .reduce((s, x) => s + num(x.close), 0) / p;

    const arr = Array(p).fill(e);

    for (let i = p; i < c.length; i++) {
      e =
        num(c[i].close) * k +
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
function atr(c, p = ATR_PERIOD) {
  try {
    if (c.length < p + 1) return 0;

    let sum = 0;

    const s = c.slice(-(p + 1));

    for (let i = 1; i < s.length; i++) {
      const cur = s[i];
      const prev = s[i - 1];

      sum += Math.max(
        num(cur.high) - num(cur.low),

        Math.abs(
          num(cur.high) -
          num(prev.close)
        ),

        Math.abs(
          num(cur.low) -
          num(prev.close)
        )
      );
    }

    return sum / p;
  } catch {
    return 0;
  }
}

// ================================================
// VWAP
// ================================================
function vwap(c) {
  try {
    let pv = 0;
    let vol = 0;

    for (const x of c) {
      const h = num(x.high);
      const l = num(x.low);
      const cl = num(x.close);

      const v = num(x.volume || 1);

      const tp = (h + l + cl) / 3;

      pv += tp * v;
      vol += v;
    }

    if (!vol) return 0;

    return pv / vol;
  } catch {
    return 0;
  }
}

// ================================================
// DAY HIGH LOW
// ================================================
function dayHigh(c) {
  return Math.max(
    ...c.map(x => num(x.high))
  );
}

function dayLow(c) {
  return Math.min(
    ...c.map(x => num(x.low))
  );
}

// ================================================
// CLOSE POSITION SCORE
// ================================================
function cps(c) {
  try {
    const high = dayHigh(c);
    const low = dayLow(c);

    const close =
      num(c.at(-1)?.close);

    const range = high - low;

    if (!range) return 50;

    return (
      ((close - low) / range) * 100
    );
  } catch {
    return 50;
  }
}

// ================================================
// EMA SLOPE
// ================================================
function emaSlope(c) {
  try {
    const e = ema(c, EMA_FAST);

    if (e.length < 5) return 0;

    return (
      (e.at(-1) - e.at(-5)) /
      e.at(-5)
    );
  } catch {
    return 0;
  }
}

// ================================================
// MOMENTUM
// ================================================
function momentum(c) {
  try {
    const look = c.slice(-30);

    if (look.length < 30) return 0;

    const first =
      num(look[0].close);

    const last =
      num(look.at(-1).close);

    return (
      (last - first) / first
    );
  } catch {
    return 0;
  }
}

// ================================================
// FLAT DAY FILTER
// ================================================
function isFlatDay(c) {
  try {
    const high = dayHigh(c);
    const low = dayLow(c);

    const range = high - low;

    const atrVal = atr(c);

    // 🔥 RELAXED
    if (range < atrVal * 0.45) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ================================================
// BULLISH SCORE
// ================================================
function bullishScore(c) {
  try {
    let score = 0;

    const close =
      num(c.at(-1).close);

    const vw = vwap(c);

    const cp = cps(c);

    const slope =
      emaSlope(c);

    const mom =
      momentum(c);

    // --------------------------------
    // CLOSE POSITION
    // --------------------------------
    if (cp > 70) score += 2;

    // --------------------------------
    // VWAP
    // --------------------------------
    if (close > vw) score += 2;

    // --------------------------------
    // EMA
    // --------------------------------
    if (slope > 0.0005) {
      score += 1;
    }

    // --------------------------------
    // MOMENTUM
    // --------------------------------
    if (mom > 0.0015) {
      score += 2;
    }

    return score;
  } catch {
    return 0;
  }
}

// ================================================
// BEARISH SCORE
// ================================================
function bearishScore(c) {
  try {
    let score = 0;

    const close =
      num(c.at(-1).close);

    const vw = vwap(c);

    const cp = cps(c);

    const slope =
      emaSlope(c);

    const mom =
      momentum(c);

    // --------------------------------
    // CLOSE POSITION
    // --------------------------------
    if (cp < 30) score += 2;

    // --------------------------------
    // VWAP
    // --------------------------------
    if (close < vw) score += 2;

    // --------------------------------
    // EMA
    // --------------------------------
    if (slope < -0.0005) {
      score += 1;
    }

    // --------------------------------
    // MOMENTUM
    // --------------------------------
    if (mom < -0.0015) {
      score += 2;
    }

    return score;
  } catch {
    return 0;
  }
}

// ================================================
// MAIN SIGNAL ENGINE
// ================================================
function generateSignal(c) {
  try {

    // --------------------------------
    // SAFETY
    // --------------------------------
    if (!Array.isArray(c)) {
      return null;
    }

    if (c.length < 100) {
      return null;
    }

    const last = c.at(-1);

    if (!last?.time) {
      return null;
    }

    // --------------------------------
    // MARKET TIME
    // --------------------------------
    if (!isMarketOpen(last.time)) {
      return null;
    }

    // --------------------------------
    // ENTRY WINDOW
    // --------------------------------
    if (!isEntryWindow(last.time)) {
      return null;
    }

    // --------------------------------
    // FLAT FILTER
    // --------------------------------
    if (isFlatDay(c)) {
      return null;
    }

    // --------------------------------
    // SCORES
    // --------------------------------
    const bull =
      bullishScore(c);

    const bear =
      bearishScore(c);

    const close =
      num(last.close);

    const atrVal =
      atr(c);

    // --------------------------------
    // SAFETY
    // --------------------------------
    if (!atrVal) {
      return null;
    }

    // ============================================
    // CALL SIGNAL
    // ============================================
    if (
      bull >= MIN_SCORE &&
      bull > bear
    ) {

      return {
        dir: "CALL",

        entry:
          +close.toFixed(2),

        sl:
          +(close - atrVal)
            .toFixed(2),

        target:
          "NEXT_DAY_OPEN",

        score: bull,

        market:
          "BTST_BULLISH",

        cps:
          +cps(c).toFixed(2),

        vwap:
          +vwap(c).toFixed(2),

        atr:
          +atrVal.toFixed(2),

        time:
          last.time,
      };
    }

    // ============================================
    // PUT SIGNAL
    // ============================================
    if (
      bear >= MIN_SCORE &&
      bear > bull
    ) {

      return {
        dir: "PUT",

        entry:
          +close.toFixed(2),

        sl:
          +(close + atrVal)
            .toFixed(2),

        target:
          "NEXT_DAY_OPEN",

        score: bear,

        market:
          "BTST_BEARISH",

        cps:
          +cps(c).toFixed(2),

        vwap:
          +vwap(c).toFixed(2),

        atr:
          +atrVal.toFixed(2),

        time:
          last.time,
      };
    }

    return null;

  } catch (err) {

    console.error(
      "BTST ENGINE ERROR:",
      err
    );

    return null;
  }
}

// ================================================
// EXPORT STRATEGY
// ================================================
export function strategy(candles) {
  try {

    if (!Array.isArray(candles)) {
      return null;
    }

    // 🔥 ONLY ORIGINAL 1 MIN DATA
    return generateSignal(candles);

  } catch (err) {

    console.error(
      "STRATEGY ERROR:",
      err
    );

    return null;
  }
}
