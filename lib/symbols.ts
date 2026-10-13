/**
 * Single source of truth for symbol mapping.
 *
 * Previously each consumer built its own mapping — Watchlist and CommandBar
 * knew that GOLD/USDT means PAXGUSDT, while the page derived symbols with a
 * regex and produced a nonexistent "GOLDUSDT", so the chart silently 502'd.
 * Keep every alias here.
 */

export interface SymbolDef {
  /** What the UI shows. */
  label: string;
  /** The real instrument on the data provider. */
  symbol: string;
}

/** Assets selectable in the watchlist and chartable. */
export const UNIVERSE: SymbolDef[] = [
  { label: "BTC/USDT", symbol: "BTCUSDT" },
  { label: "ETH/USDT", symbol: "ETHUSDT" },
  { label: "SOL/USDT", symbol: "SOLUSDT" },
  { label: "XRP/USDT", symbol: "XRPUSDT" },
  { label: "BNB/USDT", symbol: "BNBUSDT" },
  // Binance lists no spot GOLD/USDT; PAX Gold stands in for it.
  { label: "GOLD/USDT", symbol: "PAXGUSDT" },
];

const BY_LABEL = new Map(UNIVERSE.map((d) => [d.label, d.symbol]));
const BY_SYMBOL = new Map(UNIVERSE.map((d) => [d.symbol, d.label]));

/** Labels in display order. */
export const CHART_LABELS = UNIVERSE.map((d) => d.label);

/** "GOLD/USDT" -> "PAXGUSDT". Returns null when the label isn't chartable. */
export function toBinanceSymbol(label: string): string | null {
  const direct = BY_LABEL.get(label.toUpperCase());
  if (direct) return direct;
  // Accept a bare symbol too: "BTC" or "BTCUSDT"
  const upper = label.toUpperCase();
  return BY_SYMBOL.get(upper) ?? (upper.endsWith("USDT") ? upper : null);
}

/** "PAXGUSDT" -> "GOLD/USDT". */
export function toLabel(symbol: string): string {
  return BY_SYMBOL.get(symbol.toUpperCase()) ?? symbol.toUpperCase();
}

/** True when this label can drive the chart. */
export function isChartable(label: string): boolean {
  return BY_LABEL.has(label.toUpperCase());
}

/** Resolve a typed prefix ("sol", "gol") to a chartable label, or null. */
export function resolvePrefix(raw: string): string | null {
  const q = raw.trim().toUpperCase().replace(/[\/\s]/g, "");
  if (!q) return null;
  const byLabel = UNIVERSE.find((d) => d.label.replace("/USDT", "") === q);
  if (byLabel) return byLabel.label;
  const byPartial = UNIVERSE.find((d) => d.label.replace("/USDT", "").startsWith(q));
  return byPartial ? byPartial.label : null;
}
