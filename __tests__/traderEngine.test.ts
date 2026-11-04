import { describe, it, expect } from "vitest";
import { Candle } from "@/lib/types";
import { atr, rvol } from "@/lib/indicators";
import {
  STRATEGIES,
  computeStopAndTarget,
  detectStrategySignals,
  evaluateMtfCell,
  runTimeMachine,
} from "@/lib/traderEngine";

function generateSyntheticCandles(count: number, basePrice = 80000): Candle[] {
  const candles: Candle[] = [];
  let price = basePrice;
  const startSec = 1700000000;

  for (let i = 0; i < count; i++) {
    // Oscillating wave + breakout impulse so multiple strategies trigger deterministically
    const wave = Math.sin(i * 0.35) * (basePrice * 0.004);
    const drift = i % 25 === 0 ? basePrice * 0.008 : (i % 17 === 0 ? -basePrice * 0.007 : 0);
    const open = price;
    const close = Math.max(100, open + wave + drift);
    const high = Math.max(open, close) + basePrice * 0.003;
    const low = Math.min(open, close) - basePrice * 0.003;
    const volume = i % 10 === 0 ? 2500 : 1000 + (i % 5) * 120;

    candles.push({
      time: startSec + i * 3600,
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }
  return candles;
}

describe("ATR & RVOL indicators", () => {
  it("computes ATR(14) with nulls for the warmup window and positive values thereafter", () => {
    const candles = generateSyntheticCandles(40, 2700);
    const vals = atr(candles, 14);
    expect(vals.length).toBe(40);
    expect(vals.slice(0, 13).every((v) => v === null)).toBe(true);
    expect(vals[13]).not.toBeNull();
    expect(vals[39]!).toBeGreaterThan(0);
  });

  it("computes RVOL(20) accurately against the rolling volume average", () => {
    const candles = generateSyntheticCandles(30, 80000);
    const vals = rvol(candles, 20);
    expect(vals.length).toBe(30);
    expect(vals.slice(0, 19).every((v) => v === null)).toBe(true);
    expect(vals[19]).toBeGreaterThan(0);
  });
});

describe("Day Trader Engine — Stop/Target & Strategy Detection", () => {
  it("exposes all 6 Pine-style strategies including ICT AMD (Power of 3)", () => {
    expect(STRATEGIES.map((s) => s.id)).toEqual([
      "orb",
      "squeeze",
      "mean_rev",
      "flag",
      "sweep",
      "amd",
    ]);
  });

  it("detects a 3-phase Bullish AMD (Accumulation -> Manipulation Judas Swing -> Distribution Reclaim) setup", () => {
    const candles = generateSyntheticCandles(35, 2700);
    // Construct a tight 7-bar Accumulation box [23..29] around 2700..2708
    for (let j = 23; j <= 29; j++) {
      candles[j] = {
        time: candles[j].time,
        open: 2702,
        high: 2708,
        low: 2700,
        close: 2705,
        volume: 1000,
      };
    }
    // Bar 30: Manipulation (Judas Swing raids liquidity below 2700 down to 2688)
    candles[30] = {
      time: candles[30].time,
      open: 2702,
      high: 2703,
      low: 2688,
      close: 2694,
      volume: 1800,
    };
    // Bar 31: Distribution (Strong displacement body reclaims above Accumulation Low 2700 and prev.high 2703)
    candles[31] = {
      time: candles[31].time,
      open: 2694,
      high: 2714,
      low: 2693,
      close: 2712,
      volume: 2400,
    };

    const amdSignals = detectStrategySignals(candles, "XAU/USDT", "15m", "amd", 2.0);
    const triggered = amdSignals.find((s) => s.barIndex === 31);
    expect(triggered).toBeDefined();
    expect(triggered?.strategyId).toBe("amd");
    expect(triggered?.badge).toBe("AMD");
    expect(triggered?.direction).toBe("LONG");
    expect(triggered?.rationale).toContain("Bullish AMD");
  });

  it("scales target distance accurately by R-Multiple (1.5R, 2.0R, 3.0R)", () => {
    const candles = generateSyntheticCandles(35, 85000);
    const res2R = computeStopAndTarget(candles, 30, "LONG", 400, 2.0);
    const risk2R = res2R.entryPrice - res2R.stopPrice;
    const reward2R = res2R.targetPrice - res2R.entryPrice;
    expect(risk2R).toBeGreaterThan(0);
    expect(reward2R / risk2R).toBeCloseTo(2.0, 5);

    const res3R = computeStopAndTarget(candles, 30, "SHORT", 400, 3.0);
    const risk3R = res3R.stopPrice - res3R.entryPrice;
    const reward3R = res3R.entryPrice - res3R.targetPrice;
    expect(risk3R).toBeGreaterThan(0);
    expect(reward3R / risk3R).toBeCloseTo(3.0, 5);
  });

  it("detects signals and evaluates MTF cells for BTC/USDT and XAU/USDT", () => {
    const candles = generateSyntheticCandles(140, 82000);
    const signals = detectStrategySignals(candles, "BTC/USDT", "15m", "all", 2.0);
    expect(signals.length).toBeGreaterThan(0);

    for (const sig of signals) {
      expect(sig.symbol).toBe("BTC/USDT");
      expect(sig.timeframe).toBe("15m");
      expect(sig.confidence).toBeGreaterThanOrEqual(55);
      expect(sig.confidence).toBeLessThanOrEqual(99);
      if (sig.direction === "LONG") {
        expect(sig.targetPrice).toBeGreaterThan(sig.entryPrice);
        expect(sig.stopPrice).toBeLessThan(sig.entryPrice);
      } else {
        expect(sig.targetPrice).toBeLessThan(sig.entryPrice);
        expect(sig.stopPrice).toBeGreaterThan(sig.entryPrice);
      }
    }

    const cell = evaluateMtfCell(candles, "XAU/USDT", "1h", "all", 2.0);
    expect(cell.symbol).toBe("XAU/USDT");
    expect(["BULL", "BEAR", "NEUTRAL"]).toContain(cell.bias);
    expect(cell.rsi).not.toBeNull();
  });
});

describe("Hybrid Time Machine Simulator", () => {
  it("computes deterministic backtest metrics, pattern analogs, and 2,500 Monte Carlo paths", () => {
    const candles = generateSyntheticCandles(160, 2650);
    const tm1 = runTimeMachine(candles, "XAU/USDT", "15m", "all", 2.0, 24);
    const tm2 = runTimeMachine(candles, "XAU/USDT", "15m", "all", 2.0, 24);

    // Deterministic across identical inputs
    expect(tm1.combinedWinOdds).toBe(tm2.combinedWinOdds);
    expect(tm1.monteCarlo.tpHitPct).toBe(tm2.monteCarlo.tpHitPct);
    expect(tm1.monteCarlo.p50Price).toBe(tm2.monteCarlo.p50Price);

    // Valid probability bounds
    expect(tm1.combinedWinOdds).toBeGreaterThanOrEqual(15);
    expect(tm1.combinedWinOdds).toBeLessThanOrEqual(92);
    expect(tm1.monteCarlo.paths).toBe(2500);
    expect(
      tm1.monteCarlo.tpHitPct + tm1.monteCarlo.slHitPct + tm1.monteCarlo.timeoutPct
    ).toBeCloseTo(100, 0);
    expect(tm1.monteCarlo.p10Price).toBeLessThanOrEqual(tm1.monteCarlo.p50Price);
    expect(tm1.monteCarlo.p50Price).toBeLessThanOrEqual(tm1.monteCarlo.p90Price);
    expect(tm1.analogs.matchCount).toBeGreaterThan(0);
  });

  it("handles a targetSetup whose barIndex came from a longer candle slice without throwing", () => {
    const longSlice = generateSyntheticCandles(250, 2650);
    const shortSlice = longSlice.slice(-150);
    const sigs = detectStrategySignals(longSlice, "XAU/USDT", "15m", "all", 2.0);
    const staleSetup = {
      ...(sigs[sigs.length - 1] ?? {
        id: "test",
        symbol: "XAU/USDT",
        timeframe: "15m",
        strategyId: "orb" as const,
        strategyName: "ORB Breakout",
        badge: "ORB",
        direction: "LONG" as const,
        time: longSlice[248].time,
        barIndex: 248,
        entryPrice: 2650,
        stopPrice: 2630,
        targetPrice: 2690,
        rrRatio: 2.0,
        atrValue: 12,
        rvolValue: 1.5,
        rsiValue: 55,
        confidence: 80,
        rationale: "Test",
        isRecent: true,
        barsAgo: 1,
      }),
      barIndex: 248,
    };

    const res = runTimeMachine(shortSlice, "XAU/USDT", "15m", "all", 2.0, 24, staleSetup);
    expect(res.combinedWinOdds).toBeGreaterThanOrEqual(15);
    expect(res.monteCarlo.paths).toBe(2500);
  });
});
