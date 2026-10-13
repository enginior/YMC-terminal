import { NextRequest, NextResponse } from "next/server";
import { UNIVERSE } from "@/lib/symbols";

const BINANCE = "https://api.binance.com/api/v3";

function formatVolume(quoteVolume: number) {
  if (!Number.isFinite(quoteVolume)) return "—";
  if (quoteVolume >= 1e9) return `$${(quoteVolume / 1e9).toFixed(2)}B`;
  if (quoteVolume >= 1e6) return `$${(quoteVolume / 1e6).toFixed(1)}M`;
  return `$${(quoteVolume / 1e3).toFixed(1)}K`;
}

/**
 * Binance's /ticker/24hr accepts a symbols[] param and returns everything in one
 * request, so only the sparklines need per-symbol calls.
 */
export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get("symbols");
  const universe = symbolsParam
    ? symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .map((s) => ({ label: s.replace(/USDT$/, "/USDT"), symbol: s }))
    : UNIVERSE;

  try {
    // Binance expects one JSON array param, not a repeated symbols= per symbol
    const symbolsParam = encodeURIComponent(JSON.stringify(universe.map((u) => u.symbol)));
    const tickerRes = await fetch(`${BINANCE}/ticker/24hr?symbols=${symbolsParam}`, {
      cache: "no-store",
    });
    if (!tickerRes.ok) throw new Error(`ticker ${tickerRes.status}`);
    const tickers: any[] = await tickerRes.json();
    const bySymbol = new Map<string, any>(tickers.map((t) => [t.symbol, t]));

    const results = await Promise.all(
      universe.map(async (u) => {
        const t = bySymbol.get(u.symbol);

        let sparkline: number[] = [];
        try {
          const kRes = await fetch(`${BINANCE}/klines?symbol=${u.symbol}&interval=1h&limit=24`, {
            cache: "no-store",
          });
          if (kRes.ok) {
            const klines: any[] = await kRes.json();
            sparkline = klines.map((k) => parseFloat(k[4]));
          }
        } catch {
          /* sparkline is decorative — price and change still render */
        }

        if (!t) {
          return {
            symbol: u.label,
            price: 0,
            change: 0,
            changePercent: 0,
            volume: "—",
            sparkline: [],
            unavailable: true,
          };
        }

        return {
          symbol: u.label,
          price: parseFloat(t.lastPrice),
          change: parseFloat(t.priceChange),
          changePercent: parseFloat(t.priceChangePercent),
          volume: formatVolume(parseFloat(t.quoteVolume)),
          sparkline,
        };
      })
    );

    return NextResponse.json(results, {
      headers: { "Cache-Control": "s-maxage=15" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch comparison data" }, { status: 502 });
  }
}
