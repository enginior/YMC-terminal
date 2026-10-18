import { NextRequest, NextResponse } from "next/server";
import { UNIVERSE, isFuturesSymbol } from "@/lib/symbols";

const BINANCE_SPOT = "https://api.binance.com/api/v3";
const BINANCE_FUTURES = "https://fapi.binance.com/fapi/v1";

function formatVolume(quoteVolume: number) {
  if (!Number.isFinite(quoteVolume)) return "—";
  if (quoteVolume >= 1e9) return `$${(quoteVolume / 1e9).toFixed(2)}B`;
  if (quoteVolume >= 1e6) return `$${(quoteVolume / 1e6).toFixed(1)}M`;
  return `$${(quoteVolume / 1e3).toFixed(1)}K`;
}

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
    const spotItems = universe.filter((u) => !isFuturesSymbol(u.symbol));
    const futuresItems = universe.filter((u) => isFuturesSymbol(u.symbol));

    const bySymbol = new Map<string, any>();

    const [spotRes, futuresRes] = await Promise.allSettled([
      spotItems.length > 0
        ? fetch(
            `${BINANCE_SPOT}/ticker/24hr?symbols=${encodeURIComponent(
              JSON.stringify(spotItems.map((u) => u.symbol))
            )}`,
            { cache: "no-store" }
          )
        : Promise.resolve(null),
      futuresItems.length > 0
        ? fetch(`${BINANCE_FUTURES}/ticker/24hr`, { cache: "no-store" })
        : Promise.resolve(null),
    ]);

    if (spotRes.status === "fulfilled" && spotRes.value && spotRes.value.ok) {
      try {
        const spotTickers: any[] = await spotRes.value.json();
        if (Array.isArray(spotTickers)) {
          spotTickers.forEach((t) => bySymbol.set(t.symbol, t));
        }
      } catch {}
    }

    if (futuresRes.status === "fulfilled" && futuresRes.value && futuresRes.value.ok) {
      try {
        const futuresTickers: any[] = await futuresRes.value.json();
        if (Array.isArray(futuresTickers)) {
          const wanted = new Set(futuresItems.map((u) => u.symbol));
          futuresTickers.forEach((t) => {
            if (wanted.has(t.symbol)) {
              bySymbol.set(t.symbol, t);
            }
          });
        }
      } catch {}
    }

    const results = await Promise.all(
      universe.map(async (u) => {
        const t = bySymbol.get(u.symbol);
        const isFutures = isFuturesSymbol(u.symbol);

        let sparkline: number[] = [];
        try {
          const klineEndpoint = isFutures ? `${BINANCE_FUTURES}/klines` : `${BINANCE_SPOT}/klines`;
          const kRes = await fetch(`${klineEndpoint}?symbol=${u.symbol}&interval=1h&limit=24`, {
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
          rawVolume: parseFloat(t.quoteVolume),
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
