import { useEffect, useRef, useState, useCallback } from "react";
import { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { Candle } from "@/lib/types";
import { Theme } from "@/context/ThemeContext";
import {
  DrawingsPrimitive,
  Drawing,
  DrawingTool,
  hitTestDrawing,
  deleteHandlePoint,
  timeToCoordinateExtrapolated,
} from "@/lib/drawings";
import {
  ChartType,
  DrawMode,
  DRAWINGS_KEY,
  snapPriceToOhlc,
  candleAt,
} from "./types";

interface UseDrawingsOptions {
  chartRef: React.RefObject<IChartApi | null>;
  candleSeriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
  lineSeriesRef: React.RefObject<ISeriesApi<"Line"> | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  candles: Candle[];
  snapCandles: Candle[];
  symbol: string;
  theme: Theme;
  chartType: ChartType;
  chartEpoch: number;
  setShowVolume: React.Dispatch<React.SetStateAction<boolean>>;
  setShowDayLines: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useDrawings({
  chartRef,
  candleSeriesRef,
  lineSeriesRef,
  containerRef,
  candles,
  snapCandles,
  symbol,
  theme,
  chartType,
  chartEpoch,
  setShowVolume,
  setShowDayLines,
}: UseDrawingsOptions) {
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [magnetOn, setMagnetOn] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [lastLineTool, setLastLineTool] = useState<"trend" | "ray" | "hray" | "level" | "arrow">("trend");
  const [lastShapeTool, setLastShapeTool] = useState<"rect" | "channel">("rect");
  const [lastPositionTool, setLastPositionTool] = useState<"long" | "short">("long");
  const [drawingsBySymbol, setDrawingsBySymbol] = useState<Record<string, Drawing[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const drawings = drawingsBySymbol[symbol] ?? [];

  const drawingsPrimRef = useRef<DrawingsPrimitive | null>(null);
  const draftRef = useRef<Drawing | null>(null);
  const anchorRef = useRef<{ time: number; price: number } | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const lastSnapRef = useRef<{ time: number; price: number } | null>(null);

  // State ref to prevent event handlers from closing over stale state
  const stateRef = useRef({
    drawMode,
    drawings,
    candles,
    snapCandles,
    theme,
    symbol,
    magnetOn,
    chartType,
    isLocked,
    isHidden,
  });
  stateRef.current = {
    drawMode,
    drawings,
    candles,
    snapCandles,
    theme,
    symbol,
    magnetOn,
    chartType,
    isLocked,
    isHidden,
  };

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

  const clearDrawings = useCallback(() => {
    draftRef.current = null;
    drawingsPrimRef.current?.setDraft(null);
    selectedRef.current = null;
    hoveredRef.current = null;
    setSelectedId(null);
    drawingsPrimRef.current?.setInteraction(null, null);
    setDrawingsBySymbol((prev) => ({ ...prev, [symbol]: [] }));
  }, [symbol]);

  /* ---------------- drawings persistence (localStorage) ---------------- */

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
    } catch {}
  }, []);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(DRAWINGS_KEY, JSON.stringify(drawingsBySymbol));
    } catch {}
  }, [drawingsBySymbol]);

  /* ---------------- primitive lifecycle ---------------- */

  useEffect(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return;

    const drawingsPrim = new DrawingsPrimitive();
    series.attachPrimitive(drawingsPrim);
    drawingsPrim.setStyle({ labelBg: theme.panel });
    drawingsPrim.setDrawings(stateRef.current.drawings);
    drawingsPrim.setCandles(stateRef.current.candles);
    drawingsPrimRef.current = drawingsPrim;

    const topmostAt = (p: { x: number; y: number }): string | null => {
      if (stateRef.current.isLocked || stateRef.current.isHidden) return null;
      const list = stateRef.current.drawings;
      for (let i = list.length - 1; i >= 0; i--) {
        if (hitTestDrawing(list[i], p, chart, series, undefined, stateRef.current.candles)) {
          return list[i].id;
        }
      }
      return null;
    };

    const onCrosshairMove = (param: any) => {
      const prim = drawingsPrimRef.current;
      if (!prim) return;

      const mainPane = (param.paneIndex ?? 0) === 0;

      // Magnet: pull crosshair onto nearest OHLC of hovered candle
      if (stateRef.current.magnetOn && mainPane && param.point && typeof param.time === "number") {
        const activeSeries =
          stateRef.current.chartType === "line"
            ? (lineSeriesRef.current ?? series)
            : series;
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
      if (stateRef.current.isLocked || stateRef.current.isHidden) return;
      if (stateRef.current.drawMode !== "none" || !param.point) return;
      const p = param.point;

      // A click on the selected drawing's delete button removes it
      const sel = stateRef.current.drawings.find((d) => d.id === selectedRef.current);
      if (sel) {
        const h = deleteHandlePoint(sel, chart, series, stateRef.current.candles);
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

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.unsubscribeClick(onClick);
      drawingsPrimRef.current = null;
    };
  }, [chartEpoch, theme, removeDrawingById, chartRef, candleSeriesRef, lineSeriesRef, containerRef]);

  // Push committed drawings and styles to the primitive
  useEffect(() => {
    const prim = drawingsPrimRef.current;
    if (!prim) return;
    prim.setStyle({ labelBg: theme.panel });
    prim.setHidden(isHidden);
    prim.setDrawings(drawings);
    prim.setCandles(snapCandles);
    prim.setInteraction(hoveredRef.current, selectedRef.current);
  }, [drawings, theme, snapCandles, isHidden]);

  // Drop selection when symbol changes, or when drawings are locked or hidden
  useEffect(() => {
    selectedRef.current = null;
    hoveredRef.current = null;
    setSelectedId(null);
    drawingsPrimRef.current?.setInteraction(null, null);
    if (containerRef.current) containerRef.current.style.cursor = "default";
  }, [symbol, isLocked, isHidden, containerRef]);

  // Toggling magnet off releases snapped crosshair
  useEffect(() => {
    lastSnapRef.current = null;
    if (!magnetOn) chartRef.current?.clearCrosshairPosition();
  }, [magnetOn, chartRef]);

  /* ---------------- pointer events on overlay ---------------- */

  const setDraft = (draft: Drawing | null) => {
    draftRef.current = draft;
    drawingsPrimRef.current?.setDraft(draft);
  };

  const nextColor = (tool: DrawingTool) => {
    if (tool === "ruler" || tool === "fib" || tool === "arrow" || tool === "hray")
      return theme.yellow;
    if (tool === "long") return theme.green;
    if (tool === "short") return theme.red;
    if (tool === "channel") return theme.blue;
    const palette = [theme.yellow, theme.blue, theme.red, theme.green];
    return palette[drawings.length % palette.length];
  };

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

    // Extrapolate time into future whitespace when coordinateToTime is null
    if (time == null) {
      const logical = timeScale.coordinateToLogical(x);
      const candles = stateRef.current.candles;
      if (logical !== null && candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        const lastIdx = candles.length - 1;
        const step =
          candles.length >= 2
            ? Math.max(1, lastCandle.time - candles[candles.length - 2].time)
            : 60;
        time = Math.round(lastCandle.time + (logical - lastIdx) * step);
      } else {
        return null;
      }
    }

    if (typeof time !== "number") return null;

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
      color: nextColor(drawMode),
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const anchor = anchorRef.current;
    const draft = draftRef.current;
    if (!anchor || !draft) return;
    const pt = toChartPoint(e.clientX, e.clientY);
    if (!pt) return;
    setDraft({ ...draft, time2: pt.time, price2: pt.price });

    if (stateRef.current.magnetOn) {
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      const candle = candleAt(stateRef.current.snapCandles, pt.time);
      if (chart && series && candle) {
        const source =
          stateRef.current.chartType === "line"
            ? (lineSeriesRef.current ?? series)
            : series;
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

    // A trend/box/ruler/etc. needs a real drag; a click with no movement is treated as a cancel
    if (draft.tool !== "level" && draft.tool !== "hray") {
      const el = containerRef.current;
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      if (el && chart && series) {
        const rect = el.getBoundingClientRect();
        const x1 = timeToCoordinateExtrapolated(
          draft.time1,
          chart.timeScale(),
          stateRef.current.candles
        );
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

  /* ---------------- keyboard listener ---------------- */

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
  }, [removeDrawingById, setShowVolume, setShowDayLines]);

  return {
    drawMode,
    setDrawMode,
    magnetOn,
    setMagnetOn,
    isLocked,
    setIsLocked,
    isHidden,
    setIsHidden,
    lastLineTool,
    setLastLineTool,
    lastShapeTool,
    setLastShapeTool,
    lastPositionTool,
    setLastPositionTool,
    drawings,
    selectedId,
    removeDrawingById,
    clearDrawings,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
