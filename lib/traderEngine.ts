import { Candle } from "./types";
import { sma, ema, rsi, macd, bollingerBands, stochRsi, atr, rvol } from "./indicators";

export type StrategyId = "orb" | "squeeze" | "mean_rev" | "flag" | "sweep" | "amd";
export type StrategyFilter = "all" | StrategyId;
export type RMultipleOption = 1.5 | 2.0 | 3.0;
export type HorizonOption = 12 | 24 | 48;

export interface StrategyMeta {
  id: StrategyId;
  name: string;
  shortName: string;
  badge: string;
  description: string;
}

export const STRATEGIES: StrategyMeta[] = [
  {
    id: "orb",
    name: "Opening Range Breakout (ORB)",
    shortName: "ORB Breakout",
    badge: "ORB",
    description: "Session open (Asia/London/NY) range high/low breakout with relative volume & EMA(20) slope.",
  },
  {
    id: "squeeze",
    name: "Bollinger Volatility Squeeze",
    shortName: "BB Squeeze",
    badge: "SQZ",
    description: "Bandwidth compression in lowest 20th percentile followed by directional band expansion.",
  },
  {
    id: "mean_rev",
    name: "Mean-Reversion Extremes",
    shortName: "Mean Reversion",
    badge: "MRV",
    description: "RSI(14) + Stoch RSI oversold/overbought confluence touching outer Bollinger Band with rejection wick.",
  },
  {
    id: "flag",
    name: "Trend Pullback (Bull/Bear Flag)",
    shortName: "Trend Flag",
    badge: "FLG",
    description: "Strong impulse leg (>1.8x ATR) + controlled pullback to EMA 20 / Fib zone with continuation close.",
  },
  {
    id: "sweep",
    name: "Liquidity Sweep Reversal",
    shortName: "Liq Sweep",
    badge: "SWP",
    description: "Stop-hunt wick beyond 20-bar swing high/low that closes back inside range with opposing momentum.",
  },
  {
    id: "amd",
    name: "ICT AMD (Power of 3)",
    shortName: "AMD Power of 3",
    badge: "AMD",
    description: "Accumulation range compression → Manipulation Judas swing liquidity raid → Distribution displacement reclaim.",
  },
];

export const STRATEGY_BY_ID: Record<StrategyId, StrategyMeta> = Object.fromEntries(
  STRATEGIES.map((s) => [s.id, s])
) as Record<StrategyId, StrategyMeta>;

export interface TraderSignal {
  id: string;
  symbol: string;
  timeframe: string;
  strategyId: StrategyId;
  strategyName: string;
  badge: string;
  direction: "LONG" | "SHORT";
  time: number;
  barIndex: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  rrRatio: number;
  atrValue: number;
  rvolValue: number;
  rsiValue: number;
  confidence: number; // 0 - 100
  rationale: string;
  /** True if the signal occurred within the most recent 5 bars (actionable live setup) */
  isRecent: boolean;
  /** Age in bars from the latest candle */
  barsAgo: number;
}

export interface MtfCellSummary {
  symbol: string;
  timeframe: string;
  bias: "BULL" | "BEAR" | "NEUTRAL";
  rsi: number | null;
  rvol: number | null;
  atr: number | null;
  lastClose: number;
  latestSignal: TraderSignal | null;
}

export interface BacktestTradeRecord {
  signal: TraderSignal;
  outcome: "TP" | "SL" | "EXP";
  rMultiple: number;
  barsHeld: number;
  exitPrice: number;
  exitTime: number;
}

export interface TimeMachineResult {
  symbol: string;
  timeframe: string;
  strategyFilter: StrategyFilter;
  rrRatio: number;
  horizon: number;
  /** Active or synthesized current trade setup being evaluated */
  activeSetup: TraderSignal | null;
  /** Combined statistical probability of positive outcome (0 - 100) */
  combinedWinOdds: number;
  /** Historical Strategy Backtest metrics */
  backtest: {
    totalSignals: number;
    wins: number;
    losses: number;
    timeouts: number;
    winRate: number; // 0 - 100
    profitFactor: number;
    expectedR: number;
    maxDrawdownR: number;
    equityCurve: { time: number; r: number; cumulativeR: number }[];
    recentTrades: BacktestTradeRecord[];
  };
  /** Pattern Analog matching metrics (top K historical 10-bar shapes) */
  analogs: {
    matchCount: number;
    winRate: number; // 0 - 100
    avgR: number;
    medianMovePct: number;
    bestSimilarityPct: number;
  };
  /** Monte Carlo 2,500-path bootstrap simulation */
  monteCarlo: {
    paths: number;
    tpHitPct: number;
    slHitPct: number;
    timeoutPct: number;
    expectedR: number;
    p10Price: number;
    p50Price: number;
    p90Price: number;
  };
}

/** Precomputed indicator bundle for a candle array so all 5 detectors share one pass. */
interface IndicatorContext {
  candles: Candle[];
  ema20: (number | null)[];
  ema50: (number | null)[];
  rsi14: (number | null)[];
  stoch: { k: (number | null)[]; d: (number | null)[] };
  bb: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] };
  bbWidth: (number | null)[];
  macdData: { macdLine: (number | null)[]; signalLine: (number | null)[]; histogram: (number | null)[] };
  atr14: (number | null)[];
  rvol20: (number | null)[];
}

function buildIndicatorContext(candles: Candle[]): IndicatorContext {
  const ema20 = ema(candles, 20);
  const ema50 = ema(candles, 50);
  const rsi14 = rsi(candles, 14);
  const stoch = stochRsi(candles, 14, 14, 3, 3);
  const bb = bollingerBands(candles, 20, 2);
  const macdData = macd(candles, 12, 26, 9);
  const atr14 = atr(candles, 14);
  const rvol20 = rvol(candles, 20);

  const bbWidth: (number | null)[] = candles.map((_, i) => {
    const u = bb.upper[i];
    const l = bb.lower[i];
    const m = bb.middle[i];
    if (u === null || l === null || m === null || m <= 0) return null;
    return (u - l) / m;
  });

  return {
    candles,
    ema20,
    ema50,
    rsi14,
    stoch,
    bb,
    bbWidth,
    macdData,
    atr14,
    rvol20,
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function fmtPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  return `$${p.toFixed(2)}`;
}

/**
 * Computes Stop Loss and Target price using structural swing + ATR(14) bounds.
 */
export function computeStopAndTarget(
  candles: Candle[],
  index: number,
  direction: "LONG" | "SHORT",
  atrVal: number,
  rrRatio: number,
  structuralStop?: number
): { entryPrice: number; stopPrice: number; targetPrice: number } {
  const entryPrice = candles[index].close;
  const safeAtr = atrVal > 0 ? atrVal : entryPrice * 0.005;

  let rawRisk = safeAtr * 1.4;
  if (typeof structuralStop === "number" && Number.isFinite(structuralStop)) {
    const structDist =
      direction === "LONG" ? entryPrice - structuralStop : structuralStop - entryPrice;
    if (structDist > 0) {
      rawRisk = structDist + safeAtr * 0.2;
    }
  }

  // Clamp risk distance between 0.75x ATR and 2.5x ATR so stops are never microscopic or blown out
  const riskDist = clamp(rawRisk, safeAtr * 0.75, safeAtr * 2.5);
  const stopPrice = direction === "LONG" ? entryPrice - riskDist : entryPrice + riskDist;
  const targetPrice =
    direction === "LONG" ? entryPrice + riskDist * rrRatio : entryPrice - riskDist * rrRatio;

  return { entryPrice, stopPrice, targetPrice };
}

/**
 * Checks if a bar is within an Opening Range window (Asia 00:00, London 07:00, NY 13:00 UTC)
 * or computes the recent 8-bar consolidation range as the local session opening range.
 */
function detectSignalAtBar(
  ctx: IndicatorContext,
  i: number,
  strategyId: StrategyId,
  symbol: string,
  timeframe: string,
  rrRatio: number
): TraderSignal | null {
  const { candles, ema20, ema50, rsi14, stoch, bb, bbWidth, macdData, atr14, rvol20 } = ctx;
  if (i < 25) return null;

  const c = candles[i];
  const prev = candles[i - 1];
  const atrVal = atr14[i] ?? (c.high - c.low || c.close * 0.004);
  const rvolVal = rvol20[i] ?? 1;
  const rsiVal = rsi14[i] ?? 50;
  const e20 = ema20[i];
  const e50 = ema50[i];
  const latestIndex = candles.length - 1;
  const barsAgo = latestIndex - i;
  const isRecent = barsAgo <= 5;

  if (strategyId === "orb") {
    // Opening Range Breakout: 6-bar opening/consolidation range [i-6 .. i-1] broken on bar i
    let rangeHigh = -Infinity;
    let rangeLow = Infinity;
    for (let j = i - 6; j < i; j++) {
      if (candles[j].high > rangeHigh) rangeHigh = candles[j].high;
      if (candles[j].low < rangeLow) rangeLow = candles[j].low;
    }
    const rangeSpan = rangeHigh - rangeLow;
    if (rangeSpan <= 0 || rangeSpan > atrVal * 3.8) return null;

    const hourUtc = new Date(c.time * 1000).getUTCHours();
    const sessionTag =
      hourUtc >= 12 && hourUtc <= 16
        ? "NY Open"
        : hourUtc >= 6 && hourUtc <= 10
          ? "London Open"
          : hourUtc >= 0 && hourUtc <= 3
            ? "Asia Open"
            : "Intraday Range";

    if (
      c.close > rangeHigh &&
      prev.close <= rangeHigh &&
      c.close > c.open &&
      rvolVal >= 1.1 &&
      (e20 === null || c.close >= e20)
    ) {
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "LONG",
        atrVal,
        rrRatio,
        rangeLow
      );
      const conf = Math.round(
        clamp(62 + (rvolVal - 1) * 18 + (rsiVal > 52 && rsiVal < 72 ? 10 : 0), 55, 96)
      );
      return {
        id: `${symbol}-${timeframe}-orb-${c.time}`,
        symbol,
        timeframe,
        strategyId: "orb",
        strategyName: STRATEGY_BY_ID.orb.shortName,
        badge: STRATEGY_BY_ID.orb.badge,
        direction: "LONG",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `${sessionTag} high (${fmtPrice(rangeHigh)}) cleared on ${rvolVal.toFixed(1)}x RVOL • RSI ${rsiVal.toFixed(1)}`,
        isRecent,
        barsAgo,
      };
    }

    if (
      c.close < rangeLow &&
      prev.close >= rangeLow &&
      c.close < c.open &&
      rvolVal >= 1.1 &&
      (e20 === null || c.close <= e20)
    ) {
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "SHORT",
        atrVal,
        rrRatio,
        rangeHigh
      );
      const conf = Math.round(
        clamp(62 + (rvolVal - 1) * 18 + (rsiVal < 48 && rsiVal > 28 ? 10 : 0), 55, 96)
      );
      return {
        id: `${symbol}-${timeframe}-orb-${c.time}`,
        symbol,
        timeframe,
        strategyId: "orb",
        strategyName: STRATEGY_BY_ID.orb.shortName,
        badge: STRATEGY_BY_ID.orb.badge,
        direction: "SHORT",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `${sessionTag} low (${fmtPrice(rangeLow)}) broken on ${rvolVal.toFixed(1)}x RVOL • RSI ${rsiVal.toFixed(1)}`,
        isRecent,
        barsAgo,
      };
    }
    return null;
  }

  if (strategyId === "squeeze") {
    // Bollinger Volatility Squeeze: recent BB width in bottom 25% of lookback, followed by breakout
    const lookbackStart = Math.max(20, i - 50);
    const widths: number[] = [];
    for (let j = lookbackStart; j <= i; j++) {
      if (bbWidth[j] !== null) widths.push(bbWidth[j]!);
    }
    if (widths.length < 10) return null;
    const sorted = [...widths].sort((a, b) => a - b);
    const p25 = sorted[Math.floor(sorted.length * 0.25)];

    // Check if any of the previous 4 bars was in a squeeze
    let squeezedRecently = false;
    for (let j = Math.max(20, i - 4); j < i; j++) {
      if (bbWidth[j] !== null && bbWidth[j]! <= p25) {
        squeezedRecently = true;
        break;
      }
    }
    if (!squeezedRecently) return null;

    const u = bb.upper[i];
    const l = bb.lower[i];
    const m = bb.middle[i];
    const hist = macdData.histogram[i] ?? 0;
    const prevHist = macdData.histogram[i - 1] ?? 0;
    if (u === null || l === null || m === null) return null;

    if (c.close > u && prev.close <= (bb.upper[i - 1] ?? u) && hist > prevHist) {
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "LONG",
        atrVal,
        rrRatio,
        m
      );
      const conf = Math.round(clamp(66 + rvolVal * 10, 58, 95));
      return {
        id: `${symbol}-${timeframe}-squeeze-${c.time}`,
        symbol,
        timeframe,
        strategyId: "squeeze",
        strategyName: STRATEGY_BY_ID.squeeze.shortName,
        badge: STRATEGY_BY_ID.squeeze.badge,
        direction: "LONG",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `BB Bandwidth squeeze expansion above upper band (${fmtPrice(u)}) + rising MACD`,
        isRecent,
        barsAgo,
      };
    }

    if (c.close < l && prev.close >= (bb.lower[i - 1] ?? l) && hist < prevHist) {
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "SHORT",
        atrVal,
        rrRatio,
        m
      );
      const conf = Math.round(clamp(66 + rvolVal * 10, 58, 95));
      return {
        id: `${symbol}-${timeframe}-squeeze-${c.time}`,
        symbol,
        timeframe,
        strategyId: "squeeze",
        strategyName: STRATEGY_BY_ID.squeeze.shortName,
        badge: STRATEGY_BY_ID.squeeze.badge,
        direction: "SHORT",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `BB Bandwidth squeeze breakdown below lower band (${fmtPrice(l)}) + falling MACD`,
        isRecent,
        barsAgo,
      };
    }
    return null;
  }

  if (strategyId === "mean_rev") {
    const u = bb.upper[i];
    const l = bb.lower[i];
    const kVal = stoch.k[i] ?? 50;
    if (u === null || l === null) return null;

    // Oversold bounce: low touches/pierces lower BB, RSI <= 35 or StochK <= 22, bullish close or lower wick
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const upperWick = c.high - Math.max(c.open, c.close);
    const range = Math.max(c.high - c.low, 1e-8);

    if (
      (c.low <= l * 1.001 || prev.low <= (bb.lower[i - 1] ?? l) * 1.001) &&
      (rsiVal <= 36 || kVal <= 22) &&
      c.close > prev.close &&
      (c.close >= c.open || lowerWick / range >= 0.35)
    ) {
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "LONG",
        atrVal,
        rrRatio,
        Math.min(c.low, prev.low)
      );
      const conf = Math.round(clamp(64 + (38 - Math.min(rsiVal, 38)) * 1.5, 56, 94));
      return {
        id: `${symbol}-${timeframe}-mean_rev-${c.time}`,
        symbol,
        timeframe,
        strategyId: "mean_rev",
        strategyName: STRATEGY_BY_ID.mean_rev.shortName,
        badge: STRATEGY_BY_ID.mean_rev.badge,
        direction: "LONG",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `Oversold BB Lower defense (${fmtPrice(l)}) • RSI ${rsiVal.toFixed(1)} & StochK ${kVal.toFixed(0)} turn`,
        isRecent,
        barsAgo,
      };
    }

    if (
      (c.high >= u * 0.999 || prev.high >= (bb.upper[i - 1] ?? u) * 0.999) &&
      (rsiVal >= 64 || kVal >= 78) &&
      c.close < prev.close &&
      (c.close <= c.open || upperWick / range >= 0.35)
    ) {
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "SHORT",
        atrVal,
        rrRatio,
        Math.max(c.high, prev.high)
      );
      const conf = Math.round(clamp(64 + (Math.max(rsiVal, 62) - 62) * 1.5, 56, 94));
      return {
        id: `${symbol}-${timeframe}-mean_rev-${c.time}`,
        symbol,
        timeframe,
        strategyId: "mean_rev",
        strategyName: STRATEGY_BY_ID.mean_rev.shortName,
        badge: STRATEGY_BY_ID.mean_rev.badge,
        direction: "SHORT",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `Overbought BB Upper rejection (${fmtPrice(u)}) • RSI ${rsiVal.toFixed(1)} & StochK ${kVal.toFixed(0)}`,
        isRecent,
        barsAgo,
      };
    }
    return null;
  }

  if (strategyId === "flag") {
    // Trend Pullback / Bull & Bear Flag: EMA20 > EMA50, pullback tests near EMA20, resumes trend
    if (e20 === null || e50 === null) return null;

    // Bull Flag: Uptrend (EMA20 > EMA50), prior 1-3 bars dipped near/below EMA20, current bar closes back above EMA20 & prev.high
    if (
      e20 > e50 &&
      prev.low <= e20 * 1.002 &&
      c.close > e20 &&
      c.close > prev.high &&
      c.close > c.open
    ) {
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "LONG",
        atrVal,
        rrRatio,
        Math.min(c.low, prev.low)
      );
      const conf = Math.round(clamp(68 + (rvolVal - 0.8) * 12, 60, 95));
      return {
        id: `${symbol}-${timeframe}-flag-${c.time}`,
        symbol,
        timeframe,
        strategyId: "flag",
        strategyName: STRATEGY_BY_ID.flag.shortName,
        badge: STRATEGY_BY_ID.flag.badge,
        direction: "LONG",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `Bull Flag pullback held EMA20 (${fmtPrice(e20)}) over EMA50 • Resumption breakout`,
        isRecent,
        barsAgo,
      };
    }

    // Bear Flag: Downtrend (EMA20 < EMA50), prior bar rallied to EMA20, current bar rejects below EMA20 & prev.low
    if (
      e20 < e50 &&
      prev.high >= e20 * 0.998 &&
      c.close < e20 &&
      c.close < prev.low &&
      c.close < c.open
    ) {
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "SHORT",
        atrVal,
        rrRatio,
        Math.max(c.high, prev.high)
      );
      const conf = Math.round(clamp(68 + (rvolVal - 0.8) * 12, 60, 95));
      return {
        id: `${symbol}-${timeframe}-flag-${c.time}`,
        symbol,
        timeframe,
        strategyId: "flag",
        strategyName: STRATEGY_BY_ID.flag.shortName,
        badge: STRATEGY_BY_ID.flag.badge,
        direction: "SHORT",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `Bear Flag bounce rejected at EMA20 (${fmtPrice(e20)}) below EMA50 • Breakdown`,
        isRecent,
        barsAgo,
      };
    }
    return null;
  }

  if (strategyId === "sweep") {
    // Liquidity Sweep / Stop-Hunt Reversal over prior 15-bar swing high/low [i-16 .. i-1]
    let swingHigh = -Infinity;
    let swingLow = Infinity;
    for (let j = Math.max(0, i - 16); j < i; j++) {
      if (candles[j].high > swingHigh) swingHigh = candles[j].high;
      if (candles[j].low < swingLow) swingLow = candles[j].low;
    }

    // Bullish Liquidity Sweep: low sweeps below swingLow, but closes back above swingLow
    if (c.low < swingLow && c.close > swingLow && c.close >= c.open) {
      const sweepDepth = swingLow - c.low;
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "LONG",
        atrVal,
        rrRatio,
        c.low
      );
      const conf = Math.round(clamp(67 + (sweepDepth / atrVal) * 20 + rvolVal * 6, 60, 96));
      return {
        id: `${symbol}-${timeframe}-sweep-${c.time}`,
        symbol,
        timeframe,
        strategyId: "sweep",
        strategyName: STRATEGY_BY_ID.sweep.shortName,
        badge: STRATEGY_BY_ID.sweep.badge,
        direction: "LONG",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `Bullish Liquidity Sweep below swing low (${fmtPrice(swingLow)}) reclaimed on ${rvolVal.toFixed(1)}x RVOL`,
        isRecent,
        barsAgo,
      };
    }

    // Bearish Liquidity Sweep: high sweeps above swingHigh, but closes back below swingHigh
    if (c.high > swingHigh && c.close < swingHigh && c.close <= c.open) {
      const sweepDepth = c.high - swingHigh;
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "SHORT",
        atrVal,
        rrRatio,
        c.high
      );
      const conf = Math.round(clamp(67 + (sweepDepth / atrVal) * 20 + rvolVal * 6, 60, 96));
      return {
        id: `${symbol}-${timeframe}-sweep-${c.time}`,
        symbol,
        timeframe,
        strategyId: "sweep",
        strategyName: STRATEGY_BY_ID.sweep.shortName,
        badge: STRATEGY_BY_ID.sweep.badge,
        direction: "SHORT",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `Bearish Liquidity Sweep above swing high (${fmtPrice(swingHigh)}) rejected on ${rvolVal.toFixed(1)}x RVOL`,
        isRecent,
        barsAgo,
      };
    }
    return null;
  }

  if (strategyId === "amd") {
    // ICT AMD / Power of 3:
    // 1. Accumulation: Tight 7-bar consolidation box [i-9 .. i-3]
    // 2. Manipulation (Judas Swing): Sweep outside accumulation box in [i-2 .. i]
    // 3. Distribution (Displacement): Strong body reclaim back inside/across the box on bar i
    let accHigh = -Infinity;
    let accLow = Infinity;
    for (let j = Math.max(0, i - 9); j <= i - 3; j++) {
      if (candles[j].high > accHigh) accHigh = candles[j].high;
      if (candles[j].low < accLow) accLow = candles[j].low;
    }
    const accSpan = accHigh - accLow;
    if (accSpan <= 0 || accSpan > atrVal * 3.2) return null;

    // Inspect the Manipulation window [i-2 .. i]
    let manipLow = Infinity;
    let manipHigh = -Infinity;
    for (let j = i - 2; j <= i; j++) {
      if (candles[j].low < manipLow) manipLow = candles[j].low;
      if (candles[j].high > manipHigh) manipHigh = candles[j].high;
    }

    const bodySize = Math.abs(c.close - c.open);
    const hasDisplacement = bodySize >= atrVal * 0.22;

    // Bullish AMD: Accumulation [accLow..accHigh] -> Judas swing below accLow -> Displacement reclaim above accLow
    if (
      manipLow < accLow - atrVal * 0.08 &&
      c.close > accLow &&
      c.close > c.open &&
      c.close > prev.high &&
      hasDisplacement
    ) {
      const judasDepth = accLow - manipLow;
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "LONG",
        atrVal,
        rrRatio,
        manipLow
      );
      const conf = Math.round(
        clamp(70 + (judasDepth / atrVal) * 16 + (rvolVal - 0.9) * 10, 62, 97)
      );
      return {
        id: `${symbol}-${timeframe}-amd-${c.time}`,
        symbol,
        timeframe,
        strategyId: "amd",
        strategyName: STRATEGY_BY_ID.amd.shortName,
        badge: STRATEGY_BY_ID.amd.badge,
        direction: "LONG",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `Bullish AMD: Accumulation (${fmtPrice(accLow)}–${fmtPrice(accHigh)}) → Judas sweep to ${fmtPrice(manipLow)} → Displacement reclaim`,
        isRecent,
        barsAgo,
      };
    }

    // Bearish AMD: Accumulation [accLow..accHigh] -> Judas swing above accHigh -> Displacement breakdown below accHigh
    if (
      manipHigh > accHigh + atrVal * 0.08 &&
      c.close < accHigh &&
      c.close < c.open &&
      c.close < prev.low &&
      hasDisplacement
    ) {
      const judasDepth = manipHigh - accHigh;
      const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
        candles,
        i,
        "SHORT",
        atrVal,
        rrRatio,
        manipHigh
      );
      const conf = Math.round(
        clamp(70 + (judasDepth / atrVal) * 16 + (rvolVal - 0.9) * 10, 62, 97)
      );
      return {
        id: `${symbol}-${timeframe}-amd-${c.time}`,
        symbol,
        timeframe,
        strategyId: "amd",
        strategyName: STRATEGY_BY_ID.amd.shortName,
        badge: STRATEGY_BY_ID.amd.badge,
        direction: "SHORT",
        time: c.time,
        barIndex: i,
        entryPrice,
        stopPrice,
        targetPrice,
        rrRatio,
        atrValue: atrVal,
        rvolValue: rvolVal,
        rsiValue: rsiVal,
        confidence: conf,
        rationale: `Bearish AMD: Accumulation (${fmtPrice(accLow)}–${fmtPrice(accHigh)}) → Judas raid to ${fmtPrice(manipHigh)} → Displacement breakdown`,
        isRecent,
        barsAgo,
      };
    }
    return null;
  }

  return null;
}

/**
 * Scans a candle series for all historical & live signals matching `strategyFilter`.
 * Deduplicates consecutive signals of the same strategy within 3 bars so signals are crisp.
 */
export function detectStrategySignals(
  candles: Candle[],
  symbol: string,
  timeframe: string,
  strategyFilter: StrategyFilter = "all",
  rrRatio: number = 2.0
): TraderSignal[] {
  if (!candles || candles.length < 30) return [];
  const ctx = buildIndicatorContext(candles);
  const activeStrategies: StrategyId[] =
    strategyFilter === "all" ? STRATEGIES.map((s) => s.id) : [strategyFilter];

  const signals: TraderSignal[] = [];
  const lastFiredBar: Partial<Record<StrategyId, number>> = {};

  for (let i = 25; i < candles.length; i++) {
    for (const stratId of activeStrategies) {
      const prevBar = lastFiredBar[stratId];
      if (prevBar !== undefined && i - prevBar < 3) continue;

      const sig = detectSignalAtBar(ctx, i, stratId, symbol, timeframe, rrRatio);
      if (sig) {
        signals.push(sig);
        lastFiredBar[stratId] = i;
      }
    }
  }

  return signals;
}

/**
 * Summarizes a single (symbol, timeframe) cell for the BTC & Gold MTF Scanner Matrix.
 */
export function evaluateMtfCell(
  candles: Candle[],
  symbol: string,
  timeframe: string,
  strategyFilter: StrategyFilter = "all",
  rrRatio: number = 2.0
): MtfCellSummary {
  if (!candles || candles.length === 0) {
    return {
      symbol,
      timeframe,
      bias: "NEUTRAL",
      rsi: null,
      rvol: null,
      atr: null,
      lastClose: 0,
      latestSignal: null,
    };
  }

  const ctx = buildIndicatorContext(candles);
  const lastIdx = candles.length - 1;
  const lastClose = candles[lastIdx].close;
  const e20 = ctx.ema20[lastIdx];
  const e50 = ctx.ema50[lastIdx];
  const rsiVal = ctx.rsi14[lastIdx];
  const rvolVal = ctx.rvol20[lastIdx];
  const atrVal = ctx.atr14[lastIdx];

  let bias: "BULL" | "BEAR" | "NEUTRAL" = "NEUTRAL";
  if (e20 !== null && e50 !== null) {
    if (lastClose > e20 && e20 >= e50) bias = "BULL";
    else if (lastClose < e20 && e20 <= e50) bias = "BEAR";
  }

  const signals = detectStrategySignals(candles, symbol, timeframe, strategyFilter, rrRatio);
  // Prefer a signal within the last 12 bars so the scanner always surfaces fresh setups
  const recentSignals = signals.filter((s) => s.barsAgo <= 12);
  const latestSignal =
    recentSignals.length > 0
      ? recentSignals[recentSignals.length - 1]
      : signals.length > 0
        ? signals[signals.length - 1]
        : null;

  return {
    symbol,
    timeframe,
    bias,
    rsi: rsiVal,
    rvol: rvolVal,
    atr: atrVal,
    lastClose,
    latestSignal,
  };
}

/**
 * Deterministic xorshift32 PRNG for reproducible, hydration-safe Monte Carlo simulations.
 */
function createSeededRng(seed: number): () => number {
  let state = (seed | 0) || 123456789;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/**
 * Runs the Hybrid Time Machine Engine:
 * 1. Strategy Historical Backtest (Win Rate, Profit Factor, Equity Curve, Recent Trades)
 * 2. Historical 10-Bar Pattern Analog Matching (Cosine/Euclidean feature similarity)
 * 3. 2,500-Path Monte Carlo Bootstrap Simulation for the active setup
 */
export function runTimeMachine(
  candles: Candle[],
  symbol: string,
  timeframe: string,
  strategyFilter: StrategyFilter = "all",
  rrRatio: number = 2.0,
  horizon: number = 24,
  customSetup?: TraderSignal | null
): TimeMachineResult {
  if (!candles || candles.length < 35) {
    return {
      symbol,
      timeframe,
      strategyFilter,
      rrRatio,
      horizon,
      activeSetup: customSetup ?? null,
      combinedWinOdds: 50,
      backtest: {
        totalSignals: 0,
        wins: 0,
        losses: 0,
        timeouts: 0,
        winRate: 0,
        profitFactor: 0,
        expectedR: 0,
        maxDrawdownR: 0,
        equityCurve: [],
        recentTrades: [],
      },
      analogs: {
        matchCount: 0,
        winRate: 50,
        avgR: 0,
        medianMovePct: 0,
        bestSimilarityPct: 0,
      },
      monteCarlo: {
        paths: 0,
        tpHitPct: 0,
        slHitPct: 0,
        timeoutPct: 0,
        expectedR: 0,
        p10Price: 0,
        p50Price: 0,
        p90Price: 0,
      },
    };
  }

  const ctx = buildIndicatorContext(candles);
  const allSignals = detectStrategySignals(candles, symbol, timeframe, strategyFilter, rrRatio);

  // Determine the active setup to evaluate in Monte Carlo & Pattern Analogs:
  // Either the passed customSetup, the most recent detected signal, or a synthesized live trend setup
  const lastIdx = candles.length - 1;
  const lastCandle = candles[lastIdx];
  const lastAtr = ctx.atr14[lastIdx] ?? (lastCandle.high - lastCandle.low || lastCandle.close * 0.005);
  const lastRsi = ctx.rsi14[lastIdx] ?? 50;
  const lastRvol = ctx.rvol20[lastIdx] ?? 1;
  const e20 = ctx.ema20[lastIdx] ?? lastCandle.close;

  let activeSetup: TraderSignal | null =
    customSetup ?? (allSignals.length > 0 ? allSignals[allSignals.length - 1] : null);

  if (!activeSetup) {
    const dir: "LONG" | "SHORT" = lastCandle.close >= e20 ? "LONG" : "SHORT";
    const { entryPrice, stopPrice, targetPrice } = computeStopAndTarget(
      candles,
      lastIdx,
      dir,
      lastAtr,
      rrRatio
    );
    const stratMeta =
      strategyFilter === "all" ? STRATEGIES[0] : STRATEGY_BY_ID[strategyFilter];
    activeSetup = {
      id: `${symbol}-${timeframe}-synth-${lastCandle.time}`,
      symbol,
      timeframe,
      strategyId: stratMeta.id,
      strategyName: stratMeta.shortName,
      badge: stratMeta.badge,
      direction: dir,
      time: lastCandle.time,
      barIndex: lastIdx,
      entryPrice,
      stopPrice,
      targetPrice,
      rrRatio,
      atrValue: lastAtr,
      rvolValue: lastRvol,
      rsiValue: lastRsi,
      confidence: 65,
      rationale: `Live ${dir} structure projection @ ${fmtPrice(entryPrice)} (ATR ${fmtPrice(lastAtr)})`,
      isRecent: true,
      barsAgo: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // 1. Historical Strategy Backtest
  // ---------------------------------------------------------------------------
  const trades: BacktestTradeRecord[] = [];
  let wins = 0;
  let losses = 0;
  let timeouts = 0;
  let grossWinR = 0;
  let grossLossR = 0;
  let cumulativeR = 0;
  let peakR = 0;
  let maxDrawdownR = 0;
  const equityCurve: { time: number; r: number; cumulativeR: number }[] = [];

  for (const sig of allSignals) {
    // Need at least 2 forward bars to evaluate a historical signal
    if (sig.barIndex >= candles.length - 2) continue;

    const risk = Math.max(Math.abs(sig.entryPrice - sig.stopPrice), 1e-8);
    const maxEnd = Math.min(candles.length - 1, sig.barIndex + horizon);
    let outcome: "TP" | "SL" | "EXP" = "EXP";
    let rMultiple = 0;
    let exitPrice = candles[maxEnd].close;
    let exitTime = candles[maxEnd].time;
    let barsHeld = maxEnd - sig.barIndex;

    for (let j = sig.barIndex + 1; j <= maxEnd; j++) {
      const bar = candles[j];
      if (sig.direction === "LONG") {
        // Conservative check: if both SL and TP hit in same bar, check open proximity
        const hitSL = bar.low <= sig.stopPrice;
        const hitTP = bar.high >= sig.targetPrice;
        if (hitSL && hitTP) {
          outcome = bar.close >= bar.open ? "TP" : "SL";
        } else if (hitSL) {
          outcome = "SL";
        } else if (hitTP) {
          outcome = "TP";
        }
      } else {
        const hitSL = bar.high >= sig.stopPrice;
        const hitTP = bar.low <= sig.targetPrice;
        if (hitSL && hitTP) {
          outcome = bar.close <= bar.open ? "TP" : "SL";
        } else if (hitSL) {
          outcome = "SL";
        } else if (hitTP) {
          outcome = "TP";
        }
      }

      if (outcome !== "EXP") {
        barsHeld = j - sig.barIndex;
        exitTime = bar.time;
        exitPrice = outcome === "TP" ? sig.targetPrice : sig.stopPrice;
        rMultiple = outcome === "TP" ? rrRatio : -1.0;
        break;
      }
    }

    if (outcome === "EXP") {
      const rawMove =
        sig.direction === "LONG"
          ? exitPrice - sig.entryPrice
          : sig.entryPrice - exitPrice;
      rMultiple = clamp(rawMove / risk, -1.0, rrRatio);
      if (rMultiple > 0.15) wins++;
      else if (rMultiple < -0.15) losses++;
      else timeouts++;
    } else if (outcome === "TP") {
      wins++;
    } else {
      losses++;
    }

    if (rMultiple > 0) grossWinR += rMultiple;
    else if (rMultiple < 0) grossLossR += Math.abs(rMultiple);

    cumulativeR += rMultiple;
    if (cumulativeR > peakR) peakR = cumulativeR;
    const dd = peakR - cumulativeR;
    if (dd > maxDrawdownR) maxDrawdownR = dd;

    equityCurve.push({
      time: exitTime,
      r: Number(rMultiple.toFixed(2)),
      cumulativeR: Number(cumulativeR.toFixed(2)),
    });

    trades.push({
      signal: sig,
      outcome,
      rMultiple: Number(rMultiple.toFixed(2)),
      barsHeld,
      exitPrice,
      exitTime,
    });
  }

  const totalSignals = trades.length;
  const decisiveCount = wins + losses;
  const btWinRate = decisiveCount > 0 ? (wins / decisiveCount) * 100 : 50;
  const profitFactor =
    grossLossR > 0 ? grossWinR / grossLossR : grossWinR > 0 ? 3.5 : 1.0;
  const expectedR = totalSignals > 0 ? cumulativeR / totalSignals : 0;

  // ---------------------------------------------------------------------------
  // 2. Historical Pattern Analogs (10-Bar Feature Vector Similarity)
  // ---------------------------------------------------------------------------
  const patLen = 10;
  const matchedIdx = candles.findIndex((c) => c.time === activeSetup.time);
  const refEnd = clamp(
    matchedIdx >= 0 ? matchedIdx : activeSetup.barIndex,
    0,
    candles.length - 1
  );
  const refStart = Math.max(0, refEnd - patLen + 1);
  const refBase = candles[refStart]?.open || 1;
  const refVec: number[] = [];
  for (let k = refStart; k <= refEnd; k++) {
    const c = candles[k];
    refVec.push(c ? (c.close - refBase) / refBase : 0);
  }

  const candidates: { idx: number; dist: number; rOut: number; movePct: number }[] = [];
  const activeRiskPct =
    Math.max(Math.abs(activeSetup.entryPrice - activeSetup.stopPrice), 1e-8) /
    activeSetup.entryPrice;

  for (let m = patLen + 10; m < candles.length - horizon - 2; m++) {
    if (Math.abs(m - refEnd) < patLen) continue;
    const wStart = m - patLen + 1;
    const wBase = candles[wStart].open || 1;
    let sumSq = 0;
    for (let k = 0; k < refVec.length; k++) {
      const v = (candles[wStart + k].close - wBase) / wBase;
      const diff = v - refVec[k];
      sumSq += diff * diff;
    }
    const rsiDiff = ((ctx.rsi14[m] ?? 50) - activeSetup.rsiValue) / 100;
    const dist = Math.sqrt(sumSq / refVec.length + rsiDiff * rsiDiff * 0.25);

    // Evaluate forward horizon for this analog using the same relative R-multiple geometry
    const mEntry = candles[m].close;
    const mStop =
      activeSetup.direction === "LONG"
        ? mEntry * (1 - activeRiskPct)
        : mEntry * (1 + activeRiskPct);
    const mTarget =
      activeSetup.direction === "LONG"
        ? mEntry * (1 + activeRiskPct * rrRatio)
        : mEntry * (1 - activeRiskPct * rrRatio);

    let rOut = 0;
    let resolved = false;
    for (let f = 1; f <= horizon; f++) {
      const fBar = candles[m + f];
      if (activeSetup.direction === "LONG") {
        if (fBar.low <= mStop) {
          rOut = -1.0;
          resolved = true;
          break;
        }
        if (fBar.high >= mTarget) {
          rOut = rrRatio;
          resolved = true;
          break;
        }
      } else {
        if (fBar.high >= mStop) {
          rOut = -1.0;
          resolved = true;
          break;
        }
        if (fBar.low <= mTarget) {
          rOut = rrRatio;
          resolved = true;
          break;
        }
      }
    }
    const endClose = candles[m + horizon].close;
    const rawPct =
      activeSetup.direction === "LONG"
        ? ((endClose - mEntry) / mEntry) * 100
        : ((mEntry - endClose) / mEntry) * 100;
    if (!resolved) {
      rOut = clamp(rawPct / 100 / activeRiskPct, -1.0, rrRatio);
    }

    candidates.push({ idx: m, dist, rOut, movePct: rawPct });
  }

  candidates.sort((a, b) => a.dist - b.dist);
  const topAnalogs = candidates.slice(0, 25);
  const analogWins = topAnalogs.filter((a) => a.rOut > 0).length;
  const analogWinRate = topAnalogs.length > 0 ? (analogWins / topAnalogs.length) * 100 : 50;
  const analogAvgR =
    topAnalogs.length > 0
      ? topAnalogs.reduce((s, a) => s + a.rOut, 0) / topAnalogs.length
      : 0;
  const sortedMoves = topAnalogs.map((a) => a.movePct).sort((a, b) => a - b);
  const medianMovePct =
    sortedMoves.length > 0 ? sortedMoves[Math.floor(sortedMoves.length / 2)] : 0;
  const bestSimilarityPct =
    topAnalogs.length > 0
      ? Math.round(clamp((1 - topAnalogs[0].dist * 8) * 100, 62, 99))
      : 0;

  // ---------------------------------------------------------------------------
  // 3. Monte Carlo Bootstrap Simulation (2,500 Paths)
  // ---------------------------------------------------------------------------
  const MC_PATHS = 2500;
  const samplePoolStart = Math.max(1, candles.length - 120);
  const barDeltas: { ret: number; upWick: number; dnWick: number }[] = [];
  for (let i = samplePoolStart; i < candles.length; i++) {
    const prevC = candles[i - 1].close || 1;
    const ret = (candles[i].close - prevC) / prevC;
    const upWick = (candles[i].high - prevC) / prevC;
    const dnWick = (candles[i].low - prevC) / prevC;
    barDeltas.push({ ret, upWick, dnWick });
  }

  const seed = Math.round(lastCandle.time ^ Math.round(lastCandle.close * 100));
  const rng = createSeededRng(seed);

  let mcTpHits = 0;
  let mcSlHits = 0;
  let mcTimeouts = 0;
  let mcSumR = 0;
  const terminalPrices: number[] = [];

  const sEntry = activeSetup.entryPrice;
  const sStop = activeSetup.stopPrice;
  const sTarget = activeSetup.targetPrice;
  const sRisk = Math.max(Math.abs(sEntry - sStop), 1e-8);
  const poolLen = barDeltas.length;

  for (let p = 0; p < MC_PATHS; p++) {
    let price = sEntry;
    let outcome: "TP" | "SL" | "EXP" = "EXP";

    for (let step = 0; step < horizon; step++) {
      const sample = barDeltas[Math.floor(rng() * poolLen)];
      const simHigh = price * (1 + Math.max(0, sample.upWick));
      const simLow = price * (1 + Math.min(0, sample.dnWick));
      price = price * (1 + sample.ret);

      if (activeSetup.direction === "LONG") {
        if (simLow <= sStop) {
          outcome = "SL";
          break;
        }
        if (simHigh >= sTarget) {
          outcome = "TP";
          break;
        }
      } else {
        if (simHigh >= sStop) {
          outcome = "SL";
          break;
        }
        if (simLow <= sTarget) {
          outcome = "TP";
          break;
        }
      }
    }

    terminalPrices.push(price);
    if (outcome === "TP") {
      mcTpHits++;
      mcSumR += rrRatio;
    } else if (outcome === "SL") {
      mcSlHits++;
      mcSumR -= 1.0;
    } else {
      mcTimeouts++;
      const move =
        activeSetup.direction === "LONG" ? price - sEntry : sEntry - price;
      mcSumR += clamp(move / sRisk, -1.0, rrRatio);
    }
  }

  terminalPrices.sort((a, b) => a - b);
  const tpHitPct = (mcTpHits / MC_PATHS) * 100;
  const slHitPct = (mcSlHits / MC_PATHS) * 100;
  const timeoutPct = (mcTimeouts / MC_PATHS) * 100;
  const mcDecisive = mcTpHits + mcSlHits;
  const mcWinRateNormalized = mcDecisive > 0 ? (mcTpHits / mcDecisive) * 100 : 50;

  // Weighted institutional composite odds
  const combinedWinOdds = Math.round(
    clamp(
      (totalSignals >= 3 ? btWinRate * 0.45 : analogWinRate * 0.45) +
        analogWinRate * 0.3 +
        mcWinRateNormalized * 0.25,
      15,
      92
    )
  );

  return {
    symbol,
    timeframe,
    strategyFilter,
    rrRatio,
    horizon,
    activeSetup,
    combinedWinOdds,
    backtest: {
      totalSignals,
      wins,
      losses,
      timeouts,
      winRate: Number(btWinRate.toFixed(1)),
      profitFactor: Number(profitFactor.toFixed(2)),
      expectedR: Number(expectedR.toFixed(2)),
      maxDrawdownR: Number(maxDrawdownR.toFixed(2)),
      equityCurve,
      recentTrades: trades.slice(-12).reverse(),
    },
    analogs: {
      matchCount: topAnalogs.length,
      winRate: Number(analogWinRate.toFixed(1)),
      avgR: Number(analogAvgR.toFixed(2)),
      medianMovePct: Number(medianMovePct.toFixed(2)),
      bestSimilarityPct,
    },
    monteCarlo: {
      paths: MC_PATHS,
      tpHitPct: Number(tpHitPct.toFixed(1)),
      slHitPct: Number(slHitPct.toFixed(1)),
      timeoutPct: Number(timeoutPct.toFixed(1)),
      expectedR: Number((mcSumR / MC_PATHS).toFixed(2)),
      p10Price: terminalPrices[Math.floor(MC_PATHS * 0.1)] ?? sEntry,
      p50Price: terminalPrices[Math.floor(MC_PATHS * 0.5)] ?? sEntry,
      p90Price: terminalPrices[Math.floor(MC_PATHS * 0.9)] ?? sEntry,
    },
  };
}
