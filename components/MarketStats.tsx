"use client";

import { useTheme } from "@/context/ThemeContext";

export interface TickerStats {
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  quoteVolume: number;
  trades: number;
}

interface MarketStatsProps {
  symbol: string;
  price: number;
  direction: "up" | "down";
  ticker: TickerStats | null;
  connected: boolean;
}

function fmtUsd(n: number, digits = 2) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtCompact(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

function fmtVolume(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

export default function MarketStats({ symbol, price, direction, ticker, connected }: MarketStatsProps) {
  const { theme } = useTheme();

  const up = ticker ? ticker.priceChange >= 0 : direction === "up";
  const changeColor = up ? theme.green : theme.red;

  return (
    <div className="h-full flex items-center px-4 gap-6 overflow-hidden">
      <div className="shrink-0">
        <div className="text-[10px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: theme.dim }}>
          {symbol}
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            title={connected ? "Live" : "Disconnected"}
            style={{ background: connected ? theme.green : theme.red }}
          />
        </div>
        <div className="text-xl font-bold tabular-nums" style={{ color: connected ? changeColor : theme.dim }}>
          {price > 0 ? fmtUsd(price) : "—"}
        </div>
      </div>

      <div className="h-8 w-px shrink-0" style={{ background: theme.border }} />

      <div className="grid grid-cols-5 gap-6 text-xs min-w-0">
        <div className="min-w-0">
          <div className="text-[10px]" style={{ color: theme.dim }}>24h Change</div>
          <div className="tabular-nums truncate" style={{ color: ticker ? changeColor : theme.dim }}>
            {ticker ? (
              <>
                {ticker.priceChange >= 0 ? "+" : ""}
                {fmtUsd(ticker.priceChange).slice(1)} ({ticker.priceChangePercent >= 0 ? "+" : ""}
                {ticker.priceChangePercent.toFixed(2)}%)
              </>
            ) : (
              "—"
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[10px]" style={{ color: theme.dim }}>24h High</div>
          <div className="tabular-nums truncate" style={{ color: ticker ? theme.text : theme.dim }}>
            {ticker ? fmtUsd(ticker.high) : "—"}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[10px]" style={{ color: theme.dim }}>24h Low</div>
          <div className="tabular-nums truncate" style={{ color: ticker ? theme.text : theme.dim }}>
            {ticker ? fmtUsd(ticker.low) : "—"}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[10px]" style={{ color: theme.dim }}>24h Volume</div>
          <div className="tabular-nums truncate" style={{ color: ticker ? theme.text : theme.dim }}>
            {ticker ? (
              <>
                {fmtVolume(ticker.volume)} <span style={{ color: theme.dim }}>{fmtCompact(ticker.quoteVolume)}</span>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[10px]" style={{ color: theme.dim }}>Trades</div>
          <div className="tabular-nums truncate" style={{ color: ticker ? theme.text : theme.dim }}>
            {ticker ? ticker.trades.toLocaleString("en-US") : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
