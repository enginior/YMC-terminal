"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
  IChartApi,
  ISeriesApi,
  IPaneApi,
  UTCTimestamp,
  HistogramData,
  Time,
  IPriceLine,
  AutoscaleInfo,
} from "lightweight-charts";
import { Candle } from "@/lib/types";
import { useTheme, Theme } from "@/context/ThemeContext";
import { sma, ema, rsi, macd, bollingerBands, stochRsi } from "@/lib/indicators";
import { heikenAshi } from "@/lib/heikenAshi";
import { PriceBandPrimitive } from "@/lib/bands";
import { DayLinesPrimitive, utcDayBoundaries } from "@/lib/dayLines";
import { DrawingsPrimitive, Drawing, DrawingTool, hitTestDrawing, deleteHandlePoint, timeToCoordinateExtrapolated } from "@/lib/drawings";

// Binance interval codes — lowercase, matching /api/klines
const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"] as const;

type OverlayIndicator = "sma" | "ema" | "bollinger";
type PaneIndicator = "rsi" | "macd" | "stochrsi";
type IndicatorType = OverlayIndicator | PaneIndicator;

/** How the main price pane draws the series. */
export type ChartType = "candles" | "heiken" | "line";

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  candles: "Candles",
  heiken: "Heikin Ashi",
  line: "Line",
};

const CHART_TYPE_DESCRIPTIONS: Record<ChartType, string> = {
  candles: "Standard Candlesticks (OHLC)",
  heiken: "Smoothed Heikin Ashi trend bars",
  line: "Continuous close price curve",
};

const CHART_TYPE_KEY = "btc-terminal:chart-type";
const SESSION_HL_KEY = "btc-terminal:session-hl";

const INDICATOR_LABELS: Record<IndicatorType, string> = {
  sma: "SMA 20/50",
  ema: "EMA 20/50",
  bollinger: "Bollinger (20,2)",
  rsi: "RSI (14)",
  macd: "MACD (12,26,9)",
  stochrsi: "Stoch RSI (14,14,3,3)",
};

const OVERLAYS: OverlayIndicator[] = ["sma", "ema", "bollinger"];
const PANES: PaneIndicator[] = ["rsi", "macd", "stochrsi"];

/** Shape of the memoised indicator values (see `computed`). */
type ComputedValues = {
  sma20: (number | null)[];
  sma50: (number | null)[];
  ema20: (number | null)[];
  ema50: (number | null)[];
  bb: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] };
  rsi: (number | null)[];
  macd: { macdLine: (number | null)[]; signalLine: (number | null)[]; histogram: (number | null)[] };
  stochRsi: { k: (number | null)[]; d: (number | null)[] };
};

/** Overlay line definitions: theme colour slot + value accessor. */
const OVERLAY_SPECS: Record<
  OverlayIndicator,
  { colorKey: keyof Theme; values: (c: ComputedValues) => (number | null)[] }[]
> = {
  sma: [
    { colorKey: "blue", values: (c) => c.sma20 },
    { colorKey: "yellow", values: (c) => c.sma50 },
  ],
  ema: [
    { colorKey: "green", values: (c) => c.ema20 },
    { colorKey: "red", values: (c) => c.ema50 },
  ],
  bollinger: [
    { colorKey: "dim", values: (c) => c.bb.upper },
    { colorKey: "yellow", values: (c) => c.bb.middle },
    { colorKey: "dim", values: (c) => c.bb.lower },
  ],
};

type DrawMode = DrawingTool | "none";

const DRAWINGS_KEY = "btc-terminal:drawings";

/** Nearest of a candle's O/H/L/C to a raw price — the value the magnet snaps to. */
function snapPriceToOhlc(candle: Candle, price: number): number {
  let best = price;
  let bestDist = Infinity;
  for (const v of [candle.open, candle.high, candle.low, candle.close]) {
    const d = Math.abs(v - price);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

/** Candle whose open time matches an epoch-seconds timestamp. */
function candleAt(candles: Candle[], time: number): Candle | undefined {
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].time === time) return candles[i];
  }
  return undefined;
}

interface PriceChartProps {
  candles: Candle[];
  symbol: string;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  candleError?: boolean;
  onToggleMaximize?: () => void;
  isMaximized?: boolean;
  ticker?: { high?: number; low?: number } | null;
}

function ChartTypeIcon({
  type,
  theme,
  size = 11,
}: {
  type: ChartType;
  theme: Theme;
  size?: number;
}) {
  if (type === "candles") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
        <line x1="5" y1="2" x2="5" y2="14" stroke={theme.green} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="3.5" y="5" width="3" height="6" fill={theme.green} rx="0.5" />
        <line x1="11" y1="3" x2="11" y2="15" stroke={theme.red} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="9.5" y="4" width="3" height="7" fill={theme.red} rx="0.5" />
      </svg>
    );
  }
  if (type === "heiken") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
        <line x1="5" y1="3" x2="5" y2="13" stroke={theme.green} strokeWidth="1.2" strokeLinecap="round" />
        <rect x="3.5" y="4" width="3" height="7" fill={theme.green} rx="0.5" />
        <line x1="11" y1="2" x2="11" y2="12" stroke={theme.green} strokeWidth="1.2" strokeLinecap="round" />
        <rect x="9.5" y="3" width="3" height="7" fill={theme.green} rx="0.5" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path
        d="M2 12L6 8L10 10L14 4"
        stroke={theme.blue}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="4" r="1.5" fill={theme.blue} />
    </svg>
  );
}

export default function PriceChart({
  candles,
  symbol,
  timeframe,
  onTimeframeChange,
  candleError = false,
  onToggleMaximize,
  isMaximized = false,
  ticker,
}: PriceChartProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  // A line series lives alongside candleSeries so switching visuals never recreates the chart.
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorType>>(new Set());
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [chartTypeMenuOpen, setChartTypeMenuOpen] = useState(false);
  const skipChartTypeSaveRef = useRef(true);
  const skipSessionHLSaveRef = useRef(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showDayLines, setShowDayLines] = useState(true);
  const [showSessionHL, setShowSessionHL] = useState(false);
  const sessionLinesRef = useRef<IPriceLine[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [magnetOn, setMagnetOn] = useState(false);
  // Drawings are kept per symbol so switching pairs (and reloading) restores them.
  const [drawingsBySymbol, setDrawingsBySymbol] = useState<Record<string, Drawing[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Bumped whenever the chart is (re)created so the structural indicator effect
  // rebuilds panes/series against the fresh chart instance.
  const [chartEpoch, setChartEpoch] = useState(0);

  const drawings = drawingsBySymbol[symbol] ?? [];

  // Candles formatted for visual rendering (Heikin Ashi if selected)
  const chartCandles = useMemo(
    () => (chartType === "heiken" ? heikenAshi(candles) : candles),
    [candles, chartType]
  );

  // Candles for magnet snapping: snaps to close in line mode, or OHLC of display candles
  const snapCandles = useMemo(
    () =>
      chartType === "line"
        ? candles.map((c) => ({ ...c, open: c.close, high: c.close, low: c.close }))
        : chartCandles,
    [candles, chartCandles, chartType]
  );

  // Series created for indicators, torn down and rebuilt when the set changes.
  // Typed loosely because lightweight-charts requires per-series-type generics.
  const indicatorRefs = useRef<Map<IndicatorType, ISeriesApi<any>[]>>(new Map());
  // Sub-panes for RSI / MACD (v5 native panes), kept across theme changes so a
  // user-resized pane keeps its height until the indicator is switched off.
  const paneRefs = useRef<Map<PaneIndicator, IPaneApi<Time>>>(new Map());
  const dayLinesRef = useRef<DayLinesPrimitive | null>(null);
  const drawingsPrimRef = useRef<DrawingsPrimitive | null>(null);
  const draftRef = useRef<Drawing | null>(null);
  const anchorRef = useRef<{ time: number; price: number } | null>(null);
  // Hover changes on every crosshair move; keeping it in a ref (not state)
  // avoids a React render per mouse move. Selection mirrors into state so the
  // toolbar can react to it.
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  // Last time/price the magnet crosshair snapped to, so the re-entrant
  // crosshair event that setCrosshairPosition produces can be ignored instead of
  // looping. Time is included so moving to an adjacent candle with the same
  // snap price still repositions the vertical line.
  const lastSnapRef = useRef<{ time: number; price: number } | null>(null);

  // Refs so the chart's event handlers never close over stale state
  const stateRef = useRef({ drawMode, drawings, candles, snapCandles, theme, symbol, magnetOn, chartType });
  stateRef.current = { drawMode, drawings, candles, snapCandles, theme, symbol, magnetOn, chartType };

  // Load persisted chart visual type
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHART_TYPE_KEY) as ChartType | null;
      if (saved && (saved === "candles" || saved === "heiken" || saved === "line")) {
        setChartType(saved);
      }
    } catch {}
  }, []);

  // Persist chart visual type
  useEffect(() => {
    if (skipChartTypeSaveRef.current) {
      skipChartTypeSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(CHART_TYPE_KEY, chartType);
    } catch {}
  }, [chartType]);

  // Load persisted session High/Low toggle
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_HL_KEY);
      if (saved !== null) {
        setShowSessionHL(saved === "true");
      }
    } catch {}
  }, []);

  // Persist session High/Low toggle
  useEffect(() => {
    if (skipSessionHLSaveRef.current) {
      skipSessionHLSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(SESSION_HL_KEY, String(showSessionHL));
    } catch {}
  }, [showSessionHL]);

  // Delete one drawing. Reads the symbol from the state ref so the handler stays
  // stable across symbol switches.
  const removeDrawingById = useCallback((id: string) => {
    const sym = stateRef.current.symbol;
    setDrawingsBySymbol((prev) => ({
      ...prev,
      [sym]: (prev[sym] ?? []).filter((d) => d.id !== id),
    }));
    if (selectedRef.current === id) {
      selectedRef.current = null;
      setSelectedId(null);
    }
    if (hoveredRef.current === id) hoveredRef.current = null;
  }, []);

  const computed = useMemo(() => {
    if (candles.length === 0) return null;
    return {
      sma20: sma(candles, 20),
      sma50: sma(candles, 50),
      ema20: ema(candles, 20),
      ema50: ema(candles, 50),
      bb: bollingerBands(candles, 20, 2),
      rsi: rsi(candles, 14),
      macd: macd(candles),
      stochRsi: stochRsi(candles, 14, 14, 3, 3),
    };
  }, [candles]);

  // Latest indicator values for the structural effect, which runs when the
  // active set / theme changes rather than on every data tick.
  const computedRef = useRef<ComputedValues | null>(null);
  computedRef.current = computed;

  const line = (values: (number | null)[]) =>
    values
      .map((v, i) =>
        v === null ? null : { time: candles[i].time as UTCTimestamp, value: v }
      )
      .filter((d): d is { time: UTCTimestamp; value: number } => d !== null);

  const histData = (values: (number | null)[]) =>
    values
      .map((v, i) =>
        v === null
          ? null
          : ({
              time: candles[i].time as UTCTimestamp,
              value: v,
              color: v >= 0 ? `${theme.green}88` : `${theme.red}88`,
            } as HistogramData)
      )
      .filter((d): d is HistogramData => d !== null);

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
        stateRef.current.chartType === "line" ? null : base(),
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

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    lineSeriesRef.current = lineSeries;

    const dayLines = new DayLinesPrimitive();
    candleSeries.attachPrimitive(dayLines);
    dayLinesRef.current = dayLines;

    // Drawings live on a primitive so boxes and full-width levels render, and so
    // the in-progress draft can be painted without a React render per pointer move.
    const drawingsPrim = new DrawingsPrimitive();
    candleSeries.attachPrimitive(drawingsPrim);
    drawingsPrim.setStyle({ labelBg: theme.panel });
    drawingsPrim.setDrawings(stateRef.current.drawings);
    drawingsPrim.setCandles(stateRef.current.candles);
    drawingsPrimRef.current = drawingsPrim;

    /* ---- hover + select, only while no tool is active ---- */

    const topmostAt = (p: { x: number; y: number }): string | null => {
      const list = stateRef.current.drawings;
      for (let i = list.length - 1; i >= 0; i--) {
        if (hitTestDrawing(list[i], p, chart, candleSeries, undefined, stateRef.current.candles)) return list[i].id;
      }
      return null;
    };

    const onCrosshairMove = (param: any) => {
      const prim = drawingsPrimRef.current;
      if (!prim) return;

      // Drawings and magnet live on the candle pane only. In v5 a crosshair
      // move over a sub-pane still fires with chart-relative coordinates, so
      // gate on the pane index to avoid snapping/hit-testing there.
      const mainPane = (param.paneIndex ?? 0) === 0;

      // Magnet: pull the crosshair onto the nearest OHLC of the hovered candle.
      // setCrosshairPosition re-fires this handler, so lastSnapRef stops the loop
      // once the snapped price is unchanged.
      if (stateRef.current.magnetOn && mainPane && param.point && typeof param.time === "number") {
        const activeSeries = stateRef.current.chartType === "line" ? (lineSeriesRef.current ?? candleSeries) : candleSeries;
        const price = activeSeries.coordinateToPrice(param.point.y);
        const candle = candleAt(stateRef.current.snapCandles, param.time);
        if (price != null && candle) {
          const snapped = snapPriceToOhlc(candle, price);
          const last = lastSnapRef.current;
          if (!last || last.time !== param.time || last.price !== snapped) {
            lastSnapRef.current = { time: param.time, price: snapped };
            chart.setCrosshairPosition(snapped, param.time, activeSeries);
          }
        }
      }

      if (!mainPane || stateRef.current.drawMode !== "none" || !param.point) {
        if (hoveredRef.current === null) return;
        hoveredRef.current = null;
        prim.setInteraction(null, selectedRef.current);
        if (containerRef.current) containerRef.current.style.cursor = "default";
        return;
      }
      const hit = topmostAt(param.point);
      if (hit === hoveredRef.current) return;
      hoveredRef.current = hit;
      prim.setInteraction(hit, selectedRef.current);
      if (containerRef.current) containerRef.current.style.cursor = hit ? "pointer" : "default";
    };

    const onClick = (param: any) => {
      if ((param.paneIndex ?? 0) !== 0) return;
      if (stateRef.current.drawMode !== "none" || !param.point) return;
      const p = param.point;

      // A click on the selected drawing's delete button removes it.
      const sel = stateRef.current.drawings.find((d) => d.id === selectedRef.current);
      if (sel) {
        const h = deleteHandlePoint(sel, chart, candleSeries, stateRef.current.candles);
        if (h && Math.hypot(p.x - h.x, p.y - h.y) <= 12) {
          removeDrawingById(sel.id);
          return;
        }
      }

      const hit = topmostAt(p);
      selectedRef.current = hit;
      setSelectedId(hit);
      drawingsPrimRef.current?.setInteraction(hoveredRef.current, hit);
    };

    chart.subscribeCrosshairMove(onCrosshairMove);
    chart.subscribeClick(onClick);

    // Signal the structural indicator effect that a fresh chart is ready.
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
    // scale changing. Watching the element itself covers all of those, which a
    // window-level listener alone would miss and leave the canvas mis-sized.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => resize());
      ro.observe(container);
    }

    return () => {
      window.removeEventListener("resize", resize);
      ro?.disconnect();
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.unsubscribeClick(onClick);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lineSeriesRef.current = null;
      dayLinesRef.current = null;
      drawingsPrimRef.current = null;
      sessionLinesRef.current = [];
      indicatorRefs.current.clear();
      // Panes belong to the disposed chart; drop the refs so a fresh chart
      // rebuilds them instead of reusing dead handles.
      paneRefs.current.clear();
    };
    // Recreated only when the theme changes; data flows through the effects below
  }, [candles.length > 0, theme]);

  /* ---------------- price + volume data ---------------- */

  // fitContent() runs once when the chart is built. Switching symbol or timeframe
  // replaces every timestamp with a different range, so the old viewport can end
  // up over a stretch that holds no data — which reads as a blank chart. Flag a
  // refit and apply it once the new candles have been pushed in.
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
          // manual mode, and `setData` won't re-fit it. Without this, switching
          // to a symbol in a different price regime (BTC ~80k -> GOLD ~4k) leaves
          // the axis parked on the old range until the user resets it by hand.
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

    // Current 24H High & Low (from ticker if available, else windowed from last 24h of candles)
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

    // Previous Day High & Low (PDH / PDL: previous UTC session or previous 24h-48h window)
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

  /* ---------------- indicators ---------------- */

  // Structural effect: create / destroy indicator series and their panes (v5
  // native panes) when the active set or theme changes. Data is pushed by the
  // data effect below so live ticks never rebuild panes — rebuilding would reset
  // a user-resized pane height on every tick.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // tear down previous indicator series
    indicatorRefs.current.forEach((seriesList) => {
      seriesList.forEach((s) => {
        try {
          chart.removeSeries(s);
        } catch {}
      });
    });
    indicatorRefs.current.clear();

    // Drop sub-panes that are no longer active. Panes are created with
    // preserveEmptyPane so they survive the teardown above and keep their size;
    // that also means they must be removed explicitly when switched off.
    paneRefs.current.forEach((pane, key) => {
      if (!activeIndicators.has(key)) {
        try {
          chart.removePane(pane.paneIndex());
        } catch {}
        paneRefs.current.delete(key);
      }
    });

    const comp = computedRef.current;
    if (!comp) return;

    // Reuse an existing pane (keeps a user-resized height); create one otherwise.
    const ensurePane = (key: PaneIndicator): IPaneApi<Time> => {
      let pane = paneRefs.current.get(key);
      if (!pane) {
        pane = chart.addPane(true);
        pane.setStretchFactor(1);
        // Keep the candle pane dominant; sub-panes split what's left.
        chart.panes()[0]?.setStretchFactor(4);
        paneRefs.current.set(key, pane);
      }
      return pane;
    };

    OVERLAYS.forEach((key) => {
      if (!activeIndicators.has(key)) return;
      const created = OVERLAY_SPECS[key].map((spec) => {
        const s = chart.addSeries(LineSeries, {
          color: theme[spec.colorKey],
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s.setData(line(spec.values(comp)));
        return s;
      });
      indicatorRefs.current.set(key, created);
    });

    if (activeIndicators.has("rsi")) {
      const pane = ensurePane("rsi");
      const r = pane.addSeries(LineSeries, {
        color: theme.blue,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        // RSI is bounded 0..100, so pin the pane's own right scale to it.
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
      });
      r.setData(line(comp.rsi));
      // Shade the neutral zone between the overbought and oversold references.
      const rsiBand = new PriceBandPrimitive();
      r.attachPrimitive(rsiBand);
      rsiBand.setBand(70, 30, `${theme.dim}22`);
      // Overbought / midline / oversold references, drawn as thin dashed lines.
      [70, 50, 30].forEach((price) =>
        r.createPriceLine({
          price,
          color: theme.dim,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lineVisible: true,
          axisLabelVisible: false,
          title: "",
        })
      );
      indicatorRefs.current.set("rsi", [r]);
    }

    if (activeIndicators.has("macd")) {
      const pane = ensurePane("macd");
      const macdSeries = pane.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
      });
      macdSeries.setData(histData(comp.macd.histogram));

      const macdLineS = pane.addSeries(LineSeries, {
        color: theme.blue,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      macdLineS.setData(line(comp.macd.macdLine));

      const signalS = pane.addSeries(LineSeries, {
        color: theme.yellow,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      signalS.setData(line(comp.macd.signalLine));

      indicatorRefs.current.set("macd", [macdSeries, macdLineS, signalS]);
    }

    if (activeIndicators.has("stochrsi")) {
      const pane = ensurePane("stochrsi");
      // Bounded 0..100, so pin the pane's own right scale like RSI.
      const kSeries = pane.addSeries(LineSeries, {
        color: theme.blue,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
      });
      kSeries.setData(line(comp.stochRsi.k));

      const dSeries = pane.addSeries(LineSeries, {
        color: theme.yellow,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      dSeries.setData(line(comp.stochRsi.d));

      // Shade the neutral zone between the 80 / 20 references.
      const stochBand = new PriceBandPrimitive();
      kSeries.attachPrimitive(stochBand);
      stochBand.setBand(80, 20, `${theme.dim}22`);

      [80, 20].forEach((price) =>
        kSeries.createPriceLine({
          price,
          color: theme.dim,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lineVisible: true,
          axisLabelVisible: false,
          title: "",
        })
      );
      indicatorRefs.current.set("stochrsi", [kSeries, dSeries]);
    }
  }, [activeIndicators, theme, chartEpoch]);

  // Data effect: push fresh values into the existing series on every tick.
  useEffect(() => {
    if (!computed) return;

    OVERLAYS.forEach((key) => {
      const entry = indicatorRefs.current.get(key);
      if (!entry) return;
      OVERLAY_SPECS[key].forEach((spec, i) => {
        try {
          entry[i]?.setData(line(spec.values(computed)));
        } catch {}
      });
    });

    const rsiEntry = indicatorRefs.current.get("rsi");
    if (rsiEntry?.[0]) {
      try {
        rsiEntry[0].setData(line(computed.rsi));
      } catch {}
    }

    const macdEntry = indicatorRefs.current.get("macd");
    if (macdEntry?.[0] && macdEntry[1] && macdEntry[2]) {
      try {
        macdEntry[0].setData(histData(computed.macd.histogram));
        macdEntry[1].setData(line(computed.macd.macdLine));
        macdEntry[2].setData(line(computed.macd.signalLine));
      } catch {}
    }

    const stochEntry = indicatorRefs.current.get("stochrsi");
    if (stochEntry?.[0] && stochEntry[1]) {
      try {
        stochEntry[0].setData(line(computed.stochRsi.k));
        stochEntry[1].setData(line(computed.stochRsi.d));
      } catch {}
    }
  }, [computed, theme]);

  /* ---------------- user drawings ---------------- */

  // Restore saved drawings after mount (localStorage read must not run during
  // render, or the server and client markup diverge).
  //
  // The save effect below also fires on mount, with the empty initial state,
  // which would clobber storage before this load's state lands — and under
  // StrictMode the mount is double-invoked, so the second read would then see
  // the emptied map. Skip exactly one write so defaults never overwrite data.
  const skipNextSaveRef = useRef(true);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAWINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setDrawingsBySymbol(parsed);
        }
      }
    } catch {
      /* unreadable or corrupt — start empty */
    }
  }, []);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(DRAWINGS_KEY, JSON.stringify(drawingsBySymbol));
    } catch {
      /* private mode or quota — drawings just won't persist */
    }
  }, [drawingsBySymbol]);

  // Push the committed set (and the theme's label colour) to the primitive.
  useEffect(() => {
    const prim = drawingsPrimRef.current;
    if (!prim) return;
    prim.setStyle({ labelBg: theme.panel });
    prim.setDrawings(drawings);
    prim.setCandles(snapCandles);
    prim.setInteraction(hoveredRef.current, selectedRef.current);
  }, [drawings, theme, snapCandles]);

  // Drop any selection when the symbol changes — it belongs to the old pair.
  useEffect(() => {
    selectedRef.current = null;
    hoveredRef.current = null;
    setSelectedId(null);
    drawingsPrimRef.current?.setInteraction(null, null);
  }, [symbol]);

  // Toggling the magnet off releases the snapped crosshair so it follows the
  // cursor again; either way the snap memo resets.
  useEffect(() => {
    lastSnapRef.current = null;
    if (!magnetOn) chartRef.current?.clearCrosshairPosition();
  }, [magnetOn]);

  const setDraft = (draft: Drawing | null) => {
    draftRef.current = draft;
    drawingsPrimRef.current?.setDraft(draft);
  };

  const nextColor = () => {
    const palette = [theme.yellow, theme.blue, theme.red, theme.green];
    return palette[drawings.length % palette.length];
  };

  /** Screen point -> chart time / price, or null when off-pane. */
  const toChartPoint = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!el || !chart || !series) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (y < 0 || y > rect.height) return null;

    const timeScale = chart.timeScale();
    const directTime = timeScale.coordinateToTime(x);
    let time: number | null = typeof directTime === "number" ? directTime : null;
    let price: number | null = series.coordinateToPrice(y);
    if (price == null) return null;

    // Extrapolate time into future whitespace when coordinateToTime is null (beyond latest candle)
    if (time == null) {
      const logical = timeScale.coordinateToLogical(x);
      const candles = stateRef.current.candles;
      if (logical !== null && candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        const lastIdx = candles.length - 1;
        const step = candles.length >= 2
          ? Math.max(1, lastCandle.time - candles[candles.length - 2].time)
          : 60;
        time = Math.round(lastCandle.time + (logical - lastIdx) * step);
      } else {
        return null;
      }
    }

    if (typeof time !== "number") return null;

    // Magnet: place drawing anchors on the candle's nearest OHLC, matching the
    // crosshair, so a line lands exactly on a wick/body edge.
    if (stateRef.current.magnetOn) {
      const candle = candleAt(stateRef.current.snapCandles, time);
      if (candle) price = snapPriceToOhlc(candle, price);
    }
    return { time, price };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (drawMode === "none") return;
    const pt = toChartPoint(e.clientX, e.clientY);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    anchorRef.current = pt;
    setDraft({
      id: "draft",
      tool: drawMode,
      time1: pt.time,
      price1: pt.price,
      time2: pt.time,
      price2: pt.price,
      color: drawMode === "ruler" ? theme.yellow : nextColor(),
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const anchor = anchorRef.current;
    const draft = draftRef.current;
    if (!anchor || !draft) return;
    const pt = toChartPoint(e.clientX, e.clientY);
    if (!pt) return;
    setDraft({ ...draft, time2: pt.time, price2: pt.price });
    // The overlay swallows chart events while drawing, so drive the magnet
    // crosshair from here to keep the aiming feedback visible.
    if (stateRef.current.magnetOn) {
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      const candle = candleAt(stateRef.current.snapCandles, pt.time);
      if (chart && series && candle) {
        const source = stateRef.current.chartType === "line" ? (lineSeriesRef.current ?? series) : series;
        chart.setCrosshairPosition(pt.price, pt.time as UTCTimestamp, source);
      } else if (chart) {
        chart.clearCrosshairPosition();
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const anchor = anchorRef.current;
    const draft = draftRef.current;
    anchorRef.current = null;
    if (!anchor || !draft) {
      setDraft(null);
      return;
    }

    // A trend/box/ruler needs a real drag; a click with no movement is treated as a
    // cancel rather than committing a degenerate shape.
    if (draft.tool !== "level") {
      const el = containerRef.current;
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      if (el && chart && series) {
        const rect = el.getBoundingClientRect();
        const x1 = timeToCoordinateExtrapolated(draft.time1, chart.timeScale(), stateRef.current.candles);
        const y1 = series.priceToCoordinate(draft.price1);
        if (x1 != null && y1 != null) {
          const dx = Math.abs(e.clientX - rect.left - x1);
          const dy = Math.abs(e.clientY - rect.top - y1);
          if (dx < 4 && dy < 4) {
            setDraft(null);
            return;
          }
        }
      }
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setDrawingsBySymbol((prev) => ({
      ...prev,
      [symbol]: [...(prev[symbol] ?? []), { ...draft, id }],
    }));
    setDraft(null);
  };

  // Escape abandons an in-progress shape or clears a selection; Delete /
  // Backspace removes the selected drawing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.key === "Escape") {
        anchorRef.current = null;
        draftRef.current = null;
        drawingsPrimRef.current?.setDraft(null);
        if (selectedRef.current !== null) {
          selectedRef.current = null;
          setSelectedId(null);
          drawingsPrimRef.current?.setInteraction(hoveredRef.current, null);
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && !typing && selectedRef.current) {
        e.preventDefault();
        removeDrawingById(selectedRef.current);
        return;
      }

      if (!typing) {
        if (e.key === "v" || e.key === "V") {
          e.preventDefault();
          setShowVolume((prev) => !prev);
          return;
        }
        if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          setShowDayLines((prev) => !prev);
          return;
        }
        if (e.key === "m" || e.key === "M") {
          e.preventDefault();
          setMagnetOn((prev) => !prev);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeDrawingById]);

  /* ---------------- ui ---------------- */

  const toggle = (id: IndicatorType) =>
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const clearDrawings = () => {
    setDraft(null);
    selectedRef.current = null;
    hoveredRef.current = null;
    setSelectedId(null);
    drawingsPrimRef.current?.setInteraction(null, null);
    setDrawingsBySymbol((prev) => ({ ...prev, [symbol]: [] }));
  };

  const exportPng = useCallback(() => {
    if (!chartRef.current) return;
    try {
      const canvas = chartRef.current.takeScreenshot();
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const cleanSym = symbol.replace(/[\/\s]/g, "");
      link.href = url;
      link.download = `${cleanSym}_${timeframe}_chart.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to capture chart screenshot:", err);
    }
  }, [symbol, timeframe]);

  const exportCsv = useCallback(() => {
    if (!candles || candles.length === 0) return;
    try {
      const headers = "Timestamp,DateTimeUTC,Open,High,Low,Close,Volume\n";
      const rows = candles
        .map((c) => {
          const iso = new Date(c.time * 1000).toISOString();
          return `${c.time},${iso},${c.open},${c.high},${c.low},${c.close},${c.volume}`;
        })
        .join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const cleanSym = symbol.replace(/[\/\s]/g, "");
      link.href = url;
      link.download = `${cleanSym}_${timeframe}_ohlcv.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export CSV:", err);
    }
  }, [candles, symbol, timeframe]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div
        className="px-2 py-1.5 border-b flex items-center gap-2 flex-wrap shrink-0"
        style={{ borderColor: theme.border }}
      >
        <span className="text-[10px] uppercase tracking-wider" style={{ color: theme.dim }}>
          {symbol}
        </span>
        <span style={{ color: theme.dim }}>|</span>

        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
            style={{
              color: timeframe === tf ? theme.bg : theme.dim,
              background: timeframe === tf ? theme.text : "transparent",
            }}
          >
            {tf}
          </button>
        ))}

        <span className="ml-2" style={{ color: theme.dim }}>|</span>

        {/* Chart Visuals Dropdown (Candles, Heikin Ashi, Line) */}
        <div className="relative">
          <button
            onClick={() => setChartTypeMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setChartTypeMenuOpen(false), 150)}
            className="text-[10px] px-2 py-0.5 rounded border hover:opacity-80 flex items-center gap-1.5 font-medium transition-colors"
            style={{
              borderColor: chartTypeMenuOpen ? theme.yellow : theme.border,
              background: chartType !== "candles" ? `${theme.yellow}15` : "transparent",
              color: chartType !== "candles" ? theme.yellow : theme.text,
            }}
            title="Chart Style: Candlesticks, Heikin Ashi, Line"
          >
            <ChartTypeIcon type={chartType} theme={theme} size={11} />
            <span>{CHART_TYPE_LABELS[chartType]}</span>
            <span className="text-[8px] opacity-70">▾</span>
          </button>

          {chartTypeMenuOpen && (
            <div
              className="absolute top-full left-0 mt-1 rounded border p-1 z-30 min-w-[150px] shadow-xl"
              style={{ background: theme.panel, borderColor: theme.border }}
            >
              <div className="text-[8px] uppercase tracking-wider px-2 py-1 font-semibold" style={{ color: theme.dim }}>
                Chart Visuals
              </div>
              {(["candles", "heiken", "line"] as ChartType[]).map((type) => {
                const isSelected = chartType === type;
                return (
                  <button
                    key={type}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setChartType(type);
                      setChartTypeMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] text-left hover:opacity-80 transition-colors"
                    style={{
                      background: isSelected ? `${theme.yellow}20` : "transparent",
                      color: isSelected ? theme.yellow : theme.text,
                    }}
                    title={CHART_TYPE_DESCRIPTIONS[type]}
                  >
                    <div className="flex items-center gap-2">
                      <ChartTypeIcon type={type} theme={theme} size={12} />
                      <div className="flex flex-col">
                        <span>{CHART_TYPE_LABELS[type]}</span>
                        <span className="text-[8px] opacity-60 font-normal">
                          {type === "candles" ? "Standard OHLC" : type === "heiken" ? "Averaged trend" : "Close curve"}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-bold" style={{ color: theme.yellow }}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowVolume((v) => !v)}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
          style={{ color: showVolume ? theme.green : theme.dim }}
        >
          VOL
        </button>

        <button
          onClick={() => setShowDayLines((v) => !v)}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
          style={{ color: showDayLines ? theme.green : theme.dim }}
          title="UTC day boundaries"
        >
          DAY
        </button>

        <button
          onClick={() => setShowSessionHL((v) => !v)}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
          style={{
            color: showSessionHL ? theme.yellow : theme.dim,
            background: showSessionHL ? `${theme.yellow}22` : "transparent",
          }}
          title="Toggle 24H & Previous Day High / Low price watermark lines"
        >
          H/L
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
            className="text-[10px] px-1.5 py-0.5 rounded border hover:opacity-70"
            style={{
              borderColor: theme.border,
              color: activeIndicators.size ? theme.green : theme.dim,
            }}
          >
            Indicators{activeIndicators.size ? ` (${activeIndicators.size})` : ""}
          </button>

          {menuOpen && (
            <div
              className="absolute top-full left-0 mt-1 rounded border p-1.5 z-20 min-w-[150px]"
              style={{ background: theme.panel, borderColor: theme.border }}
            >
              <div className="text-[8px] uppercase tracking-wider px-1 pb-0.5" style={{ color: theme.dim }}>
                Overlay
              </div>
              {OVERLAYS.map((id) => (
                <label
                  key={id}
                  className="flex items-center gap-1.5 text-[10px] py-0.5 px-1 cursor-pointer hover:opacity-80"
                  style={{ color: theme.text }}
                >
                  <input
                    type="checkbox"
                    checked={activeIndicators.has(id)}
                    onChange={() => toggle(id)}
                    style={{ accentColor: theme.green }}
                  />
                  {INDICATOR_LABELS[id]}
                </label>
              ))}

              <div
                className="text-[8px] uppercase tracking-wider px-1 pb-0.5 pt-1"
                style={{ color: theme.dim, borderTop: `1px solid ${theme.border}`, marginTop: 4 }}
              >
                Sub-pane
              </div>
              {PANES.map((id) => (
                <label
                  key={id}
                  className="flex items-center gap-1.5 text-[10px] py-0.5 px-1 cursor-pointer hover:opacity-80"
                  style={{ color: theme.text }}
                >
                  <input
                    type="checkbox"
                    checked={activeIndicators.has(id)}
                    onChange={() => toggle(id)}
                    style={{ accentColor: theme.green }}
                  />
                  {INDICATOR_LABELS[id]}
                </label>
              ))}
            </div>
          )}
        </div>

        <span className="ml-2" style={{ color: theme.dim }}>|</span>

        <button
          onClick={() => setMagnetOn((v) => !v)}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
          style={{
            color: magnetOn ? theme.bg : theme.dim,
            background: magnetOn ? theme.green : "transparent",
          }}
          title="Magnet: snap the crosshair and drawings to the nearest OHLC value"
        >
          🧲 Magnet
        </button>

        <button
          onClick={() => setDrawMode((m) => (m === "level" ? "none" : "level"))}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
          style={{
            color: drawMode === "level" ? theme.bg : theme.dim,
            background: drawMode === "level" ? theme.yellow : "transparent",
          }}
        >
          ─ Level
        </button>

        <button
          onClick={() => setDrawMode((m) => (m === "trend" ? "none" : "trend"))}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
          style={{
            color: drawMode === "trend" ? theme.bg : theme.dim,
            background: drawMode === "trend" ? theme.blue : "transparent",
          }}
        >
          ╱ Trend
        </button>

        <button
          onClick={() => setDrawMode((m) => (m === "rect" ? "none" : "rect"))}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
          style={{
            color: drawMode === "rect" ? theme.bg : theme.dim,
            background: drawMode === "rect" ? theme.green : "transparent",
          }}
        >
          ▭ Box
        </button>

        <button
          onClick={() => setDrawMode((m) => (m === "ruler" ? "none" : "ruler"))}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
          style={{
            color: drawMode === "ruler" ? theme.bg : theme.dim,
            background: drawMode === "ruler" ? theme.yellow : "transparent",
          }}
          title="Measure price & percentage delta across a region"
        >
          📐 Ruler
        </button>

        <button
          onClick={clearDrawings}
          disabled={drawings.length === 0}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70 disabled:opacity-30"
          style={{ color: theme.red }}
        >
          Clear
        </button>

        {selectedId && (
          <button
            onClick={() => removeDrawingById(selectedId)}
            className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
            style={{ color: theme.bg, background: theme.red }}
            title="Delete selected drawing (Del)"
          >
            ✕ Delete
          </button>
        )}

        {drawMode !== "none" && (
          <span className="text-[10px] ml-1 animate-pulse" style={{ color: theme.yellow }}>
            {drawMode === "level"
              ? "Click or drag to place a level"
              : drawMode === "trend"
                ? "Drag to draw a trend line"
                : drawMode === "rect"
                  ? "Drag to draw a box"
                  : "Drag to measure price & percentage delta"}
          </span>
        )}

        {candles.length === 0 && (
          <span className="text-[11px] ml-2" style={{ color: candleError ? theme.red : theme.yellow }}>
            {candleError ? "Candle feed unavailable for this symbol" : "Loading candles…"}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={exportPng}
            disabled={candles.length === 0}
            className="text-[10px] px-1.5 py-0.5 rounded border hover:opacity-70 disabled:opacity-30"
            style={{ borderColor: theme.border, color: theme.dim }}
            title="Export chart snapshot as PNG"
          >
            📷 Snap
          </button>
          <button
            onClick={exportCsv}
            disabled={candles.length === 0}
            className="text-[10px] px-1.5 py-0.5 rounded border hover:opacity-70 disabled:opacity-30"
            style={{ borderColor: theme.border, color: theme.dim }}
            title="Download OHLCV candle data as CSV"
          >
            📥 CSV
          </button>
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              className="text-[10px] px-1.5 py-0.5 rounded border hover:opacity-70 font-mono"
              style={{
                borderColor: isMaximized ? theme.yellow : theme.border,
                color: isMaximized ? theme.yellow : theme.dim,
              }}
              title={isMaximized ? "Restore grid (Esc)" : "Maximize chart (f)"}
            >
              {isMaximized ? "✕ Restore" : "⤢ Max"}
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-1 w-full min-h-0 overflow-hidden">
        {/* Counter-scale the chart pane. The app wraps everything in
            `transform: scale(--ui-scale)`, but lightweight-charts measures its
            size from the transformed rect and then treats pointer coords
            (`clientX - rect.left`) as its own space — so under a scale it lays
            out a 1.05x backing store and maps the crosshair/drawings ~5% off.
            Scaling this wrapper by 1/scale (and growing it by scale so it still
            fills the pane) makes the net transform on the chart identity, so the
            library's coordinates line up with the cursor again. */}
        <div
          className="absolute left-0 top-0"
          style={{
            width: "calc(100% * var(--ui-scale))",
            height: "calc(100% * var(--ui-scale))",
            transform: "scale(calc(1 / var(--ui-scale)))",
            transformOrigin: "top left",
          }}
        >
          <div ref={containerRef} className="absolute inset-0" />

          {/* Input catcher: only mounted while a tool is active, so it never
              interferes with panning, the crosshair, or tooltips. */}
          {drawMode !== "none" && (
            <div
              className="absolute inset-0 z-10"
              style={{ cursor: "crosshair", touchAction: "none", userSelect: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          )}
        </div>
      </div>
    </div>
  );
}
