import { NextResponse } from "next/server";

function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }
  const numerator = n * sumAB - sumA * sumB;
  const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  return denominator === 0 ? 0 : numerator / denominator;
}

export async function GET() {
  try {
    const [btcKlines, ethKlines] = await Promise.all([
      fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=30").then((r) => r.json()),
      fetch("https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=30").then((r) => r.json()),
    ]);

    const btcReturns = btcKlines.slice(1).map((k: any, i: number) => {
      const prev = parseFloat(btcKlines[i][4]);
      const curr = parseFloat(k[4]);
      return (curr - prev) / prev;
    });
    const ethReturns = ethKlines.slice(1).map((k: any, i: number) => {
      const prev = parseFloat(ethKlines[i][4]);
      const curr = parseFloat(k[4]);
      return (curr - prev) / prev;
    });

    const btcEthCorr = correlation(btcReturns, ethReturns);

    return NextResponse.json({
      pairs: [
        { name: "BTC/ETH", correlation: parseFloat(btcEthCorr.toFixed(4)), period: "30d" },
        { name: "BTC/SPX", correlation: null, note: "Requires premium API" },
        { name: "BTC/DXY", correlation: null, note: "Requires premium API" },
        { name: "BTC/Gold", correlation: null, note: "Requires premium API" },
      ],
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch correlation data" }, { status: 500 });
  }
}
