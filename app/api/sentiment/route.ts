import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") || "BTCUSDT").toUpperCase();

  try {
    const [fngResult, premiumResult, oiResult, lsResult] = await Promise.allSettled([
      fetch("https://api.alternative.me/fng/?limit=1").then((r) => r.json()),
      fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`, { cache: "no-store" }).then(async (r) => {
        if (!r.ok) throw new Error(`premiumIndex status ${r.status}`);
        return r.json();
      }),
      fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`, { cache: "no-store" }).then(async (r) => {
        if (!r.ok) throw new Error(`openInterest status ${r.status}`);
        return r.json();
      }),
      fetch(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`, { cache: "no-store" }).then(async (r) => {
        if (!r.ok) throw new Error(`longShort status ${r.status}`);
        return r.json();
      }),
    ]);

    let fearGreedIndex = 50;
    if (fngResult.status === "fulfilled" && fngResult.value?.data?.[0]?.value) {
      fearGreedIndex = parseInt(fngResult.value.data[0].value, 10);
    }

    let fundingRate: number | null = null;
    let markPrice: number | null = null;
    let openInterest: number | null = null;
    let longShortRatio: number | null = null;
    let longAccount: number | null = null;
    let shortAccount: number | null = null;
    let hasDerivatives = false;

    if (premiumResult.status === "fulfilled" && premiumResult.value?.lastFundingRate) {
      fundingRate = parseFloat(premiumResult.value.lastFundingRate);
      markPrice = parseFloat(premiumResult.value.markPrice);
    }

    if (oiResult.status === "fulfilled" && oiResult.value?.openInterest && markPrice !== null) {
      const rawOi = parseFloat(oiResult.value.openInterest);
      if (Number.isFinite(rawOi)) {
        openInterest = rawOi * markPrice;
        hasDerivatives = true;
      }
    }

    if (lsResult.status === "fulfilled" && Array.isArray(lsResult.value) && lsResult.value.length > 0) {
      const item = lsResult.value[0];
      const parsedRatio = parseFloat(item.longShortRatio);
      const parsedLong = parseFloat(item.longAccount);
      const parsedShort = parseFloat(item.shortAccount);
      if (Number.isFinite(parsedRatio) && Number.isFinite(parsedLong) && Number.isFinite(parsedShort)) {
        longShortRatio = parsedRatio;
        longAccount = parsedLong * 100;
        shortAccount = parsedShort * 100;
      }
    }

    return NextResponse.json(
      {
        symbol,
        fearGreedIndex,
        fundingRate,
        markPrice,
        openInterest,
        longShortRatio,
        longAccount,
        shortAccount,
        hasDerivatives,
      },
      { headers: { "Cache-Control": "s-maxage=15" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch sentiment data" }, { status: 500 });
  }
}
