import { describe, it, expect } from "vitest";
import {
  getSessionUtcTime,
  calculateSessionStates,
  dateToTimelinePct,
  formatDuration,
  getNextOpenUtc,
} from "@/lib/sessions";

describe("market sessions & DST calculations", () => {
  describe("getSessionUtcTime (Daylight Saving Time shifts)", () => {
    it("handles New York winter (EST, UTC-5) vs summer (EDT, UTC-4)", () => {
      // Winter: Nov 15, 2026 -> EST (UTC-5)
      const winterDate = new Date("2026-11-15T12:00:00Z");
      const nyWinterOpenUtc = getSessionUtcTime(winterDate, "America/New_York", 9, 30);
      // 9:30 AM EST = 14:30:00 UTC
      expect(nyWinterOpenUtc.getUTCHours()).toBe(14);
      expect(nyWinterOpenUtc.getUTCMinutes()).toBe(30);

      // Summer: July 15, 2026 -> EDT (UTC-4)
      const summerDate = new Date("2026-07-15T12:00:00Z");
      const nySummerOpenUtc = getSessionUtcTime(summerDate, "America/New_York", 9, 30);
      // 9:30 AM EDT = 13:30:00 UTC
      expect(nySummerOpenUtc.getUTCHours()).toBe(13);
      expect(nySummerOpenUtc.getUTCMinutes()).toBe(30);
    });

    it("handles London winter (GMT, UTC+0) vs summer (BST, UTC+1)", () => {
      // Winter: Nov 15, 2026 -> GMT (UTC+0)
      const winterDate = new Date("2026-11-15T12:00:00Z");
      const lonWinterOpenUtc = getSessionUtcTime(winterDate, "Europe/London", 8, 0);
      expect(lonWinterOpenUtc.getUTCHours()).toBe(8);
      expect(lonWinterOpenUtc.getUTCMinutes()).toBe(0);

      // Summer: July 15, 2026 -> BST (UTC+1)
      const summerDate = new Date("2026-07-15T12:00:00Z");
      const lonSummerOpenUtc = getSessionUtcTime(summerDate, "Europe/London", 8, 0);
      expect(lonSummerOpenUtc.getUTCHours()).toBe(7);
      expect(lonSummerOpenUtc.getUTCMinutes()).toBe(0);
    });

    it("handles Sydney summer (AEDT, UTC+11 in November) vs winter (AEST, UTC+10 in July)", () => {
      // November: Daylight saving in Australia -> AEDT (UTC+11)
      const novDate = new Date("2026-11-15T12:00:00Z");
      const sydNovOpenUtc = getSessionUtcTime(novDate, "Australia/Sydney", 10, 0);
      // 10:00 AM AEDT = 23:00 UTC previous day (10 - 11 = -1 -> 23)
      expect(sydNovOpenUtc.getUTCHours()).toBe(23);

      // July: Standard time -> AEST (UTC+10)
      const julDate = new Date("2026-07-15T12:00:00Z");
      const sydJulOpenUtc = getSessionUtcTime(julDate, "Australia/Sydney", 10, 0);
      // 10:00 AM AEST = 00:00 UTC (10 - 10 = 0)
      expect(sydJulOpenUtc.getUTCHours()).toBe(0);
    });
  });

  describe("calculateSessionStates (Viewer Local Time conversion)", () => {
    it("converts NY open to 10:30 PM in PHT (winter EST) and 9:30 PM in PHT (summer EDT)", () => {
      // Winter date
      const winterDate = new Date("2026-11-16T12:00:00Z"); // Monday
      const winterStates = calculateSessionStates(winterDate, "equities", "Asia/Manila");
      const nyWinter = winterStates.find((s) => s.def.id === "newyork")!;
      expect(nyWinter.userLocalOpenStr).toContain("10:30");

      // Summer date
      const summerDate = new Date("2026-07-15T12:00:00Z"); // Wednesday
      const summerStates = calculateSessionStates(summerDate, "equities", "Asia/Manila");
      const nySummer = summerStates.find((s) => s.def.id === "newyork")!;
      expect(nySummer.userLocalOpenStr).toContain("9:30");
    });

    it("flags open status accurately when currently within trading hours", () => {
      // 14:00 UTC on a Monday -> London (08:00 - 16:30 GMT) is active!
      const activeLondonDate = new Date("2026-11-16T14:00:00Z");
      const states = calculateSessionStates(activeLondonDate, "equities", "Asia/Manila");
      const london = states.find((s) => s.def.id === "london")!;
      expect(london.isOpen).toBe(true);
      expect(london.statusBadge).toBe("OPEN");
      expect(london.statusCountdown).toContain("Closes in");
    });
  });

  describe("dateToTimelinePct & formatDuration", () => {
    it("anchors 7:00 AM local time to 0% and 7:00 PM local time to 50%", () => {
      // Create dates with explicit hours in UTC
      const date7am = new Date("2026-11-16T07:00:00Z");
      const pct7am = dateToTimelinePct(date7am, "UTC");
      expect(pct7am).toBeCloseTo(0);

      const date7pm = new Date("2026-11-16T19:00:00Z");
      const pct7pm = dateToTimelinePct(date7pm, "UTC");
      expect(pct7pm).toBeCloseTo(50);
    });

    it("formats duration correctly into hours and minutes", () => {
      expect(formatDuration(0)).toBe("0m");
      expect(formatDuration(45 * 60 * 1000)).toBe("45m");
      expect(formatDuration((2 * 60 + 15) * 60 * 1000)).toBe("2h 15m");
    });
  });

  describe("getNextOpenUtc", () => {
    it("skips Saturday and Sunday to find Monday open", () => {
      // Saturday Nov 7, 2026
      const satDate = new Date("2026-11-07T12:00:00Z");
      const nextOpen = getNextOpenUtc(satDate, "America/New_York", 9, 30);
      // Monday Nov 9, 2026
      expect(nextOpen.getUTCDay()).toBe(1); // 1 = Monday
    });
  });
});
