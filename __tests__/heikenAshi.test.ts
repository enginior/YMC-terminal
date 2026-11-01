import { describe, it, expect } from "vitest";
import { heikenAshi } from "@/lib/heikenAshi";
import { Candle } from "@/lib/types";

describe("heikenAshi transform", () => {
  it("returns empty array when given empty candles", () => {
    expect(heikenAshi([])).toEqual([]);
  });

  it("calculates initial bar correctly from raw candle", () => {
    const raw: Candle[] = [
      {
        time: 1700000000,
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 5000,
      },
    ];

    const [ha] = heikenAshi(raw);
    // close = (100 + 110 + 95 + 105) / 4 = 102.5
    expect(ha.close).toBe(102.5);
    // first bar open = (100 + 105) / 2 = 102.5
    expect(ha.open).toBe(102.5);
    // high = max(110, 102.5, 102.5) = 110
    expect(ha.high).toBe(110);
    // low = min(95, 102.5, 102.5) = 95
    expect(ha.low).toBe(95);
    expect(ha.time).toBe(1700000000);
    expect(ha.volume).toBe(5000);
  });

  it("smooths subsequent bars using previous Heikin open and close", () => {
    const raw: Candle[] = [
      { time: 1700000000, open: 100, high: 110, low: 95, close: 105, volume: 1000 },
      { time: 1700003600, open: 106, high: 115, low: 104, close: 112, volume: 2000 },
    ];

    const [ha1, ha2] = heikenAshi(raw);
    // ha1 open = 102.5, ha1 close = 102.5
    expect(ha1.open).toBe(102.5);
    expect(ha1.close).toBe(102.5);

    // ha2 open = (ha1.open + ha1.close) / 2 = (102.5 + 102.5) / 2 = 102.5
    expect(ha2.open).toBe(102.5);
    // ha2 close = (106 + 115 + 104 + 112) / 4 = 109.25
    expect(ha2.close).toBe(109.25);
    // ha2 high = max(115, 102.5, 109.25) = 115
    expect(ha2.high).toBe(115);
    // ha2 low = min(104, 102.5, 109.25) = 102.5 (smoothed low is clamped to open!)
    expect(ha2.low).toBe(102.5);
  });
});
