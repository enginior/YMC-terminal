import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") || "BTCUSDT").toUpperCase();

  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`binance ${res.status}`);

    const t = await res.json();

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
      },
      { headers: { "Cache-Control": "s-maxage=5" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch ticker" }, { status: 502 });
  }
}
