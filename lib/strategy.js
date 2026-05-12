// ================================================
// 🚀 NIFTY 50 BTST ENGINE (UPGRADED STABLE VERSION)
// ================================================

// --------------------------------
// TIMEFRAME
// --------------------------------
const TF_LIST = [5, 10];

// --------------------------------
// CORE SETTINGS
// --------------------------------
const EMA_FAST = 20;
const ATR_PERIOD = 14;

const MIN_SCORE = 7;

const ENTRY_START = 15 * 60 + 18; // 3:18 PM
const ENTRY_END = 15 * 60 + 28;   // 3:28 PM

// --------------------------------
// SAFE HELPERS
// --------------------------------
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// --------------------------------
// MARKET TIME FILTER
// --------------------------------
function isMarketOpen(time) {
  try {
    const t = new Date(time);

    const hour = t.getHours();
    const min = t.getMinutes();

    const total = hour * 60 + min;

    return total >= (9 * 60 + 15) &&
           total <= (15 * 60 + 30);
  } catch {
    return false;
  }
}

// --------------------------------
// BTST ENTRY WINDOW
// --------------------------------
function isEntryWindow(time) {
  try {
    const t = new Date(time);

    const hour = t.getHours();
    const min = t.getMinutes();

    const total = hour * 60 + min;

    return total >= ENTRY_START &&
           total <= ENTRY_END;
  } catch {
    return false;
  }
}

// --------------------------------
// BUILD TF
// --------------------------------
function buildTF(candles, tf) {
  try {
    if (!Array.isArray(candles)) return [];

    if (tf === 1) return candles;

    const res = [];

    for (let i = 0; i + tf <= candles.length; i += tf) {
      const chunk = candles.slice(i, i + tf);

      if (!chunk.length) continue;

      res.push({
        open: num(chunk[0].open),

        high: Math.max(
          ...chunk.map(x => num(x.high))
        ),

        low: Math.min(
          ...chunk.map(x => num(x.low))
        ),

        close: num(chunk.at(-1).close),

        volume: chunk.reduce(
          (s, x) => s + num(x.volume),
          0
        ),

        time: chunk.at(-1).time,
      });
    }

    return res;
  } catch {
    return [];
  }
}

// --------------------------------
// EMA
// --------------------------------
function ema(c, p) {
  try {
    if (!Array.isArray(c)) return [];

    if (c.length < p) {
      return c.map(() => 0);
    }

    const k = 2 / (p + 1);

    let e =
      c.slice(0, p)
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

// --------------------------------
// ATR
// --------------------------------
function atr(c, p = ATR_PERIOD) {
  try {
    if (!Array.isArray(c)) return 0;

    if (c.length < p + 1) return 0;

    let sum = 0;

    const s = c.slice(-(p + 1));

    for (let i = 1; i < s.length; i++) {
      const cur = s[i];
      const prev = s[i - 1];

      sum += Math.max(
        num(cur.high) - num(cur.low),

        Math.abs(
          num(cur.high) - num(prev.close)
        ),

        Math.abs(
          num(cur.low) - num(prev.close)
        )
      );
    }

    return sum / p;
  } catch {
    return 0;
  }
}

// --------------------------------
// VWAP
// --------------------------------
function vwap(c) {
  try {
    let pv = 0;
    let vol = 0;

    for (const x of c) {
      const h = num(x.high);
      const l = num(x.low);
      const cl = num(x.close);
      const v = num(x.volume || 1);

      const typical =
        (h + l + cl) / 3;

      pv += typical * v;
      vol += v;
    }

    if (!vol) return 0;

    return pv / vol;
  } catch {
    return 0;
  }
}

// --------------------------------
// DAY HIGH
// --------------------------------
function dayHigh(c) {
  try {
    return Math.max(
      ...c.map(x => num(x.high))
    );
  } catch {
    return 0;
  }
}

// --------------------------------
// DAY LOW
// --------------------------------
function dayLow(c) {
  try {
    return Math.min(
      ...c.map(x => num(x.low))
    );
  } catch {
    return 0;
  }
}

// --------------------------------
// CLOSE POSITION SCORE
// --------------------------------
function cps(c) {
  try {
    const high = dayHigh(c);
    const low = dayLow(c);

    const close = num(c.at(-1)?.close);

    const range = high - low;

    if (!range) return 50;

    return (
      ((close - low) / range) * 100
    );
  } catch {
    return 50;
  }
}

// --------------------------------
// EMA SLOPE
// --------------------------------
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

// --------------------------------
// LAST HOUR MOMENTUM
// --------------------------------
function lastHourMomentum(c) {
  try {
    const look = c.slice(-12);

    if (look.length < 12) {
      return 0;
    }

    const first = num(look[0].close);
    const last = num(look.at(-1).close);

    return (
      (last - first) / first
    );
  } catch {
    return 0;
  }
}

// --------------------------------
// RANGE EXPANSION
// --------------------------------
function rangeExpansion(c) {
  try {
    const atrNow = atr(c);

    const prev = atr(c.slice(0, -5));

    if (!prev) return 1;

    return atrNow / prev;
  } catch {
    return 1;
  }
}

// --------------------------------
// FLAT MARKET FILTER
// --------------------------------
function isFlatDay(c) {
  try {
    const high = dayHigh(c);
    const low = dayLow(c);

    const range = high - low;

    const atrVal = atr(c);

    const cp = cps(c);

    const slope = Math.abs(
      emaSlope(c)
    );

    const momentum = Math.abs(
      lastHourMomentum(c)
    );

    if (range < atrVal * 0.8) {
      return true;
    }

    if (cp > 40 && cp < 60) {
      return true;
    }

    if (slope < 0.0007) {
      return true;
    }

    if (momentum < 0.0015) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

// --------------------------------
// BULLISH SCORE
// --------------------------------
function bullishScore(c) {
  try {
    let score = 0;

    const close = num(c.at(-1).close);

    const vw = vwap(c);

    const cp = cps(c);

    const slope = emaSlope(c);

    const momentum =
      lastHourMomentum(c);

    const expansion =
      rangeExpansion(c);

    const high = dayHigh(c);

    // CLOSE NEAR HIGH
    if (cp > 80) score += 2;

    // ABOVE VWAP
    if (close > vw) score += 2;

    // EMA SLOPE
    if (slope > 0.0012) score += 1;

    // LAST HOUR STRENGTH
    if (momentum > 0.003) score += 2;

    // ATR EXPANSION
    if (expansion > 1.1) score += 1;

    // BREAKOUT CLOSE
    if (close >= high * 0.9985) {
      score += 2;
    }

    return score;
  } catch {
    return 0;
  }
}

// --------------------------------
// BEARISH SCORE
// --------------------------------
function bearishScore(c) {
  try {
    let score = 0;

    const close = num(c.at(-1).close);

    const vw = vwap(c);

    const cp = cps(c);

    const slope = emaSlope(c);

    const momentum =
      lastHourMomentum(c);

    const expansion =
      rangeExpansion(c);

    const low = dayLow(c);

    // CLOSE NEAR LOW
    if (cp < 20) score += 2;

    // BELOW VWAP
    if (close < vw) score += 2;

    // EMA SLOPE
    if (slope < -0.0012) score += 1;

    // LAST HOUR WEAKNESS
    if (momentum < -0.003) {
      score += 2;
    }

    // ATR EXPANSION
    if (expansion > 1.1) score += 1;

    // BREAKDOWN CLOSE
    if (close <= low * 1.0015) {
      score += 2;
    }

    return score;
  } catch {
    return 0;
  }
}

// --------------------------------
// SIGNAL ENGINE
// --------------------------------
function btstSignal(c) {
  try {
    if (!Array.isArray(c)) return null;

    if (c.length < 50) return null;

    const last = c.at(-1);

    if (!last?.time) return null;

    // MARKET HOURS
    if (!isMarketOpen(last.time)) {
      return null;
    }

    // ONLY ENTRY WINDOW
    if (!isEntryWindow(last.time)) {
      return null;
    }

    // FLAT DAY SKIP
    if (isFlatDay(c)) {
      return null;
    }

    const bull =
      bullishScore(c);

    const bear =
      bearishScore(c);

    const close =
      num(last.close);

    const atrVal =
      atr(c);

    if (!atrVal) return null;

    // --------------------------------
    // CALL BTST
    // --------------------------------
    if (
      bull >= MIN_SCORE &&
      bull > bear
    ) {
      return {
        dir: "CALL",

        entry: +close.toFixed(2),

        sl: +(
          close - atrVal * 0.8
        ).toFixed(2),

        target: "NEXT_DAY_OPEN",

        score: bull,

        rr: 0,

        market: "BTST_BULLISH",

        cps: +cps(c).toFixed(2),

        vwap: +vwap(c).toFixed(2),

        time: last.time,
      };
    }

    // --------------------------------
    // PUT BTST
    // --------------------------------
    if (
      bear >= MIN_SCORE &&
      bear > bull
    ) {
      return {
        dir: "PUT",

        entry: +close.toFixed(2),

        sl: +(
          close + atrVal * 0.8
        ).toFixed(2),

        target: "NEXT_DAY_OPEN",

        score: bear,

        rr: 0,

        market: "BTST_BEARISH",

        cps: +cps(c).toFixed(2),

        vwap: +vwap(c).toFixed(2),

        time: last.time,
      };
    }

    return null;
  } catch (err) {
    console.error(
      "BTST SIGNAL ERROR:",
      err
    );

    return null;
  }
}

// --------------------------------
// MAIN STRATEGY
// --------------------------------
export function strategy(candles) {
  try {
    if (!Array.isArray(candles)) {
      return null;
    }

    let best = null;

    for (const tf of TF_LIST) {
      const tfCandles =
        buildTF(candles, tf);

      if (
        !Array.isArray(tfCandles) ||
        tfCandles.length < 50
      ) {
        continue;
      }

      const trade =
        btstSignal(tfCandles);

      if (!trade) continue;

      if (
        !best ||
        trade.score > best.score
      ) {
        best = trade;
      }
    }

    return best;
  } catch (err) {
    console.error(
      "STRATEGY ENGINE ERROR:",
      err
    );

    return null;
  }
}
