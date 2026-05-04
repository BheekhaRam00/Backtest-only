import { getMarketData } from "../lib/upstox.js";
import { runBacktest } from "../lib/backtest.js";
import { strategy } from "../lib/strategy.js";

export default async function handler(req, res) {

  // ✅ CORS (VERY IMPORTANT)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Preflight (mobile browsers / vercel edge case)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const days = Number(req.query?.days ?? 10);

    const candles = await getMarketData("NSE_INDEX|Nifty 50", { days });

    if (!candles.length) {
      return res.status(200).json({ error: "No data" });
    }

    const result = runBacktest(candles, strategy);

    return res.status(200).json({
      success: true,
      days,
      ...result
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
