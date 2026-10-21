import { Candle } from "@/lib/types";

/**
 * Heiken Ashi transform.
 *
 * Each bar's open and close are derived from the previous *Heiken* bar rather
 * than the raw candle, which smooths out the wick noise that makes real
 * candles hard to read. Volume and time are carried over untouched.
 *
 * Formulas:
 * - Close = (Open + High + Low + Close) / 4
 * - Open = (Prior Heiken Open + Prior Heiken Close) / 2
 * - High = Max(High, Open, Close)
 * - Low = Min(Low, Open, Close)
 */
export function heikenAshi(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  let prevOpen = 0;
  let prevClose = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const close = (c.open + c.high + c.low + c.close) / 4;
    const open = i === 0 ? (c.open + c.close) / 2 : (prevOpen + prevClose) / 2;
    const high = Math.max(c.high, open, close);
    const low = Math.min(c.low, open, close);

    out.push({
      time: c.time,
      open,
      high,
      low,
      close,
      volume: c.volume,
    });

    prevOpen = open;
    prevClose = close;
  }

  return out;
}
