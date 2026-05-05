// ================================================
// 🕒 UNIVERSAL TIME FILTER (IST)
// ================================================

function getISTMinutes(time) {
  const d = new Date(time);

  const ist = new Date(
    d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  return ist.getHours() * 60 + ist.getMinutes();
}

// ================================================
// 🚀 WRAP STRATEGY (NON-INTRUSIVE)
// ================================================
export function withTimeFilter(baseStrategy) {

  return function (candles) {

    if (!candles || candles.length === 0) {
      return baseStrategy(candles);
    }

    const last = candles[candles.length - 1];
    const minutes = getISTMinutes(last.time);

    const ENTRY_CUTOFF = 15 * 60 + 20; // 3:20
    const EXIT_CUTOFF  = 15 * 60 + 26; // 3:26

    // 🚨 FORCE EXIT
    if (minutes >= EXIT_CUTOFF) {
      return {
        action: "EXIT_ALL",
        time: last.time
      };
    }

    // 🚫 BLOCK ENTRY
    if (minutes >= ENTRY_CUTOFF) {
      return null;
    }

    // ✅ NORMAL FLOW
    return baseStrategy(candles);
  };
}
