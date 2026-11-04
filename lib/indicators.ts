import { Candle } from "./types";

export function sma(data: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j].close;
      }
      result.push(sum / period);
    }
  }
  return result;
}

export function ema(data: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[j].close;
      }
      result.push(sum / period);
    } else {
      const prev = result[i - 1]!;
      result.push((data[i].close - prev) * multiplier + prev);
    }
  }
  return result;
}

export function rsi(data: Candle[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(null);
      continue;
    }

    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);

    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    } else {
      const prevRsi = result[i - 1];
      if (prevRsi === null) {
        result.push(null);
        continue;
      }
      const prevAvgGain = gains.slice(i - period - 1, i - 1).reduce((a, b) => a + b, 0) / period;
      const prevAvgLoss = losses.slice(i - period - 1, i - 1).reduce((a, b) => a + b, 0) / period;
      const avgGain = (prevAvgGain * (period - 1) + gains[i - 1]) / period;
      const avgLoss = (prevAvgLoss * (period - 1) + losses[i - 1]) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

export function macd(
  data: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macdLine: (number | null)[];
  signalLine: (number | null)[];
  histogram: (number | null)[];
} {
  const emaFast = ema(data, fastPeriod);
  const emaSlow = ema(data, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(emaFast[i]! - emaSlow[i]!);
    }
  }

  const signalLine: (number | null)[] = [];
  const multiplier = 2 / (signalPeriod + 1);
  let signalEma: number | null = null;

  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
    } else if (signalEma === null) {
      const idx = macdLine.findIndex((v) => v !== null);
      if (i === idx + (signalPeriod - 1)) {
        const slice = macdLine.slice(idx, i + 1).filter((v): v is number => v !== null);
        signalEma = slice.reduce((a, b) => a + b, 0) / slice.length;
        signalLine.push(signalEma);
      } else {
        signalLine.push(null);
      }
    } else {
      signalEma = (macdLine[i]! - signalEma) * multiplier + signalEma;
      signalLine.push(signalEma);
    }
  }

  const histogram: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macdLine[i]! - signalLine[i]!);
    }
  }

  return { macdLine, signalLine, histogram };
}

export function bollingerBands(data: Candle[], period: number = 20, stdDev: number = 2): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const middle = sma(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSq += Math.pow(data[j].close - middle[i]!, 2);
      }
      const std = Math.sqrt(sumSq / period);
      upper.push(middle[i]! + stdDev * std);
      lower.push(middle[i]! - stdDev * std);
    }
  }

  return { upper, middle, lower };
}

/** Simple moving average over an arbitrary (possibly null-padded) series. */
function smaSeries(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    let ok = true;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v === null) {
        ok = false;
        break;
      }
      sum += v;
    }
    result.push(ok ? sum / period : null);
  }
  return result;
}

/** Stochastic RSI (TradingView defaults: 14 / 14 / 3 / 3). */
export function stochRsi(
  data: Candle[],
  lengthRSI: number = 14,
  lengthStoch: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): { k: (number | null)[]; d: (number | null)[] } {
  const rsiVals = rsi(data, lengthRSI);
  const stoch: (number | null)[] = [];

  for (let i = 0; i < rsiVals.length; i++) {
    if (i < lengthStoch - 1) {
      stoch.push(null);
      continue;
    }
    let highest = -Infinity;
    let lowest = Infinity;
    let ok = true;
    for (let j = i - lengthStoch + 1; j <= i; j++) {
      const v = rsiVals[j];
      if (v === null) {
        ok = false;
        break;
      }
      if (v > highest) highest = v;
      if (v < lowest) lowest = v;
    }
    if (!ok) {
      stoch.push(null);
      continue;
    }
    const range = highest - lowest;
    stoch.push(range === 0 ? 0 : ((rsiVals[i]! - lowest) / range) * 100);
  }

  const k = smaSeries(stoch, smoothK);
  const d = smaSeries(k, smoothD);
  return { k, d };
}

/**
 * Cumulative Volume Delta (CVD).
 * Measures continuous net aggressive market order flow (buying vs selling pressure).
 */
export function cvd(data: Candle[]): (number | null)[] {
  const result: (number | null)[] = [];
  let cum = 0;

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const range = c.high - c.low;
    let delta = 0;
    if (range > 0) {
      const ratio = (c.close - c.open) / range;
      delta = ratio * c.volume;
    }
    cum += delta;
    result.push(cum);
  }
  return result;
}

/**
 * Average True Range (ATR) using Wilder's smoothing (default period = 14).
 */
export function atr(data: Candle[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const trs: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const tr =
      i === 0
        ? c.high - c.low
        : Math.max(
            c.high - c.low,
            Math.abs(c.high - data[i - 1].close),
            Math.abs(c.low - data[i - 1].close)
          );
    trs.push(tr);

    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += trs[j];
      result.push(sum / period);
    } else {
      const prev = result[i - 1]!;
      result.push((prev * (period - 1) + tr) / period);
    }
  }
  return result;
}

/**
 * Relative Volume (RVOL) — ratio of current bar volume to N-bar average volume.
 */
export function rvol(data: Candle[], period: number = 20): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].volume;
    }
    const avg = sum / period;
    result.push(avg > 0 ? data[i].volume / avg : 1);
  }
  return result;
}

