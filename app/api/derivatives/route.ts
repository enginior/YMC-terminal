import { NextRequest, NextResponse } from "next/server";
import { toBinanceSymbol } from "@/lib/symbols";

export const revalidate = 30; // Cache on edge for 30 seconds

const VALID_OI_PERIODS = new Set([
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "12h",
  "1d",
]);

function normalizeOiPeriod(tf: string): string {
  const lower = tf.toLowerCase();
  if (lower === "1m" || lower === "5m") return "5m";
  if (VALID_OI_PERIODS.has(lower)) return lower;
  return "1h";
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawSymbol = searchParams.get("symbol") || "BTCUSDT";
  const timeframe = searchParams.get("timeframe") || "1h";
  const binanceSymbol = toBinanceSymbol(rawSymbol) || "BTCUSDT";
  const oiPeriod = normalizeOiPeriod(timeframe);

  try {
    const [oiRes, fundingRes] = await Promise.allSettled([
      fetch(
        `https://fapi.binance.com/futures/data/openInterestHist?symbol=${binanceSymbol}&period=${oiPeriod}&limit=500`,
        { next: { revalidate: 30 } }
      ).then(async (r) => {
        if (!r.ok) throw new Error(`OI fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch(
        `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${binanceSymbol}&limit=500`,
        { next: { revalidate: 60 } }
      ).then(async (r) => {
        if (!r.ok) throw new Error(`Funding fetch failed: ${r.status}`);
        return r.json();
      }),
    ]);

    let openInterest: Array<{ time: number; value: number; amount: number }> = [];
    if (oiRes.status === "fulfilled" && Array.isArray(oiRes.value)) {
      openInterest = oiRes.value.map((d: any) => ({
        time: Math.floor(d.timestamp / 1000),
        value: parseFloat(d.sumOpenInterestValue),
        amount: parseFloat(d.sumOpenInterest),
      }));
    }

    let fundingRates: Array<{ time: number; rate: number; markPrice: number }> = [];
    if (fundingRes.status === "fulfilled" && Array.isArray(fundingRes.value)) {
      fundingRates = fundingRes.value.map((d: any) => ({
        time: Math.floor(d.fundingTime / 1000),
        rate: parseFloat(d.fundingRate) * 100, // percentage e.g. 0.01 for 0.01%
        markPrice: parseFloat(d.markPrice),
      }));
    }

    return NextResponse.json(
      {
        symbol: binanceSymbol,
        period: oiPeriod,
        openInterest,
        fundingRates,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        symbol: binanceSymbol,
        period: oiPeriod,
        openInterest: [],
        fundingRates: [],
        error: err?.message ?? "Failed to fetch derivatives data",
      },
      { status: 500 }
    );
  }
}
