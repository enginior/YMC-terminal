import { describe, it, expect } from "vitest";
import { sma, ema, rsi, macd, bollingerBands, stochRsi, cvd } from "@/lib/indicators";
import { Candle } from "@/lib/types";

function makeCandles(prices: number[]): Candle[] {
  return prices.map((p, idx) => ({
    time: 1700000000 + idx * 3600,
    open: p,
    high: p + 2,
    low: p - 2,
    close: p,
    volume: 1000,
  }));
}

describe("technical indicators", () => {
  describe("sma (Simple Moving Average)", () => {
    it("returns null for indices before period - 1", () => {
      const candles = makeCandles([10, 20, 30, 40, 50]);
      const res = sma(candles, 3);
      expect(res[0]).toBeNull();
      expect(res[1]).toBeNull();
      expect(res[2]).toBeCloseTo(20); // (10 + 20 + 30) / 3
      expect(res[3]).toBeCloseTo(30); // (20 + 30 + 40) / 3
      expect(res[4]).toBeCloseTo(40); // (30 + 40 + 50) / 3
    });

    it("handles data with fewer items than period", () => {
      const candles = makeCandles([10, 20]);
      const res = sma(candles, 5);
      expect(res).toEqual([null, null]);
    });
  });

  describe("ema (Exponential Moving Average)", () => {
    it("seeds with SMA at period - 1 and applies exponential weighting", () => {
      const candles = makeCandles([10, 20, 30, 40, 50]);
      const period = 3;
      const res = ema(candles, period);
      // multiplier = 2 / (3 + 1) = 0.5
      expect(res[0]).toBeNull();
      expect(res[1]).toBeNull();
      expect(res[2]).toBeCloseTo(20); // seed SMA = (10+20+30)/3 = 20
      // next: (40 - 20) * 0.5 + 20 = 30
      expect(res[3]).toBeCloseTo(30);
      // next: (50 - 30) * 0.5 + 30 = 40
      expect(res[4]).toBeCloseTo(40);
    });
  });

  describe("rsi (Relative Strength Index)", () => {
    it("pads nulls before period, bounds output between 0 and 100", () => {
      // 20 rising candles
      const prices = Array.from({ length: 25 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);
      const res = rsi(candles, 14);

      expect(res[0]).toBeNull();
      expect(res[13]).toBeNull();
      // Period is 14, so index 14 is the first calculated value
      expect(res[14]).not.toBeNull();
      expect(res[14]!).toBeGreaterThan(0);
      expect(res[14]!).toBeLessThanOrEqual(100);
      // Monotonically rising prices should produce high RSI (> 95)
      expect(res[14]!).toBeGreaterThan(95);
    });

    it("produces low RSI for declining prices", () => {
      const prices = Array.from({ length: 25 }, (_, i) => 200 - i * 3);
      const candles = makeCandles(prices);
      const res = rsi(candles, 14);
      expect(res[14]!).toBeLessThan(5);
    });
  });

  describe("macd", () => {
    it("computes macdLine, signalLine, and histogram", () => {
      const prices = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 10);
      const candles = makeCandles(prices);
      const { macdLine, signalLine, histogram } = macd(candles);

      expect(macdLine).toHaveLength(40);
      expect(signalLine).toHaveLength(40);
      expect(histogram).toHaveLength(40);

      // 26-period EMA requires 26 bars, so first 25 items of macdLine are null
      expect(macdLine[24]).toBeNull();
      expect(macdLine[25]).not.toBeNull();

      // Signal line needs 9 bars of macdLine
      const firstValidMacd = macdLine.findIndex((v) => v !== null);
      expect(signalLine[firstValidMacd + 7]).toBeNull();
      expect(signalLine[firstValidMacd + 8]).not.toBeNull();

      // Histogram is macdLine - signalLine
      const idx = firstValidMacd + 8;
      expect(histogram[idx]).toBeCloseTo(macdLine[idx]! - signalLine[idx]!);
    });
  });

  describe("bollingerBands", () => {
    it("computes middle SMA and upper/lower standard deviation bands", () => {
      const prices = Array.from({ length: 30 }, (_, i) => 50 + (i % 5) * 2);
      const candles = makeCandles(prices);
      const { upper, middle, lower } = bollingerBands(candles, 20, 2);

      expect(upper).toHaveLength(30);
      expect(middle).toHaveLength(30);
      expect(lower).toHaveLength(30);

      // Period is 20, so index 19 is first calculated band
      expect(middle[18]).toBeNull();
      expect(middle[19]).not.toBeNull();
      expect(upper[19]!).toBeGreaterThan(middle[19]!);
      expect(lower[19]!).toBeLessThan(middle[19]!);
      expect(upper[19]! - middle[19]!).toBeCloseTo(middle[19]! - lower[19]!);
    });
  });

  describe("stochRsi", () => {
    it("computes %K and %D bounded between 0 and 100", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 2) * 20);
      const candles = makeCandles(prices);
      const { k, d } = stochRsi(candles, 14, 14, 3, 3);

      expect(k).toHaveLength(50);
      expect(d).toHaveLength(50);

      const validK = k.filter((v): v is number => v !== null);
      const validD = d.filter((v): v is number => v !== null);
      expect(validK.length).toBeGreaterThan(0);
      expect(validD.length).toBeGreaterThan(0);

      validK.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      });
      validD.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("cvd (Cumulative Volume Delta)", () => {
    it("accumulates positive flow for bullish candles and negative flow for bearish candles", () => {
      const candles: Candle[] = [
        { time: 100, open: 100, high: 110, low: 90, close: 105, volume: 1000 }, // range=20, close-open=5 -> delta = (5/20)*1000 = +250, cum = 250
        { time: 101, open: 105, high: 115, low: 95, close: 95, volume: 2000 },  // range=20, close-open=-10 -> delta = (-10/20)*2000 = -1000, cum = -750
        { time: 102, open: 95, high: 105, low: 95, close: 105, volume: 500 },   // range=10, close-open=10 -> delta = (10/10)*500 = +500, cum = -250
      ];

      const res = cvd(candles);
      expect(res).toHaveLength(3);
      expect(res[0]).toBeCloseTo(250);
      expect(res[1]).toBeCloseTo(-750);
      expect(res[2]).toBeCloseTo(-250);
    });

    it("handles zero range candles safely without division by zero or NaN", () => {
      const flatCandles: Candle[] = [
        { time: 200, open: 100, high: 100, low: 100, close: 100, volume: 500 },
        { time: 201, open: 100, high: 105, low: 95, close: 105, volume: 100 }, // range=10, close-open=5 -> delta = (5/10)*100 = +50, cum = 50
      ];
      const res = cvd(flatCandles);
      expect(res).toHaveLength(2);
      expect(res[0]).toBe(0);
      expect(Number.isNaN(res[0])).toBe(false);
      expect(res[1]).toBeCloseTo(50);
    });

    it("returns empty array when candle data is empty", () => {
      expect(cvd([])).toEqual([]);
    });
  });
});
