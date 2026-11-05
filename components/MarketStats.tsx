"use client";

import { memo } from "react";
import { useTheme } from "@/context/ThemeContext";
import { AssetIcon } from "@/components/AssetIcon";
import { useMarket, ExchangeSource } from "@/lib/marketStore";
import { isFuturesSymbol } from "@/lib/symbols";
import { useRenderCount } from "@/lib/devRenderCount";

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
  markPrice?: number | null;
  source?: ExchangeSource;
}

interface MarketStatsProps {
  symbol: string;
  price?: number;
  direction?: "up" | "down";
  ticker: TickerStats | null;
  connected?: boolean;
  exchangeSource?: ExchangeSource;
  onChangeExchangeSource?: (source: ExchangeSource) => void;
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

function MarketStats({
  symbol,
  price: propPrice,
  direction: propDirection,
  ticker,
  connected: propConnected,
  exchangeSource: propSource,
  onChangeExchangeSource,
}: MarketStatsProps) {
  useRenderCount("MarketStats");
  const { theme } = useTheme();

  const storePrice = useMarket((s) => s.price);
  const storeDirection = useMarket((s) => s.direction);
  const storeConnected = useMarket((s) => s.connected);
  const storeSource = useMarket((s) => s.exchangeSource);

  const price = propPrice ?? (storePrice > 0 ? storePrice : ticker?.lastPrice ?? 0);
  const direction = propDirection ?? storeDirection;
  const connected = propConnected ?? storeConnected;
  const exchangeSource = propSource ?? storeSource;
  const isCommodity = isFuturesSymbol(symbol);
  const effectiveVenue = isCommodity ? "BINANCE FUT" : exchangeSource.toUpperCase();

  const up = ticker ? ticker.priceChange >= 0 : direction === "up";
  const changeColor = up ? theme.green : theme.red;

  const basis = ticker?.markPrice != null && price > 0 ? ticker.markPrice - price : null;
  const basisPct = basis != null && price > 0 ? (basis / price) * 100 : null;

  return (
    <div className="h-full flex items-center px-4 gap-5 overflow-hidden">
      <div className="shrink-0 flex items-center gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: theme.dim }}>
            <AssetIcon symbol={symbol} size={13} className="shrink-0" />
            <span>{symbol}</span>
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              title={connected ? `Live (${effectiveVenue})` : "Disconnected"}
              style={{ background: connected ? theme.green : theme.red }}
            />
          </div>
          <div className="text-xl font-bold tabular-nums" style={{ color: connected ? changeColor : theme.dim }}>
            {price > 0 ? fmtUsd(price) : "—"}
          </div>
        </div>

        {/* Unified Price & Chart Exchange Source Switcher */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wider font-mono" style={{ color: theme.dim }}>
            Feed Source
          </span>
          {isCommodity ? (
            <div
              className="px-2 py-0.5 rounded border text-[10px] font-mono font-bold tracking-wider"
              style={{
                borderColor: theme.border,
                background: theme.bg,
                color: theme.yellow,
              }}
              title="Commodity perpetuals (Gold, Silver, WTI Oil) stream from Binance Futures"
            >
              BINANCE FUT
            </div>
          ) : (
            <div
              className="flex items-center rounded border p-0.5 text-[10px] font-mono"
              style={{ borderColor: theme.border, background: theme.bg }}
              title="Unified data source for Top Strip, Price Chart, Order Book & Trade Tape"
            >
              {(["binance", "bybit", "okx"] as const).map((src) => {
                const active = exchangeSource === src;
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => onChangeExchangeSource?.(src)}
                    className="px-2 py-0.5 rounded uppercase font-bold tracking-wider transition-colors"
                    style={{
                      background: active ? theme.yellow : "transparent",
                      color: active ? theme.bg : theme.dim,
                    }}
                  >
                    {src}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="h-8 w-px shrink-0" style={{ background: theme.border }} />

      <div className="grid grid-cols-6 gap-4 text-xs min-w-0 flex-1">
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
          <div className="text-[10px]" style={{ color: theme.dim }}>Basis (Perp Spread)</div>
          <div className="tabular-nums truncate" style={{ color: basis != null ? (basis >= 0 ? theme.green : theme.red) : theme.dim }}>
            {basis != null && basisPct != null ? (
              <>
                {basis >= 0 ? "+" : ""}${basis.toFixed(2)} ({basis >= 0 ? "+" : ""}{basisPct.toFixed(2)}%)
              </>
            ) : (
              "—"
            )}
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
          <div className="text-[10px]" style={{ color: theme.dim }}>
            {ticker && ticker.trades > 0 ? "24h Trades" : "Perp Mark"}
          </div>
          <div className="tabular-nums truncate" style={{ color: ticker ? theme.text : theme.dim }}>
            {ticker
              ? ticker.trades > 0
                ? ticker.trades.toLocaleString("en-US")
                : ticker.markPrice != null
                  ? fmtUsd(ticker.markPrice)
                  : fmtCompact(ticker.quoteVolume)
              : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MarketStats);
