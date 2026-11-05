import { NextRequest, NextResponse } from "next/server";
import { isFuturesSymbol } from "@/lib/symbols";

function baseAsset(symbol: string): string {
  const upper = symbol.toUpperCase();
  for (const quote of ["USDT", "USDC", "BUSD", "USD"]) {
    if (upper.endsWith(quote)) return upper.slice(0, -quote.length);
  }
  return upper;
}

async function fetchOkxTicker(symbol: string) {
  const base = baseAsset(symbol);
  const spotInstId = `${base}-USDT`;
  const swapInstId = `${base}-USDT-SWAP`;

  const [spotRes, markRes] = await Promise.allSettled([
    fetch(`https://www.okx.com/api/v5/market/ticker?instId=${spotInstId}`, { cache: "no-store" }),
    fetch(`https://www.okx.com/api/v5/public/mark-price?instType=SWAP&instId=${swapInstId}`, { cache: "no-store" }),
  ]);

  let item: any = null;
  let markPrice: number | null = null;

  if (spotRes.status === "fulfilled" && spotRes.value.ok) {
    const json = await spotRes.value.json();
    item = json?.data?.[0] ?? null;
  }

  if (markRes.status === "fulfilled" && markRes.value.ok) {
    try {
      const mJson = await markRes.value.json();
      const mItem = mJson?.data?.[0];
      if (mItem) {
        const parsedMark = parseFloat(mItem.markPx);
        if (Number.isFinite(parsedMark)) markPrice = parsedMark;
      }
    } catch {}
  }

  if (!item) {
    // Fallback to OKX SWAP ticker if spot pair is unavailable
    const swapTickerRes = await fetch(
      `https://www.okx.com/api/v5/market/ticker?instId=${swapInstId}`,
      { cache: "no-store" }
    );
    if (swapTickerRes.ok) {
      const sJson = await swapTickerRes.json();
      item = sJson?.data?.[0] ?? null;
    }
  }

  if (!item) throw new Error("okx ticker failed");

  const lastPrice = parseFloat(item.last);
  const open = parseFloat(item.open24h);
  const priceChange = Number.isFinite(lastPrice) && Number.isFinite(open) ? lastPrice - open : 0;
  const priceChangePercent =
    Number.isFinite(open) && open > 0 ? ((lastPrice - open) / open) * 100 : 0;

  return {
    symbol,
    source: "okx" as const,
    lastPrice,
    priceChange,
    priceChangePercent,
    high: parseFloat(item.high24h),
    low: parseFloat(item.low24h),
    open: Number.isFinite(open) ? open : lastPrice,
    volume: parseFloat(item.vol24h),
    quoteVolume: parseFloat(item.volCcy24h),
    trades: 0,
    markPrice,
  };
}

async function fetchBybitTicker(symbol: string) {
  const [spotRes, linearRes] = await Promise.allSettled([
    fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`, { cache: "no-store" }),
    fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`, { cache: "no-store" }),
  ]);

  let item: any = null;
  let markPrice: number | null = null;

  if (spotRes.status === "fulfilled" && spotRes.value.ok) {
    const json = await spotRes.value.json();
    item = json?.result?.list?.[0] ?? null;
  }

  if (linearRes.status === "fulfilled" && linearRes.value.ok) {
    try {
      const lJson = await linearRes.value.json();
      const lItem = lJson?.result?.list?.[0];
      if (lItem) {
        const parsedMark = parseFloat(lItem.markPrice);
        if (Number.isFinite(parsedMark)) markPrice = parsedMark;
        if (!item) item = lItem;
      }
    } catch {}
  }

  if (!item) throw new Error("bybit ticker failed");

  const lastPrice = parseFloat(item.lastPrice);
  const open = parseFloat(item.prevPrice24h);
  const priceChange = Number.isFinite(lastPrice) && Number.isFinite(open) ? lastPrice - open : 0;
  const priceChangePercent = parseFloat(item.price24hPcnt) * 100;

  return {
    symbol,
    source: "bybit" as const,
    lastPrice,
    priceChange,
    priceChangePercent: Number.isFinite(priceChangePercent) ? priceChangePercent : 0,
    high: parseFloat(item.highPrice24h),
    low: parseFloat(item.lowPrice24h),
    open: Number.isFinite(open) ? open : lastPrice,
    volume: parseFloat(item.volume24h),
    quoteVolume: parseFloat(item.turnover24h),
    trades: 0,
    markPrice,
  };
}

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") || "BTCUSDT").toUpperCase();
  const requestedSource = (request.nextUrl.searchParams.get("source") || "binance").toLowerCase();
  const isFutures = isFuturesSymbol(symbol);

  try {
    if (requestedSource === "okx" && !isFutures) {
      try {
        const okxData = await fetchOkxTicker(symbol);
        return NextResponse.json(okxData, { headers: { "Cache-Control": "s-maxage=5" } });
      } catch {
        // Fallback to Binance if OKX is unreachable or pair is unlisted
      }
    }

    if (requestedSource === "bybit" && !isFutures) {
      try {
        const bybitData = await fetchBybitTicker(symbol);
        return NextResponse.json(bybitData, { headers: { "Cache-Control": "s-maxage=5" } });
      } catch {
        // Fallback to Binance if Bybit is unreachable or pair is unlisted
      }
    }

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
        source: "binance" as const,
        lastPrice: parseFloat(t.lastPrice),
        priceChange: parseFloat(t.priceChange),
        priceChangePercent: parseFloat(t.priceChangePercent),
        high: parseFloat(t.highPrice),
        low: parseFloat(t.lowPrice),
        open: parseFloat(t.openPrice),
        volume: parseFloat(t.volume),
        quoteVolume: parseFloat(t.quoteVolume),
        trades: t.count ?? 0,
        markPrice,
      },
      { headers: { "Cache-Control": "s-maxage=5" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch ticker" }, { status: 502 });
  }
}
