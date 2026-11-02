"use client";

import { useState, useEffect, useMemo, useRef, memo, useCallback } from "react";
import { useTheme } from "@/context/ThemeContext";
import {
  calculateSessionStates,
  dateToTimelinePct,
  SessionMode,
  SessionState,
  formatUtcOffset,
  tzOffsetMinutes,
  getDtf,
} from "@/lib/sessions";

const SESSIONS_PREFS_KEY = "btc-terminal:sessions-prefs";

const TIMEZONE_OPTIONS = [
  { id: "auto", label: "Auto (Detected)" },
  { id: "UTC", label: "UTC" },
  { id: "Asia/Manila", label: "UTC+8 (Manila)" },
  { id: "Asia/Singapore", label: "UTC+8 (Singapore)" },
  { id: "Asia/Tokyo", label: "UTC+9 (Tokyo)" },
  { id: "America/New_York", label: "UTC−5/−4 (New York)" },
  { id: "Europe/London", label: "UTC+0/+1 (London)" },
];

function formatTimelineLabel(hour24: number): string {
  const h = hour24 % 24;
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  if (h > 12) return `${h - 12}pm`;
  return `${h}am`;
}

function MarketSessionsPanel() {
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<SessionMode>("equities");
  const [selectedTz, setSelectedTz] = useState<string>("auto");
  const [detectedTz, setDetectedTz] = useState<string>("UTC");
  const [now, setNow] = useState<Date | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(320);
  const [trackPx, setTrackPx] = useState<number>(280);

  const skipNextSaveRef = useRef(true);

  // Active timezone resolves to detected if auto
  const effectiveTz = useMemo(() => {
    if (selectedTz === "auto") return detectedTz;
    return selectedTz;
  }, [selectedTz, detectedTz]);

  // Load preferences from localStorage (hydration safe)
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setDetectedTz(detected);

      const saved = localStorage.getItem(SESSIONS_PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mode === "equities" || parsed.mode === "forex") {
          setMode(parsed.mode);
        }
        if (typeof parsed.tz === "string") {
          setSelectedTz(parsed.tz);
        }
      }
    } catch {}
    setNow(new Date());
  }, []);

  // Save preferences using skip-exactly-one-save pattern
  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(
        SESSIONS_PREFS_KEY,
        JSON.stringify({ mode, tz: selectedTz })
      );
    } catch {}
  }, [mode, selectedTz]);

  // ResizeObserver on panel root and track container
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === el) {
          setContainerWidth(entry.contentRect.width);
        } else if (entry.target === trackRef.current) {
          setTrackPx(entry.contentRect.width);
        }
      }
    });

    ro.observe(el);
    if (trackRef.current) ro.observe(trackRef.current);

    return () => ro.disconnect();
  }, []);

  // Ticking 1 Hz clock with document.hidden pause (R8)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const startTimer = () => {
      if (timer) clearInterval(timer);
      setNow(new Date());
      timer = setInterval(() => {
        setNow(new Date());
      }, 1000);
    };

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        startTimer();
      }
    };

    if (!document.hidden) startTimer();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Compute minute stamp to avoid heavy session math on every 1 Hz second
  const currentMinuteStamp = useMemo(() => {
    if (!now) return 0;
    return Math.floor(now.getTime() / 60_000);
  }, [now]);

  // Calculate session states when minute, mode, or timezone changes (R8)
  const sessionStates: SessionState[] = useMemo(() => {
    if (!now) return [];
    return calculateSessionStates(now, mode, effectiveTz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMinuteStamp, mode, effectiveTz]);

  // Real-time timeline percentage for NOW cursor line
  const currentTimelinePct = useMemo(() => {
    if (!now) return 0;
    return dateToTimelinePct(now, effectiveTz);
  }, [now, effectiveTz]);

  // User formatted local clock
  const userClockText = useMemo(() => {
    if (!now) return "--:--";
    const showSeconds = containerWidth >= 560;
    return getDtf(effectiveTz, {
      hour: "numeric",
      minute: "2-digit",
      ...(showSeconds ? { second: "2-digit" } : {}),
      hour12: false,
    }).format(now);
  }, [now, effectiveTz, containerWidth]);

  // Formatted UTC offset label (e.g. "UTC+8")
  const offsetLabel = useMemo(() => {
    if (!now) return "";
    const offsetMin = tzOffsetMinutes(now.getTime(), effectiveTz);
    return formatUtcOffset(offsetMin);
  }, [now, effectiveTz]);

  // Responsive mode based on measured width (R6)
  const isCompact = containerWidth < 360;
  const isMedium = containerWidth >= 360 && containerWidth < 560;
  const isExpanded = containerWidth >= 560;

  // Ruler tick intervals: every 6h (compact), 3h (medium), 2h (expanded)
  const rulerTicks = useMemo(() => {
    const step = isCompact ? 6 : isMedium ? 3 : 2;
    const ticks: { hourOffset: number; hour24: number }[] = [];
    for (let offset = 0; offset < 24; offset += step) {
      ticks.push({
        hourOffset: offset,
        hour24: (7 + offset) % 24,
      });
    }
    return ticks;
  }, [isCompact, isMedium]);

  // Helper to render segment bar label based on physical pixel width
  const renderBarLabel = useCallback(
    (s: SessionState, widthPct: number) => {
      const segPx = (widthPct / 100) * trackPx;
      if (segPx >= 96) {
        return `${s.def.name} ${s.cityClockShort}`;
      }
      if (segPx >= 30) {
        return s.shortCode;
      }
      return null;
    },
    [trackPx]
  );

  return (
    <div
      ref={rootRef}
      className="@container flex flex-col h-full overflow-hidden text-xs select-none"
      style={{ background: theme.panel, color: theme.text }}
    >
      {/* Header Bar */}
      <div
        className="px-2.5 py-1.5 border-b flex items-center justify-between shrink-0 gap-2 min-w-0"
        style={{ borderColor: theme.border, background: `${theme.bg}40` }}
      >
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          <span
            className="text-[9px] font-mono font-bold px-1 py-0.5 rounded shrink-0"
            style={{ background: `${theme.yellow}20`, color: theme.yellow }}
          >
            CLK
          </span>
          <span className="font-semibold text-[11px] tracking-wide truncate">
            {isCompact ? "SESSIONS" : "MARKET SESSIONS"}
          </span>

          <span
            className="text-[9px] font-mono px-1 py-0.5 rounded shrink-0"
            style={{ background: `${theme.dim}20`, color: theme.dim }}
            title={`Active Timezone: ${effectiveTz}`}
          >
            {offsetLabel}
          </span>
        </div>

        {/* Right header controls: clock, mode toggle, tz select */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color: theme.yellow }}>
            {userClockText}
          </span>

          {/* Timezone Selector (Expanded layout only) */}
          {isExpanded && (
            <select
              value={selectedTz}
              onChange={(e) => setSelectedTz(e.target.value)}
              className="text-[9px] font-mono px-1 py-0.5 rounded border outline-none cursor-pointer"
              style={{
                background: theme.bg,
                borderColor: theme.border,
                color: theme.dim,
              }}
              title="Select display timezone"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Mode Segmented Toggle */}
          <div
            className="flex items-center rounded border overflow-hidden p-0.5 shrink-0"
            style={{ borderColor: theme.border, background: theme.bg }}
          >
            <button
              onClick={() => setMode("equities")}
              className="px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors"
              style={{
                background: mode === "equities" ? `${theme.yellow}25` : "transparent",
                color: mode === "equities" ? theme.yellow : theme.dim,
              }}
              title="Equities Cash Bell Hours (NYSE 9:30 AM ET, LSE 8:00 AM, TSE, ASX)"
            >
              {isCompact ? "EQ" : "Equities"}
            </button>
            <button
              onClick={() => setMode("forex")}
              className="px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors"
              style={{
                background: mode === "forex" ? `${theme.yellow}25` : "transparent",
                color: mode === "forex" ? theme.yellow : theme.dim,
              }}
              title="Interbank 24h Cascade (Sydney, Tokyo, London, NY FX)"
            >
              {isCompact ? "FX" : "Forex"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2.5 min-h-0">
        {/* 24-Hour Visual Timeline Canvas */}
        <div
          ref={trackRef}
          className="rounded border p-1.5 flex flex-col gap-1 shrink-0"
          style={{ background: theme.bg, borderColor: theme.border }}
        >
          {/* Top Ruler Header with absolute positioning (R4) */}
          <div className="relative h-4 border-b pb-0.5" style={{ borderColor: theme.border }}>
            {rulerTicks.map((t) => {
              const leftPct = (t.hourOffset / 24) * 100;
              const isFirst = t.hourOffset === 0;
              return (
                <div
                  key={t.hourOffset}
                  className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none text-[8px] font-mono text-dim tracking-tighter"
                  style={{
                    left: `${leftPct}%`,
                    transform: isFirst ? "translateX(0)" : "translateX(-50%)",
                  }}
                >
                  <span style={{ color: theme.dim }}>{formatTimelineLabel(t.hour24)}</span>
                  <span className="h-1 w-px mt-0.5" style={{ background: theme.border }} />
                </div>
              );
            })}

            {/* NOW Pill Indicator at top (R4) */}
            {now && (
              <div
                className="absolute top-0 pointer-events-none transition-all duration-300 z-30"
                style={{
                  left: `${Math.min(96, Math.max(4, currentTimelinePct))}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  className="px-1 py-0.2 rounded font-mono text-[7px] font-bold leading-none whitespace-nowrap shadow-sm"
                  style={{ background: theme.green, color: theme.bg }}
                >
                  NOW
                </div>
              </div>
            )}
          </div>

          {/* Session Tracks Container with Vertical Glowing Line */}
          <div className="relative space-y-1 py-0.5">
            {/* Vertical Glowing Cursor Line Spanning All Tracks */}
            {now && (
              <div
                className="absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none transition-all duration-300"
                style={{
                  left: `${currentTimelinePct}%`,
                  background: theme.green,
                  boxShadow: `0 0 6px ${theme.green}`,
                }}
              />
            )}

            {/* Session Horizontal Bars */}
            {sessionStates.map((s) => {
              const isActive = s.isOpen;
              const barHeight = isCompact ? "h-3" : isMedium ? "h-4" : "h-5";

              return (
                <div key={s.def.id} className={`relative ${barHeight} rounded flex items-center`}>
                  {/* Inactive Track Background Lane */}
                  <div
                    className="absolute inset-0 rounded opacity-25"
                    style={{ background: `${theme.dim}10` }}
                  />

                  {/* Render 1 or 2 visual segments (wrap-around R3) */}
                  {s.segments.map((seg, idx) => {
                    const label = renderBarLabel(s, seg.widthPct);

                    return (
                      <div
                        key={idx}
                        className="absolute h-full rounded transition-all duration-300 flex items-center px-1 overflow-hidden z-10"
                        style={{
                          left: `${seg.startPct}%`,
                          width: `${seg.widthPct}%`,
                          background: isActive ? theme.green : `${theme.dim}20`,
                          border: `1px solid ${isActive ? theme.green : `${theme.dim}35`}`,
                          color: isActive ? theme.bg : theme.text,
                          boxShadow: isActive ? `0 0 8px ${theme.green}35` : "none",
                        }}
                        title={`${s.def.name} (${s.exchangeLabel}): ${s.userLocalOpenStr} – ${s.userLocalCloseStr} local | ${s.cityLocalTime}`}
                      >
                        {label && (
                          <span
                            className="font-bold text-[9px] tracking-tight truncate whitespace-nowrap leading-none"
                            style={{ color: isActive ? theme.bg : theme.text }}
                          >
                            {label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Below Timeline Content: Compact Rows vs Expanded Cards (R6) */}
        {isCompact || isMedium ? (
          /* Single-Line Rows Budgeted for < 192px total height */
          <div className="space-y-1">
            {sessionStates.map((s) => {
              const isActive = s.isOpen;
              const isLunch = s.isLunch;

              return (
                <div
                  key={s.def.id}
                  className="flex items-center justify-between text-[10px] py-0.5 px-1 rounded transition-colors"
                  style={{
                    background: isActive ? `${theme.green}0d` : isLunch ? `${theme.yellow}0d` : "transparent",
                  }}
                  title={`${s.def.name} (${s.exchangeLabel}) local hours: ${s.userLocalOpenStr} – ${s.userLocalCloseStr} | City clock: ${s.cityLocalTime}`}
                >
                  {/* Left: dot + flag + code */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        background: isActive
                          ? theme.green
                          : isLunch
                          ? theme.yellow
                          : `${theme.dim}60`,
                        boxShadow: isActive ? `0 0 4px ${theme.green}` : "none",
                      }}
                    />
                    <span className="text-[10px] shrink-0">{s.def.flag}</span>
                    <span className="font-semibold text-[10px] tracking-tight truncate">
                      {isCompact ? s.shortCode : s.def.name}
                    </span>
                  </div>

                  {/* Middle: Local Hours on medium width */}
                  {isMedium && (
                    <span className="font-mono text-[9px] text-dim tabular-nums truncate px-1">
                      {s.userLocalOpenStr}–{s.userLocalCloseStr}
                    </span>
                  )}

                  {/* Right: Status pill + countdown */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-[8px] font-bold px-1 py-0.2 rounded uppercase tracking-wider"
                      style={{
                        background: isActive
                          ? `${theme.green}20`
                          : isLunch
                          ? `${theme.yellow}20`
                          : `${theme.dim}15`,
                        color: isActive ? theme.green : isLunch ? theme.yellow : theme.dim,
                        border: `1px solid ${
                          isActive
                            ? `${theme.green}40`
                            : isLunch
                            ? `${theme.yellow}40`
                            : `${theme.dim}25`
                        }`,
                      }}
                    >
                      {s.statusBadge}
                    </span>

                    <span
                      className="font-mono text-[9px] font-medium tabular-nums text-right"
                      style={{
                        color: isActive ? theme.green : isLunch ? theme.yellow : theme.dim,
                      }}
                    >
                      {s.statusCountdownShort}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Expanded 2-Column Cards for Maximized / Mobile Full Width */
          <div className="grid grid-cols-2 gap-2">
            {sessionStates.map((s) => {
              const isActive = s.isOpen;
              const isLunch = s.isLunch;

              return (
                <div
                  key={s.def.id}
                  className="rounded border p-2 flex flex-col justify-between transition-colors"
                  style={{
                    background: isActive
                      ? `${theme.green}0a`
                      : isLunch
                      ? `${theme.yellow}0a`
                      : theme.bg,
                    borderColor: isActive
                      ? `${theme.green}50`
                      : isLunch
                      ? `${theme.yellow}50`
                      : theme.border,
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0">{s.def.flag}</span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-[11px] leading-tight truncate">
                          {s.def.name}
                        </span>
                        <span className="text-[9px] opacity-70 truncate" style={{ color: theme.dim }}>
                          {s.exchangeLabel}
                        </span>
                      </div>
                    </div>

                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
                      style={{
                        background: isActive
                          ? `${theme.green}20`
                          : isLunch
                          ? `${theme.yellow}20`
                          : `${theme.dim}15`,
                        color: isActive ? theme.green : isLunch ? theme.yellow : theme.dim,
                        border: `1px solid ${
                          isActive
                            ? `${theme.green}50`
                            : isLunch
                            ? `${theme.yellow}50`
                            : `${theme.dim}30`
                        }`,
                      }}
                    >
                      {s.statusBadge}
                    </span>
                  </div>

                  <div className="space-y-0.5 pt-1 border-t" style={{ borderColor: `${theme.border}80` }}>
                    <div className="flex justify-between items-center text-[10px]">
                      <span style={{ color: theme.dim }}>Local Hours:</span>
                      <span className="font-mono font-medium tabular-nums" style={{ color: theme.text }}>
                        {s.userLocalOpenStr} – {s.userLocalCloseStr}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px]">
                      <span style={{ color: theme.dim }}>City Clock:</span>
                      <span className="font-mono text-[10px] tabular-nums" style={{ color: theme.yellow }}>
                        {s.cityClockShort} {s.cityTzAbbr}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] pt-0.5">
                      <span style={{ color: theme.dim }}>Schedule:</span>
                      <span
                        className="font-mono text-[10px] font-semibold tabular-nums"
                        style={{
                          color: isActive ? theme.green : isLunch ? theme.yellow : theme.dim,
                        }}
                      >
                        {s.statusCountdown}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MarketSessionsPanel);
