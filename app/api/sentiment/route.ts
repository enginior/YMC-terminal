import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [fearGreed, premiumIndex, openInterest] = await Promise.all([
      fetch("https://api.alternative.me/fng/?limit=1").then((r) => r.json()),
      fetch("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT").then((r) => r.json()),
      fetch("https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT").then((r) => r.json()),
    ]);

    return NextResponse.json({
      fearGreedIndex: parseInt(fearGreed?.data?.[0]?.value || "50"),
      fundingRate: parseFloat(premiumIndex?.lastFundingRate || "0"),
      openInterest: parseFloat(openInterest?.openInterest || "0") * (parseFloat(premiumIndex?.markPrice || "67000")),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch sentiment data" }, { status: 500 });
  }
}
