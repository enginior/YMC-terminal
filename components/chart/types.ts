import { Candle } from "@/lib/types";
import { Theme } from "@/context/ThemeContext";
import { DrawingTool } from "@/lib/drawings";

// Binance interval codes — lowercase, matching /api/klines
export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"] as const;
export const FAVORITE_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export const MORE_TIMEFRAMES = ["30m", "2h"] as const;

export type OverlayIndicator = "sma" | "ema" | "bollinger";
export type PaneIndicator = "rsi" | "macd" | "stochrsi" | "oi" | "funding" | "cvd";
export type IndicatorType = OverlayIndicator | PaneIndicator;

/** How the main price pane draws the series. */
export type ChartType = "candles" | "heiken" | "line";

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  candles: "Candles",
  heiken: "Heikin Ashi",
  line: "Line",
};

export const CHART_TYPE_DESCRIPTIONS: Record<ChartType, string> = {
  candles: "Standard Candlesticks (OHLC)",
  heiken: "Smoothed Heikin Ashi trend bars",
  line: "Continuous close price curve",
};

export const CHART_TYPE_KEY = "btc-terminal:chart-type";
export const SESSION_HL_KEY = "btc-terminal:session-hl";
export const DRAWINGS_KEY = "btc-terminal:drawings";

export const INDICATOR_LABELS: Record<IndicatorType, string> = {
  sma: "SMA 20/50",
  ema: "EMA 20/50",
  bollinger: "Bollinger (20,2)",
  rsi: "RSI (14)",
  macd: "MACD (12,26,9)",
  stochrsi: "Stoch RSI (14,14,3,3)",
  oi: "Open Interest (OI)",
  funding: "Funding Rate History",
  cvd: "Cumulative Volume Delta (CVD)",
};

export const OVERLAYS: OverlayIndicator[] = ["sma", "ema", "bollinger"];
export const PANES: PaneIndicator[] = ["rsi", "macd", "stochrsi", "oi", "funding", "cvd"];

export interface IndicatorMeta {
  id: IndicatorType;
  name: string;
  category: "Overlay" | "Oscillator" | "Perpetual" | "Order Flow";
  shortDesc: string;
  formula: string;
}

export const INDICATOR_METAS: IndicatorMeta[] = [
  {
    id: "sma",
    name: "SMA 20 / 50",
    category: "Overlay",
    shortDesc: "Dual Simple Moving Averages",
    formula: "20-period (Blue) & 50-period (Yellow) trend baselines",
  },
  {
    id: "ema",
    name: "EMA 20 / 50",
    category: "Overlay",
    shortDesc: "Dual Exponential Moving Averages",
    formula: "Weighted fast response (Green 20, Red 50)",
  },
  {
    id: "bollinger",
    name: "Bollinger Bands",
    category: "Overlay",
    shortDesc: "Volatility bands around 20 SMA",
    formula: "SMA 20 ± 2 standard deviations",
  },
  {
    id: "rsi",
    name: "Relative Strength Index (RSI)",
    category: "Oscillator",
    shortDesc: "Momentum oscillator pinned to 0–100",
    formula: "14-period standard with 70/30 overbought/oversold shaded zones",
  },
  {
    id: "macd",
    name: "MACD",
    category: "Oscillator",
    shortDesc: "Moving Average Convergence Divergence",
    formula: "12 EMA, 26 EMA, 9 Signal Line + Histogram",
  },
  {
    id: "stochrsi",
    name: "Stochastic RSI",
    category: "Oscillator",
    shortDesc: "Stochastic applied to RSI for rapid cyclical turns",
    formula: "14, 14, 3, 3 with 80/20 shaded reference bounds",
  },
  {
    id: "oi",
    name: "Open Interest (OI)",
    category: "Perpetual",
    shortDesc: "Aggregated perpetual contract open interest value",
    formula: "Binance Futures USD Open Interest (sumOpenInterestValue)",
  },
  {
    id: "funding",
    name: "Funding Rate History",
    category: "Perpetual",
    shortDesc: "8-hour perpetual funding rate settlement history",
    formula: "Binance Futures 8h Funding Rate (%) with zero baseline",
  },
  {
    id: "cvd",
    name: "Cumulative Volume Delta (CVD)",
    category: "Order Flow",
    shortDesc: "Net aggressive buyer vs seller order flow",
    formula: "Cumulative Σ ((Close - Open) / (High - Low)) × Volume",
  },
];

/** Shape of the memoised indicator values. */
export type ComputedValues = {
  sma20: (number | null)[];
  sma50: (number | null)[];
  ema20: (number | null)[];
  ema50: (number | null)[];
  bb: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] };
  rsi: (number | null)[];
  macd: { macdLine: (number | null)[]; signalLine: (number | null)[]; histogram: (number | null)[] };
  stochRsi: { k: (number | null)[]; d: (number | null)[] };
  cvd: (number | null)[];
};

/** Overlay line definitions: theme colour slot + value accessor. */
export const OVERLAY_SPECS: Record<
  OverlayIndicator,
  { colorKey: keyof Theme; values: (c: ComputedValues) => (number | null)[] }[]
> = {
  sma: [
    { colorKey: "blue", values: (c) => c.sma20 },
    { colorKey: "yellow", values: (c) => c.sma50 },
  ],
  ema: [
    { colorKey: "green", values: (c) => c.ema20 },
    { colorKey: "red", values: (c) => c.ema50 },
  ],
  bollinger: [
    { colorKey: "dim", values: (c) => c.bb.upper },
    { colorKey: "yellow", values: (c) => c.bb.middle },
    { colorKey: "dim", values: (c) => c.bb.lower },
  ],
};

export type DrawMode = DrawingTool | "none";

/** Nearest of a candle's O/H/L/C to a raw price — the value the magnet snaps to. */
export function snapPriceToOhlc(candle: Candle, price: number): number {
  let best = price;
  let bestDist = Infinity;
  for (const v of [candle.open, candle.high, candle.low, candle.close]) {
    const d = Math.abs(v - price);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

/** Candle whose open time matches an epoch-seconds timestamp. */
export function candleAt(candles: Candle[], time: number): Candle | undefined {
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].time === time) return candles[i];
  }
  return undefined;
}

export interface PriceChartProps {
  candles?: Candle[];
  symbol: string;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  candleError?: boolean;
  onToggleMaximize?: () => void;
  isMaximized?: boolean;
  ticker?: { high?: number; low?: number } | null;
}
