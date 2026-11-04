"use client";

import { useEffect, useRef, useMemo } from "react";
import {
  createSeriesMarkers,
  ISeriesMarkersPluginApi,
  ISeriesApi,
  SeriesMarker,
  UTCTimestamp,
} from "lightweight-charts";
import { Candle, LiquidationOrder } from "@/lib/types";
import { Theme } from "@/context/ThemeContext";
import { toBinanceSymbol } from "@/lib/symbols";
import { useMarket } from "@/lib/marketStore";

function fmtUsd(val: number): string {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

/**
 * Binary search to find the enclosing candle bar timestamp for a liquidation timestamp.
 * Returns null if the liquidation occurred before the oldest loaded candle.
 */
export function findEnclosingCandleTime(candles: Candle[], sec: number): number | null {
  if (!candles || candles.length === 0 || sec < candles[0].time) return null;
  if (sec >= candles[candles.length - 1].time) {
    return candles[candles.length - 1].time;
  }
  let low = 0;
  let high = candles.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (candles[mid].time <= sec) {
      if (mid === candles.length - 1 || candles[mid + 1].time > sec) {
        return candles[mid].time;
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return null;
}

/**
 * Transforms market liquidations into lightweight-charts series markers
 * sorted chronologically.
 */
export function buildLiquidationMarkers(
  liquidations: LiquidationOrder[],
  candles: Candle[],
  symbol: string,
  minThreshold: number,
  theme: Theme
): SeriesMarker<UTCTimestamp>[] {
  if (!liquidations || liquidations.length === 0 || !candles || candles.length === 0) {
    return [];
  }

  const targetRaw = toBinanceSymbol(symbol) ?? "BTCUSDT";
  const base = symbol.replace("/USDT", "").replace("USDT", "").toUpperCase();

  const matching = liquidations.filter(
    (l) =>
      (l.rawSymbol === targetRaw || l.symbol.toUpperCase() === base) &&
      l.usdValue >= minThreshold
  );

  const markers: SeriesMarker<UTCTimestamp>[] = [];

  for (const liq of matching) {
    const sec = Math.floor(liq.timestamp / 1000);
    const candleTime = findEnclosingCandleTime(candles, sec);
    if (candleTime == null) continue;

    // BUY = short liquidated (forced buy), SELL = long liquidated (forced sell)
    const isLongLiq = liq.side === "SELL";
    const size = liq.usdValue >= 250_000 ? 3 : liq.usdValue >= 50_000 ? 2 : 1;
    const color = isLongLiq ? theme.red : theme.green;

    markers.push({
      id: `liq-${liq.id}`,
      time: candleTime as UTCTimestamp,
      position: "atPriceMiddle",
      price: liq.price,
      color,
      shape: "circle",
      size,
      text: liq.usdValue >= 100_000 ? fmtUsd(liq.usdValue) : undefined,
    });
  }

  // Markers must strictly be in ascending chronological order in lightweight-charts
  markers.sort((a, b) => (a.time as number) - (b.time as number));
  return markers;
}

export interface UseLiquidationMarkersOptions {
  candleSeriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
  candles: Candle[];
  symbol: string;
  theme: Theme;
  showLiquidations: boolean;
  minThreshold: number;
  chartEpoch: number;
}

export function useLiquidationMarkers({
  candleSeriesRef,
  candles,
  symbol,
  theme,
  showLiquidations,
  minThreshold,
  chartEpoch,
}: UseLiquidationMarkersOptions) {
  const liquidations = useMarket((s) => s.liquidations);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);

  const markers = useMemo(() => {
    if (!showLiquidations) return [];
    return buildLiquidationMarkers(liquidations, candles, symbol, minThreshold, theme);
  }, [liquidations, candles, symbol, minThreshold, theme, showLiquidations]);

  // Create plugin instance when series/chart is created and liquidations are enabled
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series || !showLiquidations) return;

    try {
      const plugin = createSeriesMarkers(series as any);
      markersPluginRef.current = plugin as any;
    } catch {}

    return () => {
      if (candleSeriesRef.current === series) {
        try {
          markersPluginRef.current?.detach();
        } catch {}
      }
      markersPluginRef.current = null;
    };
  }, [chartEpoch, candleSeriesRef, showLiquidations]);

  // Push markers to plugin
  useEffect(() => {
    const plugin = markersPluginRef.current;
    if (!plugin || !candleSeriesRef.current) return;

    try {
      plugin.setMarkers(showLiquidations ? markers : []);
    } catch {}
  }, [markers, showLiquidations, candleSeriesRef]);
}
