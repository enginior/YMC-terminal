import { NextResponse } from "next/server";

// biquote.io — keyless economic calendar (aggregates MQL5).
// Window defaults to yesterday → +7 days.
const BASE_URL = "https://biquote.io/api/calendar";
const COUNTRIES = "US,EU,GB,JP,CN,AU,CA,CH,NZ";

interface UpstreamEvent {
  time?: string;
  currency?: string;
  countryCode?: string;
  name?: string;
  actual?: number | string | null;
  forecast?: number | string | null;
  previous?: number | string | null;
  unit?: string;
  multiplier?: string;
  digits?: number;
  timeMode?: string;
  importance?: string;
}

export interface CalendarEvent {
  time: string;
  currency: string;
  name: string;
  importance: "high" | "medium";
  actual: number | string | null;
  forecast: number | string | null;
  previous: number | string | null;
  unit: string;
  multiplier: string;
  digits: number;
  timeMode: string;
}

async function fetchImportance(level: "high" | "medium"): Promise<CalendarEvent[]> {
  const url = `${BASE_URL}?importance=${level}&countries=${COUNTRIES}`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`biquote ${level} returned ${res.status}`);

  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error(`bad payload for ${level}`);

  return raw
    .filter((e: UpstreamEvent) => e && e.time && e.name)
    .map((e: UpstreamEvent) => {
      const imp: "high" | "medium" =
        e.importance === "high" || level === "high" ? "high" : "medium";
      return {
        time: e.time!,
        currency: e.currency || e.countryCode || "",
        name: e.name!,
        importance: imp,
        actual: e.actual ?? null,
        forecast: e.forecast ?? null,
        previous: e.previous ?? null,
        unit: e.unit && e.unit !== "none" ? e.unit : "",
        multiplier: e.multiplier && e.multiplier !== "none" ? e.multiplier : "",
        digits: typeof e.digits === "number" ? e.digits : 2,
        timeMode: e.timeMode || "exact",
      };
    });
}

export async function GET() {
  const results = await Promise.allSettled([
    fetchImportance("high"),
    fetchImportance("medium"),
  ]);

  const highResult = results[0];
  const medResult = results[1];

  // Return 502 only if both failed
  if (highResult.status === "rejected" && medResult.status === "rejected") {
    console.error("Calendar fetch failed for both high and medium:", {
      high: highResult.reason,
      med: medResult.reason,
    });
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 502 });
  }

  // Merge and deduplicate on time + name + currency; high takes priority
  const mergedMap = new Map<string, CalendarEvent>();

  // Process medium first so high can override if duplicate
  if (medResult.status === "fulfilled") {
    for (const item of medResult.value) {
      const key = `${item.time}_${item.name}_${item.currency}`;
      mergedMap.set(key, item);
    }
  }

  if (highResult.status === "fulfilled") {
    for (const item of highResult.value) {
      const key = `${item.time}_${item.name}_${item.currency}`;
      mergedMap.set(key, item);
    }
  }

  const events = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  return NextResponse.json(events, {
    headers: { "Cache-Control": "s-maxage=300" },
  });
}
