// ================================================
// 🚀 UPSTOX DATA LAYER (FINAL)
// ================================================

import axios from "axios";

const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN;

function validateToken() {
  if (!ACCESS_TOKEN) {
    throw new Error("UPSTOX_ACCESS_TOKEN missing");
  }
}

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
    });

    const raw = res.data?.data?.candles || [];

    const candles = raw.map((c) => ({
      time: new Date(c[0]).toISOString(),
      open: +c[1],
      high: +c[2],
      low: +c[3],
      close: +c[4],
      volume: +c[5] || 0,
    }));

    // 🔥 CRITICAL
    candles.sort((a, b) => new Date(a.time) - new Date(b.time));

    return candles;
  } catch (err) {
    console.error("DATA ERROR:", err.message);
    return [];
  }
}
