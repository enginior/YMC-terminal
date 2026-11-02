"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { useTheme } from "@/context/ThemeContext";
import {
  calculateSessionStates,
  dateToTimelinePct,
  SessionMode,
  TIMELINE_START_HOUR,
  SessionState,
} from "@/lib/sessions";

const TIMELINE_HOURS = [7, 9, 11, 13, 15, 17, 19, 21, 23, 1, 3, 5];

function formatTimelineLabel(hour24: number): string {
  const h = hour24 % 24;
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  if (h > 12) return `${h - 12}pm`;
  return `${h}am`;
}

function MarketSessionsPanel() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<SessionMode>("equities");
  const [now, setNow] = useState<Date | null>(null);
  const [userTz, setUserTz] = useState<string>("UTC");

  // Hydrate local timezone and initial time on mount to prevent SSR mismatch
  useEffect(() => {
    setNow(new Date());
    try {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (resolved) setUserTz(resolved);
    } catch {}

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const sessionStates: SessionState[] = useMemo(() => {
    if (!now) return [];
    return calculateSessionStates(now, mode, userTz);
  }, [now, mode, userTz]);

  const currentTimelinePct = useMemo(() => {
    if (!now) return 0;
    return dateToTimelinePct(now, userTz);
  }, [now, userTz]);

  const userTimeStr = useMemo(() => {
    if (!now) return "--:--:--";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: userTz,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(now);
  }, [now, userTz]);

  const userTzLabel = useMemo(() => {
    if (!now) return "";
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: userTz,
        timeZoneName: "short",
      }).formatToParts(now);
      return parts.find((p) => p.type === "timeZoneName")?.value ?? userTz;
    } catch {
      return userTz;
    }
  }, [now, userTz]);

  return (
    <div
      className="flex flex-col h-full overflow-hidden text-xs select-none"
      style={{ background: theme.panel, color: theme.text }}
    >
      {/* Header Bar */}
      <div
        className="px-3 py-2 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: theme.border, background: `${theme.bg}50` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{ background: `${theme.yellow}20`, color: theme.yellow }}
          >
            CLK
          </span>
          <span className="font-semibold text-xs tracking-wide">
            Market Sessions
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.2 rounded"
            style={{ background: `${theme.dim}20`, color: theme.dim }}
            title={`Detected Local Timezone: ${userTz}`}
          >
            {userTzLabel}
          </span>
        </div>

        {/* Mode Selector & Local Clock */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold" style={{ color: theme.yellow }}>
            {userTimeStr}
          </span>

          <div
            className="flex items-center rounded border overflow-hidden p-0.5"
            style={{ borderColor: theme.border, background: theme.bg }}
          >
            <button
              onClick={() => setMode("equities")}
              className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
              style={{
                background: mode === "equities" ? `${theme.yellow}25` : "transparent",
                color: mode === "equities" ? theme.yellow : theme.dim,
              }}
              title="Equities Cash Bell Hours (NYSE 9:30 AM ET, LSE 8:00 AM, TSE, ASX)"
            >
              Equities
            </button>
            <button
              onClick={() => setMode("forex")}
              className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
              style={{
                background: mode === "forex" ? `${theme.yellow}25` : "transparent",
                color: mode === "forex" ? theme.yellow : theme.dim,
              }}
              title="Interbank 24h Cascade (Sydney, Tokyo, London, NY FX)"
            >
              Forex
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 24-Hour Visual Timeline Canvas (Forex Factory Style) */}
        <div
          className="rounded border p-2.5 flex flex-col gap-1.5"
          style={{ background: theme.bg, borderColor: theme.border }}
        >
          {/* Top Ruler Header */}
          <div className="relative h-5 border-b pb-1" style={{ borderColor: theme.border }}>
            <div className="flex justify-between items-center text-[9px] font-mono text-dim tracking-tighter">
              {TIMELINE_HOURS.map((h, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span style={{ color: theme.dim }}>{formatTimelineLabel(h)}</span>
                  <span className="h-1 w-px mt-0.5" style={{ background: theme.border }} />
                </div>
              ))}
            </div>

            {/* Glowing Vertical Cursor Line (NOW) Top Anchor */}
            {now && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none transition-all duration-300"
                style={{ left: `${currentTimelinePct}%` }}
              >
                <div
                  className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] -ml-[4px]"
                  style={{ borderTopColor: theme.green }}
                />
              </div>
            )}
          </div>

          {/* Session Tracks Container with Vertical Glowing Line */}
          <div className="relative space-y-1.5 py-1">
            {/* Vertical Glowing Cursor Line Spanning All Tracks */}
            {now && (
              <div
                className="absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none transition-all duration-300"
                style={{
                  left: `${currentTimelinePct}%`,
                  background: theme.green,
                  boxShadow: `0 0 8px ${theme.green}`,
                }}
              />
            )}

            {/* Session Horizontal Bars */}
            {sessionStates.map((s) => {
              const isActive = s.isOpen;
              return (
                <div key={s.def.id} className="relative h-6 rounded flex items-center">
                  {/* Inactive Track Background Lane */}
                  <div
                    className="absolute inset-0 rounded opacity-25"
                    style={{ background: `${theme.dim}10` }}
                  />

                  {/* Active / Session Bar */}
                  <div
                    className="absolute h-full rounded transition-all duration-300 flex items-center px-2 overflow-hidden z-10"
                    style={{
                      left: `${s.startPct}%`,
                      width: `${s.widthPct}%`,
                      background: isActive ? theme.green : `${theme.dim}25`,
                      border: `1px solid ${isActive ? theme.green : `${theme.dim}40`}`,
                      color: isActive ? "#000000" : theme.text,
                      boxShadow: isActive ? `0 0 10px ${theme.green}40` : "none",
                    }}
                    title={`${s.def.name} (${s.exchangeLabel}): ${s.userLocalOpenStr} - ${s.userLocalCloseStr} local | ${s.cityLocalTime}`}
                  >
                    <div className="flex items-center gap-1.5 whitespace-nowrap min-w-0">
                      <span className="font-bold text-[11px] tracking-wide">
                        {s.def.name}
                      </span>
                      <span
                        className="text-[10px] font-mono truncate"
                        style={{ color: isActive ? "rgba(0, 0, 0, 0.85)" : theme.dim }}
                      >
                        {s.cityLocalTime}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Session Status Cards */}
        <div className="grid grid-cols-2 gap-2">
          {sessionStates.map((s) => {
            const isActive = s.isOpen;
            return (
              <div
                key={s.def.id}
                className="rounded border p-2 flex flex-col justify-between transition-colors"
                style={{
                  background: isActive ? `${theme.green}0a` : theme.bg,
                  borderColor: isActive ? `${theme.green}50` : theme.border,
                }}
              >
                {/* City & Status Badge */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{s.def.flag}</span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-[11px] leading-tight">
                        {s.def.name}
                      </span>
                      <span className="text-[9px] opacity-70" style={{ color: theme.dim }}>
                        {s.exchangeLabel}
                      </span>
                    </div>
                  </div>

                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{
                      background: isActive
                        ? `${theme.green}20`
                        : s.isWeekend
                        ? `${theme.dim}20`
                        : `${theme.dim}15`,
                      color: isActive ? theme.green : theme.dim,
                      border: `1px solid ${isActive ? `${theme.green}50` : `${theme.dim}30`}`,
                    }}
                  >
                    {s.statusBadge}
                  </span>
                </div>

                {/* Local Hours & Countdown */}
                <div className="space-y-0.5 pt-1 border-t" style={{ borderColor: `${theme.border}80` }}>
                  <div className="flex justify-between items-center text-[10px]">
                    <span style={{ color: theme.dim }}>Local Hours:</span>
                    <span className="font-mono font-medium" style={{ color: theme.text }}>
                      {s.userLocalOpenStr} – {s.userLocalCloseStr}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px]">
                    <span style={{ color: theme.dim }}>City Clock:</span>
                    <span className="font-mono text-[10px]" style={{ color: theme.yellow }}>
                      {s.cityLocalTime.replace(" local", "")} {s.cityTzAbbr}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] pt-0.5">
                    <span style={{ color: theme.dim }}>Schedule:</span>
                    <span
                      className="font-mono text-[10px] font-semibold"
                      style={{ color: isActive ? theme.green : theme.dim }}
                    >
                      {s.statusCountdown}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(MarketSessionsPanel);
