/**
 * Single source of truth for symbol mapping.
 *
 * Maps UI labels (e.g. BTC/USDT, XAU/USDT, XAG/USDT, OIL/USDT) to real exchange
 * instruments (BTCUSDT, XAUUSDT, XAGUSDT, CLUSDT).
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
  { label: "DOGE/USDT", symbol: "DOGEUSDT" },
  { label: "SUI/USDT", symbol: "SUIUSDT" },
  { label: "AVAX/USDT", symbol: "AVAXUSDT" },
  { label: "LINK/USDT", symbol: "LINKUSDT" },
  // Commodities & Precious Metals
  { label: "XAU/USDT", symbol: "XAUUSDT" },
  { label: "XAG/USDT", symbol: "XAGUSDT" },
  { label: "OIL/USDT", symbol: "CLUSDT" },
];

const BY_LABEL = new Map(UNIVERSE.map((d) => [d.label, d.symbol]));
const BY_SYMBOL = new Map(UNIVERSE.map((d) => [d.symbol, d.label]));

const ALIASES: Record<string, string> = {
  "GOLD/USDT": "XAUUSDT",
  GOLD: "XAUUSDT",
  PAXGUSDT: "XAUUSDT",
  "PAXG/USDT": "XAUUSDT",
  PAXG: "XAUUSDT",
  "SILVER/USDT": "XAGUSDT",
  SILVER: "XAGUSDT",
  "CRUDE/USDT": "CLUSDT",
  CRUDE: "CLUSDT",
  "WTI/USDT": "CLUSDT",
  WTI: "CLUSDT",
  OIL: "CLUSDT",
  "OIL/USDT": "CLUSDT",
};

/** Labels in display order. */
export const CHART_LABELS = UNIVERSE.map((d) => d.label);

/** True if the asset is a commodity / futures contract requiring Binance fapi / fstream */
export function isFuturesSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase().replace("/USDT", "").replace("USDT", "").trim();
  return (
    s === "XAU" ||
    s === "XAG" ||
    s === "CL" ||
    s === "OIL" ||
    s === "GOLD" ||
    s === "SILVER" ||
    s === "CRUDE" ||
    s === "WTI"
  );
}

/** "XAU/USDT" -> "XAUUSDT". Returns null when the label isn't chartable. */
export function toBinanceSymbol(label: string): string | null {
  const upper = label.toUpperCase();
  if (ALIASES[upper]) return ALIASES[upper];
  const direct = BY_LABEL.get(upper);
  if (direct) return direct;
  return BY_SYMBOL.get(upper) ?? (upper.endsWith("USDT") ? upper : null);
}

/** "XAUUSDT" -> "XAU/USDT". */
export function toLabel(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper === "PAXGUSDT") return "XAU/USDT";
  return BY_SYMBOL.get(upper) ?? upper;
}

/** True when this label can drive the chart. */
export function isChartable(label: string): boolean {
  const upper = label.toUpperCase();
  return BY_LABEL.has(upper) || Boolean(ALIASES[upper]);
}

/** Resolve a typed prefix ("sol", "xau", "gol", "oil") to a chartable label, or null. */
export function resolvePrefix(raw: string): string | null {
  const q = raw.trim().toUpperCase().replace(/[\/\s]/g, "");
  if (!q) return null;
  if (q === "GOLD" || q === "GOL" || q === "XAU") return "XAU/USDT";
  if (q === "SILVER" || q === "SIL" || q === "XAG") return "XAG/USDT";
  if (q === "OIL" || q === "CL" || q === "CRUDE" || q === "WTI") return "OIL/USDT";

  const byLabel = UNIVERSE.find((d) => d.label.replace("/USDT", "") === q);
  if (byLabel) return byLabel.label;
  const byPartial = UNIVERSE.find((d) => d.label.replace("/USDT", "").startsWith(q));
  return byPartial ? byPartial.label : null;
}
