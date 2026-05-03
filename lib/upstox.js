// ================================================
// 🚀 UPSTOX DATA LAYER (BACKTEST ONLY - CLEAN)
// ================================================

import axios from "axios";

// ================================
// 🔑 ENV CONFIG
// ================================
const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN;

// ================================
// 🔥 VALIDATION
// ================================
function validateToken() {
  if (!ACCESS_TOKEN) {
    throw new Error("🚨 UPSTOX_ACCESS_TOKEN NOT FOUND (ENV ISSUE)");
  }
}

// ================================
// 🔁 FETCH HISTORICAL CANDLES
// ================================
export async function getMarketData(symbol, { days = 10 } = {}) {
  try {
    validateToken();

    const end = new Date();
    const start = new Date();

    start.setDate(end.getDate() - days);

    const from = start.toISOString().split("T")[0];
    const to = end.toISOString().split("T")[0];

    const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(
      symbol
    )}/1minute/${to}/${from}`;

    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        Accept: "application/json",
      },
      timeout: 10000,
    });

    const raw = res.data?.data?.candles;

    if (!raw || !Array.isArray(raw)) {
      console.warn("⚠️ No candle data received");
      return [];
    }

    // ================================
    // 🔄 FORMAT CANDLES
    // ================================
    const candles = raw.map((c) => ({
      time: new Date(c[0]).toISOString(),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5] || 0),
    }));

    // ================================
    // 🔥 SORT ASC (CRITICAL)
    // ================================
    candles.sort(
      (a, b) => new Date(a.time) - new Date(b.time)
    );

    console.log(`📊 Fetched ${candles.length} candles`);

    return candles;

  } catch (err) {
    console.error("❌ MARKET DATA ERROR:", err.message);
    return [];
  }
}
