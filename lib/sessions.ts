/**
 * Market Sessions & Trading Hours Library
 *
 * Implements global market sessions (Sydney, Tokyo, London, New York) with
 * automatic IANA timezone evaluation, Daylight Saving Time (DST) shift tracking,
 * and 24-hour horizontal timeline positioning calibrated to user local time.
 */

export type SessionMode = "equities" | "forex";

export interface SessionSchedule {
  hour: number;
  minute: number;
}

export interface MarketSessionDef {
  id: "sydney" | "tokyo" | "london" | "newyork";
  name: string;
  city: string;
  country: string;
  flag: string;
  timeZone: string; // IANA timezone e.g. "America/New_York"
  equitiesExchange: string; // e.g. "NYSE / NASDAQ"
  equitiesOpen: SessionSchedule;
  equitiesClose: SessionSchedule;
  forexExchange: string; // e.g. "Interbank FX"
  forexOpen: SessionSchedule;
  forexClose: SessionSchedule;
}

export const MARKET_SESSIONS: MarketSessionDef[] = [
  {
    id: "sydney",
    name: "Sydney",
    city: "Sydney",
    country: "Australia",
    flag: "🇦🇺",
    timeZone: "Australia/Sydney",
    equitiesExchange: "ASX",
    equitiesOpen: { hour: 10, minute: 0 },
    equitiesClose: { hour: 16, minute: 0 },
    forexExchange: "Sydney Session",
    forexOpen: { hour: 7, minute: 0 },
    forexClose: { hour: 16, minute: 0 },
  },
  {
    id: "tokyo",
    name: "Tokyo",
    city: "Tokyo",
    country: "Japan",
    flag: "🇯🇵",
    timeZone: "Asia/Tokyo",
    equitiesExchange: "TSE",
    equitiesOpen: { hour: 9, minute: 0 },
    equitiesClose: { hour: 15, minute: 30 },
    forexExchange: "Tokyo Session",
    forexOpen: { hour: 9, minute: 0 },
    forexClose: { hour: 18, minute: 0 },
  },
  {
    id: "london",
    name: "London",
    city: "London",
    country: "United Kingdom",
    flag: "🇬🇧",
    timeZone: "Europe/London",
    equitiesExchange: "LSE",
    equitiesOpen: { hour: 8, minute: 0 },
    equitiesClose: { hour: 16, minute: 30 },
    forexExchange: "London Session",
    forexOpen: { hour: 8, minute: 0 },
    forexClose: { hour: 17, minute: 0 },
  },
  {
    id: "newyork",
    name: "New York",
    city: "New York",
    country: "United States",
    flag: "🇺🇸",
    timeZone: "America/New_York",
    equitiesExchange: "NYSE / NASDAQ",
    equitiesOpen: { hour: 9, minute: 30 },
    equitiesClose: { hour: 16, minute: 0 },
    forexExchange: "New York Session",
    forexOpen: { hour: 8, minute: 0 },
    forexClose: { hour: 17, minute: 0 },
  },
];

export interface SessionState {
  def: MarketSessionDef;
  isOpen: boolean;
  isWeekend: boolean;
  exchangeLabel: string;
  cityLocalTime: string; // e.g. "11:07 pm local"
  cityTzAbbr: string; // e.g. "EST", "EDT", "BST", "GMT"
  userLocalOpenStr: string; // e.g. "10:30 PM"
  userLocalCloseStr: string; // e.g. "05:00 AM"
  statusBadge: "OPEN" | "CLOSED" | "WEEKEND";
  statusCountdown: string; // e.g. "Closes in 4h 12m" or "Opens in 2h 18m"
  // Timeline coordinates (percentage from 0% to 100% on 24h axis starting at 7am local)
  startPct: number;
  widthPct: number;
}

/**
 * Converts a target hour & minute on the given calendar date in `timeZone`
 * into the exact corresponding UTC Date object, accounting for DST.
 */
export function getSessionUtcTime(
  date: Date,
  timeZone: string,
  hour: number,
  minute: number
): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parseInt(parts.find((p) => p.type === "year")?.value ?? "2026", 10);
  const m = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10);
  const d = parseInt(parts.find((p) => p.type === "day")?.value ?? "1", 10);

  const guessUtc = new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(guessUtc);

  const tzH = parseInt(tzParts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const tzM = parseInt(tzParts.find((p) => p.type === "minute")?.value ?? "0", 10);

  const diffMinutes = hour * 60 + minute - (tzH * 60 + tzM);
  return new Date(guessUtc.getTime() + diffMinutes * 60000);
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
    target = new Date(target.getTime() + 24 * 3600 * 1000);
    target = getSessionUtcTime(target, timeZone, hour, minute);
  }

  // Skip Saturday and Sunday in exchange timezone
  for (let i = 0; i < 7; i++) {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(target);
    if (weekday !== "Sat" && weekday !== "Sun") break;
    target = new Date(target.getTime() + 24 * 3600 * 1000);
    target = getSessionUtcTime(target, timeZone, hour, minute);
  }

  return target;
}

/**
 * Returns the short timezone abbreviation for a date (e.g. "EST", "EDT", "GMT", "PHT").
 */
export function getTimeZoneAbbr(date: Date, timeZone: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
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
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Timeline start offset hour in user local time (7 = 7:00 AM).
 * Matches Forex Factory's classic layout where Sydney, Tokyo, London,
 * and New York fall sequentially from left to right without wrapping.
 */
export const TIMELINE_START_HOUR = 7;

/**
 * Converts a Date into a percentage (0% to 100%) along the 24-hour horizontal track.
 */
export function dateToTimelinePct(date: Date, userTimeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: userTimeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  const currentLocalMinutes = h * 60 + m;
  const offsetFromStart = (currentLocalMinutes - TIMELINE_START_HOUR * 60 + 1440) % 1440;
  return (offsetFromStart / 1440) * 100;
}

/**
 * Calculates the comprehensive real-time state for each of the 4 global sessions.
 */
export function calculateSessionStates(
  now: Date,
  mode: SessionMode = "equities",
  userTimeZone?: string
): SessionState[] {
  const userTz = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  return MARKET_SESSIONS.map((def) => {
    const schedOpen = mode === "equities" ? def.equitiesOpen : def.forexOpen;
    const schedClose = mode === "equities" ? def.equitiesClose : def.forexClose;
    const exchangeLabel = mode === "equities" ? def.equitiesExchange : def.forexExchange;

    // Check exchange weekend in its own timezone
    const exchangeWeekday = new Intl.DateTimeFormat("en-US", {
      timeZone: def.timeZone,
      weekday: "short",
    }).format(now);
    const isWeekend = exchangeWeekday === "Sat" || exchangeWeekday === "Sun";

    // Session times today in UTC
    const openUtc = getSessionUtcTime(now, def.timeZone, schedOpen.hour, schedOpen.minute);
    const closeUtc = getSessionUtcTime(now, def.timeZone, schedClose.hour, schedClose.minute);

    const isOpen =
      !isWeekend &&
      now.getTime() >= openUtc.getTime() &&
      now.getTime() < closeUtc.getTime();

    // City local time string e.g. "11:07 pm local"
    const cityTimeRaw = new Intl.DateTimeFormat("en-US", {
      timeZone: def.timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .format(now)
      .toLowerCase();
    const cityLocalTime = `${cityTimeRaw} local`;
    const cityTzAbbr = getTimeZoneAbbr(now, def.timeZone);

    // Converted user local open/close times
    const userLocalOpenStr = new Intl.DateTimeFormat("en-US", {
      timeZone: userTz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(openUtc);

    const userLocalCloseStr = new Intl.DateTimeFormat("en-US", {
      timeZone: userTz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(closeUtc);

    // Status & countdown
    let statusBadge: "OPEN" | "CLOSED" | "WEEKEND" = "CLOSED";
    let statusCountdown = "";

    if (isOpen) {
      statusBadge = "OPEN";
      statusCountdown = `Closes in ${formatDuration(closeUtc.getTime() - now.getTime())}`;
    } else if (isWeekend) {
      statusBadge = "WEEKEND";
      const nextOpen = getNextOpenUtc(now, def.timeZone, schedOpen.hour, schedOpen.minute);
      statusCountdown = `Opens in ${formatDuration(nextOpen.getTime() - now.getTime())}`;
    } else {
      statusBadge = "CLOSED";
      const nextOpen = getNextOpenUtc(now, def.timeZone, schedOpen.hour, schedOpen.minute);
      statusCountdown = `Opens in ${formatDuration(nextOpen.getTime() - now.getTime())}`;
    }

    // Timeline positions on 24h scale starting at TIMELINE_START_HOUR (7am)
    const startPct = dateToTimelinePct(openUtc, userTz);
    let endPct = dateToTimelinePct(closeUtc, userTz);
    if (endPct <= startPct) {
      endPct += 100;
    }
    const widthPct = Math.min(100 - startPct, endPct - startPct);

    return {
      def,
      isOpen,
      isWeekend,
      exchangeLabel,
      cityLocalTime,
      cityTzAbbr,
      userLocalOpenStr,
      userLocalCloseStr,
      statusBadge,
      statusCountdown,
      startPct,
      widthPct,
    };
  });
}
