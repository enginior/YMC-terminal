/**
 * Shared market-data shapes.
 *
 * These used to live alongside mock generators that produced random candles
 * for offline demos. Every panel is now wired to real feeds, so the generators
 * are gone — only the types remain.
 */

export interface Candle {
  /** Candle open time, in epoch seconds. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookEntry {
  price: number;
  size: number;
  /** Cumulative size from the top of the book down to this level. */
  total: number;
}

export interface Trade {
  id: number;
  price: number;
  size: number;
  side: "buy" | "sell";
  /** Formatted HH:MM:SS local time of the fill. */
  time: string;
}

export interface WatchlistItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  rawVolume?: number;
  sparkline?: number[];
}