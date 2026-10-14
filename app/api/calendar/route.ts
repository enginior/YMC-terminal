import { NextResponse } from "next/server";

// biquote.io — keyless economic calendar (aggregates MQL5). High-impact only,
// major currencies, window defaults to yesterday → +7 days.
const CALENDAR =
  "https://biquote.io/api/calendar?importance=high&countries=US,EU,GB,JP,CN,AU,CA,CH,NZ";

export async function GET() {
  try {
    const res = await fetch(CALENDAR, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`biquote ${res.status}`);

    const raw = await res.json();
    if (!Array.isArray(raw)) throw new Error("bad payload");

    const events = raw
      .filter((e: any) => e && e.time && e.name)
      .map((e: any) => ({
        time: e.time,
        currency: e.currency || e.countryCode || "",
        name: e.name,
        actual: e.actual ?? null,
        forecast: e.forecast ?? null,
        previous: e.previous ?? null,
        unit: e.unit && e.unit !== "none" ? e.unit : "",
        multiplier: e.multiplier && e.multiplier !== "none" ? e.multiplier : "",
        digits: typeof e.digits === "number" ? e.digits : 2,
        timeMode: e.timeMode || "exact",
      }))
      .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return NextResponse.json(events, { headers: { "Cache-Control": "s-maxage=300" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 502 });
  }
}