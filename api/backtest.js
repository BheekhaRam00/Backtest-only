import { getMarketData } from "../lib/upstox.js";
import { runBacktest }   from "../lib/backtest.js";
import { strategy }      from "../lib/strategy.js";

export default async function handler(req, res) {
  try {
    const days    = Number(req.query?.days ?? 10);
    const candles = await getMarketData("NSE_INDEX|Nifty 50", { days });

    if (!candles.length) return res.json({ error: "No data" });

    const result = runBacktest(candles, strategy);
    return res.json({ success: true, days, ...result });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
