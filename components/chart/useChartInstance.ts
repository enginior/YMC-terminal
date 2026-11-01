import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  HistogramData,
  IPriceLine,
  AutoscaleInfo,
} from "lightweight-charts";
import { Candle } from "@/lib/types";
import { Theme } from "@/context/ThemeContext";
import { DayLinesPrimitive, utcDayBoundaries } from "@/lib/dayLines";
import { ChartType } from "./types";

interface UseChartInstanceOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  candles: Candle[];
  chartCandles: Candle[];
  chartType: ChartType;
  showVolume: boolean;
  showDayLines: boolean;
  showSessionHL: boolean;
  symbol: string;
  timeframe: string;
  theme: Theme;
  ticker?: { high?: number; low?: number } | null;
}

export function useChartInstance({
  containerRef,
  candles,
  chartCandles,
  chartType,
  showVolume,
  showDayLines,
  showSessionHL,
  symbol,
  timeframe,
  theme,
  ticker,
}: UseChartInstanceOptions) {
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const dayLinesRef = useRef<DayLinesPrimitive | null>(null);
  const sessionLinesRef = useRef<IPriceLine[]>([]);

  // Bumped whenever the chart is (re)created so dependent structural effects
  // rebuild against the fresh chart instance.
  const [chartEpoch, setChartEpoch] = useState(0);

  // Ref so candle series autoscale provider does not close over stale chartType
  const chartTypeRef = useRef(chartType);
  chartTypeRef.current = chartType;

  /* ---------------- chart lifecycle ---------------- */

  useEffect(() => {
    if (!containerRef.current || candles.length === 0 || chartRef.current) return;

    const container = containerRef.current;
    const chart = createChart(container, {
      layout: {
        background: { color: theme.panel },
        textColor: theme.dim,
        // v5 splits panes with a draggable separator; theme it to the border.
        panes: { separatorColor: theme.border, separatorHoverColor: `${theme.blue}55` },
      },
      grid: {
        vertLines: { color: theme.border },
        horzLines: { color: theme.border },
      },
      width: container.clientWidth,
      height: container.clientHeight,
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 12 },
      rightPriceScale: { borderColor: theme.border },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: theme.upCandle,
      downColor: theme.downCandle,
      borderUpColor: theme.upCandle,
      borderDownColor: theme.downCandle,
      wickUpColor: theme.wickUp,
      wickDownColor: theme.wickDown,
      autoscaleInfoProvider: (base: () => AutoscaleInfo | null) =>
        chartTypeRef.current === "line" ? null : base(),
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // The line chart shares the main price scale and is toggled visible when active.
    const lineSeries = chart.addSeries(LineSeries, {
      color: theme.blue,
      lineWidth: 2,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
      visible: false,
    });

    const dayLines = new DayLinesPrimitive();
    candleSeries.attachPrimitive(dayLines);
    dayLinesRef.current = dayLines;

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    lineSeriesRef.current = lineSeries;

    // Signal dependent effects that a fresh chart is ready
    setChartEpoch((e) => e + 1);

    const resize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };
    window.addEventListener("resize", resize);

    // The container can change size without the window doing so: entering or
    // leaving the narrow single-column layout, a panel reorder, or the CSS
    // scale changing. Watching the element itself covers all of those.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => resize());
      ro.observe(container);
    }

    return () => {
      window.removeEventListener("resize", resize);
      ro?.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lineSeriesRef.current = null;
      dayLinesRef.current = null;
      sessionLinesRef.current = [];
    };
    // Recreated only when the theme changes; data flows through the effects below
  }, [candles.length > 0, theme]);

  /* ---------------- price + volume data ---------------- */

  // fitContent() runs once when the chart is built. Switching symbol or timeframe
  // replaces every timestamp with a different range, so the old viewport can end
  // up over a stretch that holds no data. Flag a refit and apply it once the new candles arrive.
  const pendingRefitRef = useRef(true);

  useEffect(() => {
    pendingRefitRef.current = true;
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    try {
      if (chartType === "line") {
        candleSeriesRef.current.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
        lineSeriesRef.current?.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            value: c.close,
          }))
        );
      } else {
        candleSeriesRef.current.setData(
          chartCandles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
        lineSeriesRef.current?.setData([]);
      }

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(
          chartCandles.map(
            (c): HistogramData => ({
              time: c.time as UTCTimestamp,
              value: c.volume || 0,
              color: c.close >= c.open ? `${theme.upCandle}55` : `${theme.downCandle}55`,
            })
          )
        );
      }

      if (pendingRefitRef.current) {
        pendingRefitRef.current = false;
        try {
          // Re-arm the price scale too: dragging the price axis switches it to
          // manual mode, and setData won't re-fit it.
          chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
          chartRef.current?.timeScale().fitContent();
        } catch {}
      }
    } catch {
      /* series disposed during a theme swap — next effect run repairs it */
    }
  }, [candles, chartCandles, chartType, theme]);

  // Toggle line series visibility in line mode
  useEffect(() => {
    try {
      lineSeriesRef.current?.applyOptions({ visible: chartType === "line" });
    } catch {}
  }, [chartType, theme]);

  // In line mode, candles are painted transparent so attached primitives (day lines, drawings)
  // continue to render without wicks or bodies interfering with the line
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    try {
      if (chartType === "line") {
        series.applyOptions({
          upColor: "rgba(0,0,0,0)",
          downColor: "rgba(0,0,0,0)",
          borderUpColor: "rgba(0,0,0,0)",
          borderDownColor: "rgba(0,0,0,0)",
          wickUpColor: "rgba(0,0,0,0)",
          wickDownColor: "rgba(0,0,0,0)",
          borderVisible: false,
          wickVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
        });
      } else {
        series.applyOptions({
          upColor: theme.upCandle,
          downColor: theme.downCandle,
          borderUpColor: theme.upCandle,
          borderDownColor: theme.downCandle,
          wickUpColor: theme.wickUp,
          wickDownColor: theme.wickDown,
          borderVisible: true,
          wickVisible: true,
          lastValueVisible: true,
          priceLineVisible: true,
        });
      }
    } catch {}
  }, [chartType, theme]);

  useEffect(() => {
    try {
      volumeSeriesRef.current?.applyOptions({ visible: showVolume });
    } catch {}
  }, [showVolume]);

  // UTC day separators. Recomputed from the candle set and re-coloured on theme change.
  useEffect(() => {
    const prim = dayLinesRef.current;
    if (!prim) return;
    prim.setBoundaries(
      showDayLines && candles.length > 0
        ? utcDayBoundaries(candles.map((c) => c.time))
        : [],
      theme.dim
    );
  }, [candles, showDayLines, theme]);

  // 24H & Previous Day High / Low watermark lines
  useEffect(() => {
    const targetSeries =
      chartType === "line"
        ? (lineSeriesRef.current ?? candleSeriesRef.current)
        : candleSeriesRef.current;
    if (!targetSeries) return;

    sessionLinesRef.current.forEach((l) => {
      try {
        candleSeriesRef.current?.removePriceLine(l);
        lineSeriesRef.current?.removePriceLine(l);
      } catch {}
    });
    sessionLinesRef.current = [];

    if (!showSessionHL || candles.length === 0) return;

    const lastCandle = candles[candles.length - 1];
    const cutoff24 = lastCandle.time - 86400;
    const candles24h = candles.filter((c) => c.time >= cutoff24);

    let hi24: number | null = null;
    let lo24: number | null = null;

    if (ticker && Number.isFinite(ticker.high) && Number.isFinite(ticker.low) && ticker.high! > 0 && ticker.low! > 0) {
      hi24 = ticker.high!;
      lo24 = ticker.low!;
    } else if (candles24h.length > 0) {
      hi24 = Math.max(...candles24h.map((c) => c.high));
      lo24 = Math.min(...candles24h.map((c) => c.low));
    } else {
      hi24 = lastCandle.high;
      lo24 = lastCandle.low;
    }

    const todayStart = Math.floor(lastCandle.time / 86400) * 86400;
    const prevDayStart = todayStart - 86400;
    let prevCandles = candles.filter((c) => c.time >= prevDayStart && c.time < todayStart);
    if (prevCandles.length === 0) {
      prevCandles = candles.filter((c) => c.time >= lastCandle.time - 172800 && c.time < cutoff24);
    }

    let prevHi: number | null = null;
    let prevLo: number | null = null;
    if (prevCandles.length > 0) {
      prevHi = Math.max(...prevCandles.map((c) => c.high));
      prevLo = Math.min(...prevCandles.map((c) => c.low));
    }

    const lines: IPriceLine[] = [];

    if (hi24 != null && Number.isFinite(hi24)) {
      lines.push(
        targetSeries.createPriceLine({
          price: hi24,
          color: theme.green,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lineVisible: true,
          axisLabelVisible: true,
          title: "24H HI",
        })
      );
    }

    if (lo24 != null && Number.isFinite(lo24)) {
      lines.push(
        targetSeries.createPriceLine({
          price: lo24,
          color: theme.red,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lineVisible: true,
          axisLabelVisible: true,
          title: "24H LO",
        })
      );
    }

    if (prevHi != null && Number.isFinite(prevHi)) {
      lines.push(
        targetSeries.createPriceLine({
          price: prevHi,
          color: "#38BDF8",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          lineVisible: true,
          axisLabelVisible: true,
          title: "PREV HI",
        })
      );
    }

    if (prevLo != null && Number.isFinite(prevLo)) {
      lines.push(
        targetSeries.createPriceLine({
          price: prevLo,
          color: "#F59E0B",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          lineVisible: true,
          axisLabelVisible: true,
          title: "PREV LO",
        })
      );
    }

    sessionLinesRef.current = lines;

    try {
      chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
    } catch {}
  }, [candles, showSessionHL, theme, chartType, ticker]);

  return {
    chartRef,
    candleSeriesRef,
    volumeSeriesRef,
    lineSeriesRef,
    dayLinesRef,
    chartEpoch,
  };
}
