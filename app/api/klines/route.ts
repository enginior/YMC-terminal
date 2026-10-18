import { NextRequest, NextResponse } from "next/server";

const STATIC_ROOT = "https://finom.github.io/static-klines/api/klines";
const BINANCE = "https://api.binance.com/api/v3/klines";

// Intervals static-klines actually publishes, and the calendar window each file covers
const STATIC_SUPPORTED = new Set(["15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]);

// How far back to page through static history, per interval
const WINDOW_DEPTH: Record<string, number> = {
  "15m": 2, // ~2 weeks
  "30m": 4, // ~4 weeks
  "1h": 12, // ~1 year
  "2h": 12, // ~1 year
  "4h": 8, // ~2 years
  "1d": 6, // ~12 years
  "1w": 2,
  "1M": 2,
};

function normalize(raw: string): string {
  // UI uses 1m/5m/15m/1H/4H/1D; Binance wants lowercase, and 1M must not be lowered to 1m
  if (raw === "1M") return "1M";
  return raw.toLowerCase();
}

function toCandle(k: any) {
  return {
    time: Math.floor(k[0] / 1000 / 60) * 60,
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  };
}

/** Start dates that static-klines publishes for a given interval, newest first. */
function staticWindows(interval: string, count: number): string[] {
  const now = new Date();
  const out: string[] = [];

  const pad = (n: number) => String(n).padStart(2, "0");

  switch (interval) {
    case "15m":
    case "30m": {
      // anchored to Mondays, one or two ISO weeks back
      const stepWeeks = interval === "15m" ? 1 : 2;
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back to Monday
      for (let i = 0; i < count; i++) {
        out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() - 7 * stepWeeks);
      }
      break;
    }
    case "1h":
    case "2h": {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      for (let i = 0; i < count; i++) {
        out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`);
        d.setUTCMonth(d.getUTCMonth() - 1);
      }
      break;
    }
    case "4h": {
      const q = Math.floor(now.getUTCMonth() / 3) * 3;
      const d = new Date(Date.UTC(now.getUTCFullYear(), q, 1));
      for (let i = 0; i < count; i++) {
        out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`);
        d.setUTCMonth(d.getUTCMonth() - 3);
      }
      break;
    }
    case "1d": {
      // files are two years each, anchored to even years
      const startYear = now.getUTCFullYear() % 2 === 0 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
      for (let i = 0; i < count; i++) out.push(`${startYear - i * 2}-01-01`);
      break;
    }
    case "1w":
    case "1M": {
      const decade = Math.floor(now.getUTCFullYear() / 10) * 10;
      for (let i = 0; i < count; i++) out.push(`${decade - i * (interval === "1w" ? 10 : 20)}-01-01`);
      break;
    }
    default: {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      for (let i = 0; i < count; i++) {
        out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`);
        d.setUTCMonth(d.getUTCMonth() - 1);
      }
    }
  }

  return out;
}

async function fromBinance(symbol: string, interval: string, limit: number, startTime?: number) {
  const url = new URL(BINANCE);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(Math.min(limit, 1000)));
  if (startTime) url.searchParams.set("startTime", String(startTime));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`binance ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("bad payload");
  return data.map(toCandle);
}

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") || "BTCUSDT").toUpperCase();
  const interval = normalize(request.nextUrl.searchParams.get("interval") || "1h");
  const live = request.nextUrl.searchParams.get("live") === "1";

  try {
    // Live tick: just the newest candle, straight from Binance
    if (live) {
      const candles = await fromBinance(symbol, interval, 2);
      return NextResponse.json(candles, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const useStatic = STATIC_SUPPORTED.has(interval);

    // 1m/5m have no static archive at all — Binance only, paged backwards
    if (!useStatic) {
      const pages = interval === "1m" ? 3 : 4;
      const perPage = 1000;
      let endTime: number | undefined;
      const all: ReturnType<typeof toCandle>[] = [];

      for (let i = 0; i < pages; i++) {
        const url = new URL(BINANCE);
        url.searchParams.set("symbol", symbol);
        url.searchParams.set("interval", interval);
        url.searchParams.set("limit", String(perPage));
        if (endTime) url.searchParams.set("endTime", String(endTime));

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) break;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;

        all.unshift(...data.map(toCandle));
        if (data.length < perPage) break;
        endTime = data[0][0] - 1;
      }

      const deduped = dedupe(all);
      if (deduped.length > 0) {
        return NextResponse.json(deduped, { headers: { "Cache-Control": "s-maxage=60" } });
      }
    }

    // Historical from static-klines
    const windows = staticWindows(interval, WINDOW_DEPTH[interval] ?? 6);
    const collected: ReturnType<typeof toCandle>[] = [];

    await Promise.all(
      windows.map(async (startDate) => {
        try {
          const res = await fetch(`${STATIC_ROOT}/${interval}/${symbol}/${startDate}.json`);
          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) collected.push(...data.map(toCandle));
        } catch {
          /* window missing or unreachable — other windows still contribute */
        }
      })
    );

    let merged = dedupe(collected).sort((a, b) => a.time - b.time);

    // static-klines refreshes daily, so the tail of the series is always stale.
    // Backfill from Binance up to the present.
    if (merged.length > 0) {
      const lastStatic = merged[merged.length - 1].time * 1000;
      const now = Date.now();
      if (now - lastStatic > 2 * 60 * 60 * 1000) {
        try {
          const tail = await fromBinance(symbol, interval, 1000, lastStatic + 1000);
          if (tail.length > 0) merged = dedupe([...merged, ...tail]);
        } catch {
          /* stale tail is better than a hole */
        }
      }
    }

    if (merged.length === 0) {
      const candles = await fromBinance(symbol, interval, 1000);
      return NextResponse.json(candles, { headers: { "Cache-Control": "s-maxage=60" } });
    }

    return NextResponse.json(merged, { headers: { "Cache-Control": "s-maxage=300" } });
  } catch (err) {
    // Last-ditch attempt so the chart is never empty
    try {
      const candles = await fromBinance(symbol, interval, 1000);
      return NextResponse.json(candles, { headers: { "Cache-Control": "s-maxage=30" } });
    } catch {
      return NextResponse.json({ error: "Failed to fetch klines" }, { status: 502 });
    }
  }
}

function dedupe(candles: ReturnType<typeof toCandle>[]) {
  const seen = new Set<number>();
  return candles.filter((c) => {
    if (seen.has(c.time)) return false;
    seen.add(c.time);
    return true;
  });
}
