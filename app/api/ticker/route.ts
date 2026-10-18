import { NextRequest, NextResponse } from "next/server";
import { isFuturesSymbol } from "@/lib/symbols";

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") || "BTCUSDT").toUpperCase();
  const isFutures = isFuturesSymbol(symbol);

  try {
    let t: any = null;
    let markPrice: number | null = null;

    if (!isFutures) {
      const [spotRes, perpRes] = await Promise.allSettled([
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, { cache: "no-store" }),
        fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`, { cache: "no-store" }),
      ]);

      if (spotRes.status === "fulfilled" && spotRes.value.ok) {
        t = await spotRes.value.json();
      }

      if (perpRes.status === "fulfilled" && perpRes.value.ok) {
        try {
          const perp = await perpRes.value.json();
          const parsed = parseFloat(perp.markPrice);
          if (Number.isFinite(parsed)) markPrice = parsed;
        } catch {}
      }
    }

    // If spot failed or is a futures symbol, fetch from Binance Futures ticker
    if (!t) {
      const fRes = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`, {
        cache: "no-store",
      });
      if (fRes.ok) {
        t = await fRes.json();
        const p = parseFloat(t.lastPrice);
        if (markPrice == null && Number.isFinite(p)) markPrice = p;
      }
    }

    if (!t) throw new Error("binance ticker failed");

    return NextResponse.json(
      {
        symbol,
        lastPrice: parseFloat(t.lastPrice),
        priceChange: parseFloat(t.priceChange),
        priceChangePercent: parseFloat(t.priceChangePercent),
        high: parseFloat(t.highPrice),
        low: parseFloat(t.lowPrice),
        open: parseFloat(t.openPrice),
        volume: parseFloat(t.volume),
        quoteVolume: parseFloat(t.quoteVolume),
        trades: t.count,
        markPrice,
      },
      { headers: { "Cache-Control": "s-maxage=5" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch ticker" }, { status: 502 });
  }
}
