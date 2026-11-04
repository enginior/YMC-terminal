"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  createSeriesMarkers,
  ISeriesMarkersPluginApi,
  ISeriesApi,
  SeriesMarker,
  UTCTimestamp,
} from "lightweight-charts";
import { Candle } from "@/lib/types";
import { Theme } from "@/context/ThemeContext";
import {
  detectStrategySignals,
  StrategyFilter,
  RMultipleOption,
} from "@/lib/traderEngine";

export const STRATEGY_OVERLAY_KEY = "btc-terminal:strategy-overlay";

export interface StrategyOverlayConfig {
  enabled: boolean;
  strategyFilter: StrategyFilter;
  rrRatio: RMultipleOption;
}

export interface UseStrategyMarkersOptions {
  candleSeriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
  candles: Candle[];
  symbol: string;
  timeframe: string;
  theme: Theme;
  chartEpoch: number;
}

export function useStrategyMarkers({
  candleSeriesRef,
  candles,
  symbol,
  timeframe,
  theme,
  chartEpoch,
}: UseStrategyMarkersOptions) {
  const [config, setConfig] = useState<StrategyOverlayConfig>({
    enabled: false,
    strategyFilter: "all",
    rrRatio: 2.0,
  });

  const markersPluginRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);

  // Hydrate initial overlay state from localStorage and listen for live updates from DayTraderPanel
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STRATEGY_OVERLAY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.enabled === "boolean") {
          setConfig({
            enabled: parsed.enabled,
            strategyFilter: parsed.strategyFilter ?? "all",
            rrRatio: parsed.rrRatio ?? 2.0,
          });
        }
      }
    } catch {}

    const onOverlayChange = (e: Event) => {
      const custom = e as CustomEvent<StrategyOverlayConfig>;
      if (custom.detail) {
        setConfig(custom.detail);
      }
    };

    window.addEventListener("btc-terminal:strategy-overlay", onOverlayChange);
    return () => window.removeEventListener("btc-terminal:strategy-overlay", onOverlayChange);
  }, []);

  const candleCount = candles.length;
  const lastCandleTime = candleCount > 0 ? candles[candleCount - 1].time : 0;

  const markers = useMemo((): SeriesMarker<UTCTimestamp>[] => {
    if (!config.enabled || candleCount < 30) return [];
    const recentSlice = candles.slice(-400);
    const signals = detectStrategySignals(
      recentSlice,
      symbol,
      timeframe,
      config.strategyFilter,
      config.rrRatio
    );

    const byTime = new Map<number, SeriesMarker<UTCTimestamp>>();
    for (const sig of signals) {
      const isLong = sig.direction === "LONG";
      byTime.set(sig.time, {
        id: `strat-${sig.id}`,
        time: sig.time as UTCTimestamp,
        position: isLong ? "belowBar" : "aboveBar",
        color: isLong ? theme.green : theme.red,
        shape: isLong ? "arrowUp" : "arrowDown",
        size: sig.isRecent ? 2 : 1,
        text: `${sig.badge} ${isLong ? "L" : "S"}`,
      });
    }

    return Array.from(byTime.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.enabled,
    config.strategyFilter,
    config.rrRatio,
    candleCount,
    lastCandleTime,
    symbol,
    timeframe,
    theme,
  ]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series || !config.enabled) return;

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
  }, [chartEpoch, candleSeriesRef, config.enabled]);

  useEffect(() => {
    const plugin = markersPluginRef.current;
    if (!plugin || !candleSeriesRef.current) return;

    try {
      plugin.setMarkers(config.enabled ? markers : []);
    } catch {}
  }, [markers, config.enabled, candleSeriesRef]);
}
