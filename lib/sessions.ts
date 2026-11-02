/**
 * Market Sessions & Trading Hours Library
 *
 * Implements global market sessions (Sydney, Tokyo, London, New York) with
 * high-precision two-pass IANA timezone evaluation, Daylight Saving Time (DST) tracking,
 * wrap-around timeline segments, and TSE lunch break support.
 */

export type SessionMode = "equities" | "forex";

export interface SessionSchedule {
  hour: number;
  minute: number;
}

export interface MarketSessionDef {
  id: "sydney" | "tokyo" | "london" | "newyork";
  name: string;
  shortCode: string;
  city: string;
  country: string;
  flag: string;
  timeZone: string; // IANA timezone e.g. "America/New_York"
  equitiesExchange: string; // e.g. "NYSE", "LSE", "TSE", "ASX"
  equitiesOpen: SessionSchedule;
  equitiesClose: SessionSchedule;
  equitiesLunchStart?: SessionSchedule;
  equitiesLunchEnd?: SessionSchedule;
  forexExchange: string; // e.g. "New York FX"
  forexOpen: SessionSchedule;
  forexClose: SessionSchedule;
}

export const MARKET_SESSIONS: MarketSessionDef[] = [
  {
    id: "sydney",
    name: "Sydney",
    shortCode: "SYD",
    city: "Sydney",
    country: "Australia",
    flag: "🇦🇺",
    timeZone: "Australia/Sydney",
    equitiesExchange: "ASX",
    equitiesOpen: { hour: 10, minute: 0 },
    equitiesClose: { hour: 16, minute: 0 },
    forexExchange: "Sydney FX",
    forexOpen: { hour: 7, minute: 0 },
    forexClose: { hour: 16, minute: 0 },
  },
  {
    id: "tokyo",
    name: "Tokyo",
    shortCode: "TYO",
    city: "Tokyo",
    country: "Japan",
    flag: "🇯🇵",
    timeZone: "Asia/Tokyo",
    equitiesExchange: "TSE",
    equitiesOpen: { hour: 9, minute: 0 },
    equitiesClose: { hour: 15, minute: 30 },
    equitiesLunchStart: { hour: 11, minute: 30 },
    equitiesLunchEnd: { hour: 12, minute: 30 },
    forexExchange: "Tokyo FX",
    forexOpen: { hour: 9, minute: 0 },
    forexClose: { hour: 18, minute: 0 },
  },
  {
    id: "london",
    name: "London",
    shortCode: "LDN",
    city: "London",
    country: "United Kingdom",
    flag: "🇬🇧",
    timeZone: "Europe/London",
    equitiesExchange: "LSE",
    equitiesOpen: { hour: 8, minute: 0 },
    equitiesClose: { hour: 16, minute: 30 },
    forexExchange: "London FX",
    forexOpen: { hour: 8, minute: 0 },
    forexClose: { hour: 17, minute: 0 },
  },
  {
    id: "newyork",
    name: "New York",
    shortCode: "NY",
    city: "New York",
    country: "United States",
    flag: "🇺🇸",
    timeZone: "America/New_York",
    equitiesExchange: "NYSE",
    equitiesOpen: { hour: 9, minute: 30 },
    equitiesClose: { hour: 16, minute: 0 },
    forexExchange: "New York FX",
    forexOpen: { hour: 8, minute: 0 },
    forexClose: { hour: 17, minute: 0 },
  },
];

// Module-level Intl.DateTimeFormat cache for performance (R8)
const dtfCache = new Map<string, Intl.DateTimeFormat>();

export function getDtf(tz: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tz}|${JSON.stringify(options)}`;
  let dtf = dtfCache.get(key);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", { ...options, timeZone: tz });
    dtfCache.set(key, dtf);
  }
  return dtf;
}

/** Offset of `tz` from UTC at instant `t`, in minutes (e.g. Asia/Manila → +480). */
export function tzOffsetMinutes(t: number, tz: string): number {
  const dtf = getDtf(tz, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(new Date(t));
  const y = parseInt(parts.find((p) => p.type === "year")?.value ?? "1970", 10);
  const m = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10);
  const d = parseInt(parts.find((p) => p.type === "day")?.value ?? "1", 10);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const min = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const sec = parseInt(parts.find((p) => p.type === "second")?.value ?? "0", 10);
  const localUtcMs = Date.UTC(y, m - 1, d, h, min, sec);
  return Math.round((localUtcMs - t) / 60_000);
}

/** Format offset minutes to "UTC+8" or "UTC−5". */
export function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "−";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${m < 10 ? "0" : ""}${m}`;
}

/** Wall-clock y-m-d h:m in `tz` → UTC instant. Two passes to settle DST edges (R1). */
export function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  tz: string
): Date {
  const wall = Date.UTC(y, m - 1, d, h, min);
  const first = wall - tzOffsetMinutes(wall, tz) * 60_000;
  return new Date(wall - tzOffsetMinutes(first, tz) * 60_000);
}

/**
 * Converts a target hour & minute on the exchange-local calendar date of `date` in `timeZone`
 * into the exact corresponding UTC Date object.
 */
export function getSessionUtcTime(
  date: Date,
  timeZone: string,
  hour: number,
  minute: number
): Date {
  const dtf = getDtf(timeZone, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(date);
  const y = parseInt(parts.find((p) => p.type === "year")?.value ?? "2026", 10);
  const m = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10);
  const d = parseInt(parts.find((p) => p.type === "day")?.value ?? "1", 10);
  return zonedTimeToUtc(y, m, d, hour, minute, timeZone);
}

/**
 * Finds the next upcoming open time, skipping closed weekends.
 */
export function getNextOpenUtc(
  date: Date,
  timeZone: string,
  hour: number,
  minute: number
): Date {
  let target = getSessionUtcTime(date, timeZone, hour, minute);
  if (target.getTime() <= date.getTime()) {
    const nextDay = new Date(date.getTime() + 24 * 3600_000);
    target = getSessionUtcTime(nextDay, timeZone, hour, minute);
  }

  // Skip Saturday and Sunday in exchange timezone
  for (let i = 0; i < 7; i++) {
    const weekday = getDtf(timeZone, { weekday: "short" }).format(target);
    if (weekday !== "Sat" && weekday !== "Sun") break;
    target = new Date(target.getTime() + 24 * 3600_000);
    target = getSessionUtcTime(target, timeZone, hour, minute);
  }

  return target;
}

/**
 * Returns the short timezone abbreviation for a date (e.g. "EST", "EDT", "GMT").
 */
export function getTimeZoneAbbr(date: Date, timeZone: string): string {
  try {
    return (
      getDtf(timeZone, { timeZoneName: "short" })
        .formatToParts(date)
        .find((p) => p.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
}

/**
 * Formats duration in milliseconds into "Xh Ym" or "Ym".
 */
export function formatDuration(diffMs: number): string {
  if (diffMs <= 0) return "0m";
  const totalMins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Formats short countdown for compact widget display (e.g. "closes 2h10m", "opens 3h").
 */
export function formatCountdownShort(diffMs: number, type: "closes" | "opens" | "resumes"): string {
  if (diffMs <= 0) return `${type} now`;
  const totalMins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${type} ${hours}h${mins > 0 ? `${mins}m` : ""}`;
  return `${type} ${mins}m`;
}

/**
 * Timeline start offset hour in user local time (7 = 7:00 AM).
 * Matches Forex Factory's classic layout where Sydney, Tokyo, London,
 * and New York fall sequentially from left to right.
 */
export const TIMELINE_START_HOUR = 7;

/**
 * Converts a Date into a percentage (0% to 100%) along the 24-hour horizontal track.
 */
export function dateToTimelinePct(date: Date, userTimeZone: string): number {
  const dtf = getDtf(userTimeZone, {
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  const currentLocalMinutes = h * 60 + m;
  const offsetFromStart = (currentLocalMinutes - TIMELINE_START_HOUR * 60 + 1440) % 1440;
  return (offsetFromStart / 1440) * 100;
}

export interface SessionSegment {
  startPct: number;
  widthPct: number;
}

/**
 * Converts a session's start time and duration into 1 or 2 visual track segments (R3).
 */
export function rangeToSegments(
  startLocalMinutes: number,
  durationMinutes: number
): SessionSegment[] {
  const offsetStart = (startLocalMinutes - TIMELINE_START_HOUR * 60 + 1440) % 1440;
  if (offsetStart + durationMinutes <= 1440) {
    return [
      {
        startPct: (offsetStart / 1440) * 100,
        widthPct: (durationMinutes / 1440) * 100,
      },
    ];
  }
  // Crosses the 7am timeline boundary -> 2 segments: right tail + left head
  const tailWidth = 1440 - offsetStart;
  const headWidth = offsetStart + durationMinutes - 1440;
  return [
    {
      startPct: (offsetStart / 1440) * 100,
      widthPct: (tailWidth / 1440) * 100,
    },
    {
      startPct: 0,
      widthPct: (headWidth / 1440) * 100,
    },
  ];
}

export interface SessionState {
  def: MarketSessionDef;
  shortCode: string;
  isOpen: boolean;
  isLunch: boolean;
  isWeekend: boolean;
  exchangeLabel: string;
  cityLocalTime: string; // e.g. "11:07 pm local"
  cityClockShort: string; // e.g. "11:07 pm"
  cityTzAbbr: string;
  userLocalOpenStr: string; // e.g. "10:30 PM"
  userLocalCloseStr: string; // e.g. "05:00 AM"
  statusBadge: "OPEN" | "CLOSED" | "LUNCH" | "WEEKEND";
  statusCountdown: string; // e.g. "Closes in 4h 12m" or "Opens in 2h 18m"
  statusCountdownShort: string; // e.g. "closes 2h10m"
  segments: SessionSegment[];
  lunchSegment?: SessionSegment[];
}

/**
 * Calculates the comprehensive real-time state for each of the 4 global sessions.
 * Runs on minute tick or mode/tz change (R8).
 */
export function calculateSessionStates(
  now: Date,
  mode: SessionMode = "equities",
  userTimeZone?: string
): SessionState[] {
  const userTz = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  // TODO(holidays): Holiday calendar integration when authoritative keyless feed is available
  return MARKET_SESSIONS.map((def) => {
    const schedOpen = mode === "equities" ? def.equitiesOpen : def.forexOpen;
    const schedClose = mode === "equities" ? def.equitiesClose : def.forexClose;
    const exchangeLabel = mode === "equities" ? def.equitiesExchange : def.forexExchange;

    // Check exchange weekend in its own timezone
    const exchangeWeekday = getDtf(def.timeZone, { weekday: "short" }).format(now);
    const isWeekend = exchangeWeekday === "Sat" || exchangeWeekday === "Sun";

    // Session times today in UTC
    const openUtc = getSessionUtcTime(now, def.timeZone, schedOpen.hour, schedOpen.minute);
    const closeUtc = getSessionUtcTime(now, def.timeZone, schedClose.hour, schedClose.minute);

    // Check TSE lunch in equities mode (11:30 - 12:30 JST)
    let isLunch = false;
    let lunchOpenUtc: Date | null = null;
    let lunchCloseUtc: Date | null = null;
    if (mode === "equities" && def.equitiesLunchStart && def.equitiesLunchEnd) {
      lunchOpenUtc = getSessionUtcTime(now, def.timeZone, def.equitiesLunchStart.hour, def.equitiesLunchStart.minute);
      lunchCloseUtc = getSessionUtcTime(now, def.timeZone, def.equitiesLunchEnd.hour, def.equitiesLunchEnd.minute);
      if (!isWeekend && now.getTime() >= lunchOpenUtc.getTime() && now.getTime() < lunchCloseUtc.getTime()) {
        isLunch = true;
      }
    }

    const isWithinHours =
      !isWeekend &&
      now.getTime() >= openUtc.getTime() &&
      now.getTime() < closeUtc.getTime();

    const isOpen = isWithinHours && !isLunch;

    // City local time strings
    const cityParts = getDtf(def.timeZone, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(now);

    const cityHour = cityParts.find((p) => p.type === "hour")?.value ?? "0";
    const cityMinute = cityParts.find((p) => p.type === "minute")?.value ?? "00";
    const cityDayPeriod = cityParts.find((p) => p.type === "dayPeriod")?.value?.toLowerCase() ?? "";
    const cityClockShort = `${cityHour}:${cityMinute} ${cityDayPeriod}`.trim();
    const cityLocalTime = `${cityClockShort} local`;
    const cityTzAbbr = getTimeZoneAbbr(now, def.timeZone);

    // Converted user local open/close times
    const userLocalOpenStr = getDtf(userTz, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(openUtc);

    const userLocalCloseStr = getDtf(userTz, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(closeUtc);

    // Status & countdowns
    let statusBadge: "OPEN" | "CLOSED" | "LUNCH" | "WEEKEND" = "CLOSED";
    let statusCountdown = "";
    let statusCountdownShort = "";

    if (isLunch && lunchCloseUtc) {
      statusBadge = "LUNCH";
      statusCountdown = `Resumes in ${formatDuration(lunchCloseUtc.getTime() - now.getTime())}`;
      statusCountdownShort = formatCountdownShort(lunchCloseUtc.getTime() - now.getTime(), "resumes");
    } else if (isOpen) {
      statusBadge = "OPEN";
      statusCountdown = `Closes in ${formatDuration(closeUtc.getTime() - now.getTime())}`;
      statusCountdownShort = formatCountdownShort(closeUtc.getTime() - now.getTime(), "closes");
    } else if (isWeekend) {
      statusBadge = "WEEKEND";
      const nextOpen = getNextOpenUtc(now, def.timeZone, schedOpen.hour, schedOpen.minute);
      statusCountdown = `Opens in ${formatDuration(nextOpen.getTime() - now.getTime())}`;
      statusCountdownShort = formatCountdownShort(nextOpen.getTime() - now.getTime(), "opens");
    } else {
      statusBadge = "CLOSED";
      const nextOpen = getNextOpenUtc(now, def.timeZone, schedOpen.hour, schedOpen.minute);
      statusCountdown = `Opens in ${formatDuration(nextOpen.getTime() - now.getTime())}`;
      statusCountdownShort = formatCountdownShort(nextOpen.getTime() - now.getTime(), "opens");
    }

    // Timeline positions on 24h scale starting at TIMELINE_START_HOUR (7am)
    // Convert open time into viewer's local minutes
    const userOpenParts = getDtf(userTz, {
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(openUtc);
    const userOpenH = parseInt(userOpenParts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
    const userOpenM = parseInt(userOpenParts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const startLocalMinutes = userOpenH * 60 + userOpenM;

    const durationMinutes = Math.round((closeUtc.getTime() - openUtc.getTime()) / 60_000);
    const segments = rangeToSegments(startLocalMinutes, durationMinutes);

    return {
      def,
      shortCode: def.shortCode,
      isOpen,
      isLunch,
      isWeekend,
      exchangeLabel,
      cityLocalTime,
      cityClockShort,
      cityTzAbbr,
      userLocalOpenStr,
      userLocalCloseStr,
      statusBadge,
      statusCountdown,
      statusCountdownShort,
      segments,
    };
  });
}
