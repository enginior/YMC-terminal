"use client";

import { memo, useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";

interface EconEvent {
  time: string;
  currency: string;
  name: string;
  actual: number | string | null;
  forecast: number | string | null;
  previous: number | string | null;
  unit: string;
  multiplier: string;
  digits: number;
  timeMode: string;
}

const MULT: Record<string, string> = { thousands: "K", millions: "M", billions: "B" };

function formatValue(value: number | string | null, e: EconEvent): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "number") return String(value);
  let s = value.toFixed(Math.max(0, Math.min(e.digits, 4)));
  if (e.multiplier) s += MULT[e.multiplier] ?? "";
  else if (e.unit) s += e.unit;
  return s;
}

function formatTime(iso: string, exact: boolean): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = d.toDateString() === new Date().toDateString()
    ? ""
    : `${d.getMonth() + 1}/${d.getDate()} `;
  if (!exact) return day.trim();
  const hhmm = d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  return `${day}${hhmm}`;
}

function EconomicCalendarPanel() {
  const { theme } = useTheme();
  const [events, setEvents] = useState<EconEvent[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/calendar");
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (cancelled || !Array.isArray(json)) return;
        setEvents(json);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    load();
    const id = setInterval(load, 300000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const actualColor = (e: EconEvent): string => {
    if (e.actual === null || e.actual === undefined) return theme.dim;
    if (typeof e.actual !== "number" || typeof e.forecast !== "number") return theme.text;
    if (e.actual > e.forecast) return theme.green;
    if (e.actual < e.forecast) return theme.red;
    return theme.text;
  };

  return (
    <div className="h-full flex flex-col">
      <div
        className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider shrink-0"
        style={{ borderColor: theme.border, color: theme.dim }}
      >
        Economic Calendar · High Impact
      </div>

      <div className="flex-1 overflow-y-auto">
        {events.length === 0 && (
          <div className="p-3 text-center text-[10px]" style={{ color: failed ? theme.red : theme.dim }}>
            {failed ? "Calendar feed unavailable" : "Loading calendar…"}
          </div>
        )}

        {events.map((e, i) => (
          <div key={`${e.time}-${e.name}-${i}`} className="px-2 py-1.5 border-b" style={{ borderColor: `${theme.border}50` }}>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] shrink-0" style={{ color: theme.dim }}>
                {formatTime(e.time, e.timeMode === "exact")}
              </span>
              <span
                className="text-[8px] px-1 rounded shrink-0"
                style={{ background: theme.border, color: theme.text }}
              >
                {e.currency}
              </span>
              <span className="text-[10px] leading-tight truncate" style={{ color: theme.text }} title={e.name}>
                {e.name}
              </span>
            </div>
            <div className="flex gap-3 mt-0.5 text-[8px]" style={{ color: theme.dim }}>
              <span>
                PREV <span style={{ color: theme.text }}>{formatValue(e.previous, e)}</span>
              </span>
              <span>
                FCAST <span style={{ color: theme.text }}>{formatValue(e.forecast, e)}</span>
              </span>
              <span>
                ACT <span style={{ color: actualColor(e) }}>{formatValue(e.actual, e)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(EconomicCalendarPanel);