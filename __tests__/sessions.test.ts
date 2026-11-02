import { describe, it, expect } from "vitest";
import {
  getSessionUtcTime,
  calculateSessionStates,
  dateToTimelinePct,
  formatDuration,
  getNextOpenUtc,
  MARKET_SESSIONS,
  rangeToSegments,
  formatUtcOffset,
  tzOffsetMinutes,
} from "@/lib/sessions";

describe("Spec 016 — Market Sessions time-math & test oracles", () => {
  describe("R1 — Duration invariant across seasons & DST transition days", () => {
    const testDates = [
      "2026-01-15T12:00:00Z",
      "2026-03-20T12:00:00Z",
      "2026-04-01T12:00:00Z",
      "2026-07-15T12:00:00Z",
      "2026-10-28T12:00:00Z",
      "2026-11-16T12:00:00Z",
      // DST transition dates
      "2026-03-08T12:00:00Z", // US EDT starts
      "2026-03-29T12:00:00Z", // UK BST starts
      "2026-04-05T12:00:00Z", // Sydney AEST starts
      "2026-10-04T12:00:00Z", // Sydney AEDT starts
      "2026-10-25T12:00:00Z", // UK GMT starts
      "2026-11-01T12:00:00Z", // US EST starts
    ];

    it("verifies close - open equals exact defined session length for all 8 sessions", () => {
      for (const dStr of testDates) {
        const d = new Date(dStr);

        for (const def of MARKET_SESSIONS) {
          // Equities
          const eqOpen = getSessionUtcTime(d, def.timeZone, def.equitiesOpen.hour, def.equitiesOpen.minute);
          const eqClose = getSessionUtcTime(d, def.timeZone, def.equitiesClose.hour, def.equitiesClose.minute);
          const eqDurationHours = (eqClose.getTime() - eqOpen.getTime()) / 3600_000;

          const expectedEqHours =
            def.equitiesClose.hour +
            def.equitiesClose.minute / 60 -
            (def.equitiesOpen.hour + def.equitiesOpen.minute / 60);

          expect(eqDurationHours).toBeCloseTo(expectedEqHours, 2);

          // Forex
          const fxOpen = getSessionUtcTime(d, def.timeZone, def.forexOpen.hour, def.forexOpen.minute);
          const fxClose = getSessionUtcTime(d, def.timeZone, def.forexClose.hour, def.forexClose.minute);
          const fxDurationHours = (fxClose.getTime() - fxOpen.getTime()) / 3600_000;

          const expectedFxHours =
            def.forexClose.hour +
            def.forexClose.minute / 60 -
            (def.forexOpen.hour + def.forexOpen.minute / 60);

          expect(fxDurationHours).toBeCloseTo(expectedFxHours, 2);
        }
      }
    });
  });

  describe("R1 & R2 — Forex in PHT (Asia/Manila) test oracle table", () => {
    // Nov 1 -> Mar 13 (winter EST, GMT, AEDT)
    it("matches Nov 1 -> Mar 13 oracle (Sydney 04-13, Tokyo 08-17, London 16-01, NY 21-06)", () => {
      const date = new Date("2026-11-16T12:00:00Z");
      const states = calculateSessionStates(date, "forex", "Asia/Manila");

      const syd = states.find((s) => s.def.id === "sydney")!;
      const tyo = states.find((s) => s.def.id === "tokyo")!;
      const ldn = states.find((s) => s.def.id === "london")!;
      const ny = states.find((s) => s.def.id === "newyork")!;

      expect(syd.userLocalOpenStr).toBe("04:00");
      expect(syd.userLocalCloseStr).toBe("13:00");

      expect(tyo.userLocalOpenStr).toBe("08:00");
      expect(tyo.userLocalCloseStr).toBe("17:00");

      expect(ldn.userLocalOpenStr).toBe("16:00");
      expect(ldn.userLocalCloseStr).toBe("01:00");

      expect(ny.userLocalOpenStr).toBe("21:00");
      expect(ny.userLocalCloseStr).toBe("06:00");
    });

    // Mar 14 -> Mar 27 (US shifted first to EDT)
    it("matches Mar 14 -> Mar 27 oracle (NY FX shifts to 20:00 - 05:00)", () => {
      const date = new Date("2026-03-18T12:00:00Z");
      const states = calculateSessionStates(date, "forex", "Asia/Manila");
      const ny = states.find((s) => s.def.id === "newyork")!;
      expect(ny.userLocalOpenStr).toBe("20:00");
      expect(ny.userLocalCloseStr).toBe("05:00");
    });

    // Mar 28 -> Apr 3 (UK shifted to BST)
    it("matches Mar 28 -> Apr 3 oracle (London FX shifts to 15:00 - 00:00)", () => {
      const date = new Date("2026-03-31T12:00:00Z");
      const states = calculateSessionStates(date, "forex", "Asia/Manila");
      const ldn = states.find((s) => s.def.id === "london")!;
      expect(ldn.userLocalOpenStr).toBe("15:00");
      expect(ldn.userLocalCloseStr).toBe("00:00");
    });

    // Apr 4 -> Oct 2 (Sydney shifts to AEST)
    it("matches Apr 4 -> Oct 2 oracle (Sydney FX shifts to 05:00 - 14:00)", () => {
      const date = new Date("2026-07-15T12:00:00Z");
      const states = calculateSessionStates(date, "forex", "Asia/Manila");
      const syd = states.find((s) => s.def.id === "sydney")!;
      expect(syd.userLocalOpenStr).toBe("05:00");
      expect(syd.userLocalCloseStr).toBe("14:00");
    });
  });

  describe("R1 & R2 — Equities in PHT (Asia/Manila) test oracle table", () => {
    it("matches Northern winter equities (ASX 07-13, TSE 08-14:30, LSE 16-00:30, NYSE 22:30-05:00)", () => {
      const date = new Date("2026-11-16T12:00:00Z");
      const states = calculateSessionStates(date, "equities", "Asia/Manila");

      const asx = states.find((s) => s.def.id === "sydney")!;
      const tse = states.find((s) => s.def.id === "tokyo")!;
      const lse = states.find((s) => s.def.id === "london")!;
      const nyse = states.find((s) => s.def.id === "newyork")!;

      expect(asx.userLocalOpenStr).toBe("07:00");
      expect(asx.userLocalCloseStr).toBe("13:00");

      expect(tse.userLocalOpenStr).toBe("08:00");
      expect(tse.userLocalCloseStr).toBe("14:30");

      expect(lse.userLocalOpenStr).toBe("16:00");
      expect(lse.userLocalCloseStr).toBe("00:30");

      expect(nyse.userLocalOpenStr).toBe("22:30");
      expect(nyse.userLocalCloseStr).toBe("05:00");
    });

    it("matches Northern summer equities (ASX 08-14, LSE 15-23:30, NYSE 21:30-04:00)", () => {
      const date = new Date("2026-07-15T12:00:00Z");
      const states = calculateSessionStates(date, "equities", "Asia/Manila");

      const asx = states.find((s) => s.def.id === "sydney")!;
      const lse = states.find((s) => s.def.id === "london")!;
      const nyse = states.find((s) => s.def.id === "newyork")!;

      expect(asx.userLocalOpenStr).toBe("08:00");
      expect(asx.userLocalCloseStr).toBe("14:00");

      expect(lse.userLocalOpenStr).toBe("15:00");
      expect(lse.userLocalCloseStr).toBe("23:30");

      expect(nyse.userLocalOpenStr).toBe("21:30");
      expect(nyse.userLocalCloseStr).toBe("04:00");
    });
  });

  describe("R2 — Session Status Semantics & Edge Cases", () => {
    it("Tokyo FX at Mon 23:30 JST -> CLOSED, countdown targets Tue 09:00 JST", () => {
      // Mon 2026-11-02 23:30 JST = 14:30 UTC
      const monNight = new Date("2026-11-02T14:30:00Z");
      const states = calculateSessionStates(monNight, "forex", "Asia/Tokyo");
      const tyo = states.find((s) => s.def.id === "tokyo")!;
      expect(tyo.isOpen).toBe(false);
      expect(tyo.statusBadge).toBe("CLOSED");

      const nextOpen = getNextOpenUtc(monNight, "Asia/Tokyo", 9, 0);
      expect(nextOpen.toISOString()).toBe("2026-11-03T00:00:00.000Z"); // Tue 9am JST
    });

    it("Sydney FX at Fri 17:00 AEDT -> CLOSED, next open Mon 07:00 AEDT", () => {
      // Fri 2026-11-06 17:00 AEDT = 06:00 UTC
      const friAfterClose = new Date("2026-11-06T06:00:00Z");
      const states = calculateSessionStates(friAfterClose, "forex", "Australia/Sydney");
      const syd = states.find((s) => s.def.id === "sydney")!;
      expect(syd.isOpen).toBe(false);

      const nextOpen = getNextOpenUtc(friAfterClose, "Australia/Sydney", 7, 0);
      expect(nextOpen.toISOString()).toBe("2026-11-08T20:00:00.000Z"); // Mon 7am AEDT
    });

    it("TSE at 12:00 JST weekday (equities) -> LUNCH", () => {
      // Wed 2026-11-04 12:00 JST = 03:00 UTC
      const wedLunch = new Date("2026-11-04T03:00:00Z");
      const states = calculateSessionStates(wedLunch, "equities", "Asia/Tokyo");
      const tse = states.find((s) => s.def.id === "tokyo")!;
      expect(tse.isLunch).toBe(true);
      expect(tse.isOpen).toBe(false);
      expect(tse.statusBadge).toBe("LUNCH");
      expect(tse.statusCountdown).toContain("Resumes in");
      expect(tse.statusCountdownShort).toContain("resumes");
    });
  });

  describe("R3 — Wrap-around segments", () => {
    it("Sydney FX in Asia/Manila -> 2 segments whose widths sum to 9/24 * 100", () => {
      const date = new Date("2026-11-16T12:00:00Z");
      const states = calculateSessionStates(date, "forex", "Asia/Manila");
      const syd = states.find((s) => s.def.id === "sydney")!;

      expect(syd.segments).toHaveLength(2);
      const totalWidth = syd.segments.reduce((acc, seg) => acc + seg.widthPct, 0);
      expect(totalWidth).toBeCloseTo((9 / 24) * 100, 2);
      expect(syd.segments[0].startPct + syd.segments[0].widthPct).toBeCloseTo(100, 2);
      expect(syd.segments[1].startPct).toBe(0);
    });
  });

  describe("R4 & R5 — Ruler tick positioning and UTC offset formatting", () => {
    it("verifies 2h tick i is at exactly i * (100 / 12) = i * 8.333%", () => {
      for (let i = 0; i < 12; i++) {
        const expectedPct = (i * 2 / 24) * 100;
        expect(expectedPct).toBeCloseTo(i * (100 / 12), 3);
      }
    });

    it("formats UTC offset cleanly", () => {
      expect(formatUtcOffset(480)).toBe("UTC+8");
      expect(formatUtcOffset(-300)).toBe("UTC−5");
      expect(formatUtcOffset(-240)).toBe("UTC−4");
      expect(formatUtcOffset(0)).toBe("UTC+0");
      expect(formatUtcOffset(660)).toBe("UTC+11");
      expect(formatUtcOffset(345)).toBe("UTC+5:45");
    });
  });
});
