"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/context/ThemeContext";

interface EconEvent {
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

const STORAGE_KEY = "btc-terminal:calendar-filters";

const CURRENCY_ORDER = ["USD", "EUR", "GBP", "JPY", "CNY", "AUD", "CAD", "CHF", "NZD"];

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

  // Filters
  const [impact, setImpact] = useState<"high" | "medium">("high");
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const skipNextSaveRef = useRef(true);

  // Load saved filters on mount (hydration safe)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (parsed.impact === "high" || parsed.impact === "medium") {
            setImpact(parsed.impact);
          }
          if (Array.isArray(parsed.currencies)) {
            const valid = parsed.currencies.filter(
              (c: unknown): c is string => typeof c === "string"
            );
            setSelectedCurrencies(valid);
          }
        }
      }
    } catch {
      // ignore corrupt JSON and use defaults
    }
  }, []);

  // Save filters to localStorage, skipping initial mount save
  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ impact, currencies: selectedCurrencies })
      );
    } catch {
      // storage quota or disabled
    }
  }, [impact, selectedCurrencies]);

  // Polling data
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

  // Available currencies dynamically derived from loaded events
  const availableCurrencies = useMemo(() => {
    const present = new Set<string>();
    for (const e of events) {
      if (e.currency) present.add(e.currency.toUpperCase());
    }
    return CURRENCY_ORDER.filter((c) => present.has(c));
  }, [events]);

  const toggleCurrency = (curr: string) => {
    if (selectedCurrencies.includes(curr)) {
      const next = selectedCurrencies.filter((c) => c !== curr);
      setSelectedCurrencies(next);
    } else {
      setSelectedCurrencies([...selectedCurrencies, curr]);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (impact === "high" && e.importance !== "high") return false;
      if (
        selectedCurrencies.length > 0 &&
        !selectedCurrencies.includes(e.currency.toUpperCase())
      ) {
        return false;
      }
      return true;
    });
  }, [events, impact, selectedCurrencies]);

  const actualColor = (e: EconEvent): string => {
    if (e.actual === null || e.actual === undefined) return theme.dim;
    if (typeof e.actual !== "number" || typeof e.forecast !== "number") return theme.text;
    if (e.actual > e.forecast) return theme.green;
    if (e.actual < e.forecast) return theme.red;
    return theme.text;
  };

  const emptyFilterLabel = (() => {
    const currLabel =
      selectedCurrencies.length === 0 ? "All" : selectedCurrencies.join(", ");
    const impLabel = impact === "medium" ? "High + Med" : "High";
    return `No events for ${currLabel} · ${impLabel} in this window`;
  })();

  return (
    <div className="h-full flex flex-col">
      <div
        className="px-2 py-1 border-b flex items-center justify-between gap-1 shrink-0 overflow-x-auto whitespace-nowrap min-h-[26px]"
        style={{ borderColor: theme.border, scrollbarWidth: "none" }}
      >
        <span
          className="text-[10px] uppercase tracking-wider shrink-0 font-medium truncate"
          style={{ color: theme.dim }}
          title={`Economic Calendar · ${impact === "medium" ? "High + Med" : "High"}`}
        >
          Economic Calendar · {impact === "medium" ? "High + Med" : "High"}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {/* Impact Filter */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setImpact("high")}
              className="text-[8px] px-1 py-0.5 rounded font-mono uppercase tracking-wider"
              style={{
                background: impact === "high" ? theme.text : "transparent",
                color: impact === "high" ? theme.bg : theme.dim,
              }}
              title="Show High impact events only"
            >
              HIGH
            </button>
            <button
              onClick={() => setImpact("medium")}
              className="text-[8px] px-1 py-0.5 rounded font-mono uppercase tracking-wider"
              style={{
                background: impact === "medium" ? theme.text : "transparent",
                color: impact === "medium" ? theme.bg : theme.dim,
              }}
              title="Show High and Medium impact events"
            >
              HIGH+MED
            </button>
          </div>

          <div className="w-[1px] h-3 mx-0.5 shrink-0" style={{ background: `${theme.border}80` }} />

          {/* Currency Multi-Select */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setSelectedCurrencies([])}
              className="text-[8px] px-1 py-0.5 rounded font-mono uppercase tracking-wider"
              style={{
                background: selectedCurrencies.length === 0 ? theme.text : "transparent",
                color: selectedCurrencies.length === 0 ? theme.bg : theme.dim,
              }}
              title="Show all currencies"
            >
              ALL
            </button>
            {availableCurrencies.map((c) => {
              const isSelected = selectedCurrencies.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCurrency(c)}
                  className="text-[8px] px-1 py-0.5 rounded font-mono uppercase tracking-wider"
                  style={{
                    background: isSelected ? theme.text : "transparent",
                    color: isSelected ? theme.bg : theme.dim,
                  }}
                  title={`Filter ${c}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {events.length === 0 && (
          <div className="p-3 text-center text-[10px]" style={{ color: failed ? theme.red : theme.dim }}>
            {failed ? "Calendar feed unavailable" : "Loading calendar…"}
          </div>
        )}

        {events.length > 0 && filteredEvents.length === 0 && (
          <div className="p-4 text-center text-[10px] font-mono" style={{ color: theme.dim }}>
            {emptyFilterLabel}
          </div>
        )}

        {filteredEvents.map((e, i) => (
          <div
            key={`${e.time}-${e.name}-${i}`}
            className="px-2 py-1.5 border-b"
            style={{ borderColor: `${theme.border}50` }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: e.importance === "high" ? theme.red : theme.yellow,
                }}
                title={e.importance === "high" ? "High impact" : "Medium impact"}
              />
              <span className="text-[8px] shrink-0 font-mono" style={{ color: theme.dim }}>
                {formatTime(e.time, e.timeMode === "exact")}
              </span>
              <span
                className="text-[8px] px-1 rounded shrink-0 font-mono"
                style={{ background: theme.border, color: theme.text }}
              >
                {e.currency}
              </span>
              <span
                className="text-[10px] leading-tight truncate"
                style={{ color: theme.text }}
                title={e.name}
              >
                {e.name}
              </span>
            </div>
            <div className="flex gap-3 mt-0.5 text-[8px] font-mono pl-3" style={{ color: theme.dim }}>
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
