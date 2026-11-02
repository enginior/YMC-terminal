"use client";

import { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useMarket } from "@/lib/marketStore";
import { heikenAshi } from "@/lib/heikenAshi";
import {
  PriceChartProps,
  ChartType,
  CHART_TYPE_KEY,
  SESSION_HL_KEY,
} from "./chart/types";
import { ChartHeader } from "./chart/ChartHeader";
import { DrawingRail } from "./chart/DrawingRail";
import { useChartInstance } from "./chart/useChartInstance";
import { useIndicatorPanes } from "./chart/useIndicatorPanes";
import { useDrawings } from "./chart/useDrawings";

export type { ChartType, PriceChartProps } from "./chart/types";

function PriceChart({
  candles: propCandles,
  symbol,
  timeframe,
  onTimeframeChange,
  candleError: propCandleError,
  onToggleMaximize,
  isMaximized = false,
  ticker,
}: PriceChartProps) {
  const { theme } = useTheme();
  const storeCandles = useMarket((s) => s.candles);
  const storeCandleError = useMarket((s) => s.candleError);
  const candles = propCandles ?? storeCandles;
  const candleError = propCandleError ?? storeCandleError;
  const containerRef = useRef<HTMLDivElement>(null);

  const [chartType, setChartType] = useState<ChartType>("candles");
  const skipChartTypeSaveRef = useRef(true);
  const skipSessionHLSaveRef = useRef(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showDayLines, setShowDayLines] = useState(true);
  const [showSessionHL, setShowSessionHL] = useState(false);

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

  // Load and persist chart visual type
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHART_TYPE_KEY) as ChartType | null;
      if (saved && (saved === "candles" || saved === "heiken" || saved === "line")) {
        setChartType(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (skipChartTypeSaveRef.current) {
      skipChartTypeSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(CHART_TYPE_KEY, chartType);
    } catch {}
  }, [chartType]);

  // Load and persist session High/Low toggle
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_HL_KEY);
      if (saved !== null) {
        setShowSessionHL(saved === "true");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (skipSessionHLSaveRef.current) {
      skipSessionHLSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(SESSION_HL_KEY, String(showSessionHL));
    } catch {}
  }, [showSessionHL]);

  // Chart canvas lifecycle, series data, viewport refit, and watermark lines
  const {
    chartRef,
    candleSeriesRef,
    lineSeriesRef,
    chartEpoch,
  } = useChartInstance({
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
  });

  // Technical indicators computations, structural sub-panes (RSI/MACD/Stoch), and live data updates
  const {
    activeIndicators,
    toggleIndicator,
  } = useIndicatorPanes({
    chartRef,
    candles,
    theme,
    chartEpoch,
  });

  // User drawings primitive, magnet snapping, hit-testing, selection, drag events, and hotkeys
  const {
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
  } = useDrawings({
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
  });

  // Export screenshot PNG and OHLCV CSV
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
  }, [symbol, timeframe, chartRef]);

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
      <ChartHeader
        symbol={symbol}
        timeframe={timeframe}
        onTimeframeChange={onTimeframeChange}
        chartType={chartType}
        onChartTypeChange={setChartType}
        showVolume={showVolume}
        onToggleVolume={() => setShowVolume((v) => !v)}
        showDayLines={showDayLines}
        onToggleDayLines={() => setShowDayLines((v) => !v)}
        showSessionHL={showSessionHL}
        onToggleSessionHL={() => setShowSessionHL((v) => !v)}
        activeIndicators={activeIndicators}
        onToggleIndicator={toggleIndicator}
        drawMode={drawMode}
        onSetDrawMode={setDrawMode}
        candlesCount={candles.length}
        candleError={candleError}
        onExportPng={exportPng}
        onExportCsv={exportCsv}
        onToggleMaximize={onToggleMaximize}
        isMaximized={isMaximized}
      />

      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        {/* Left Vertical Drawing Rail */}
        <DrawingRail
          drawMode={drawMode}
          onSetDrawMode={setDrawMode}
          lastLineTool={lastLineTool}
          onSelectLineTool={(tool) => {
            setLastLineTool(tool);
            setDrawMode((current) => (current === tool ? "none" : tool));
            if (isHidden) setIsHidden(false);
          }}
          lastShapeTool={lastShapeTool}
          onSelectShapeTool={(tool) => {
            setLastShapeTool(tool);
            setDrawMode((current) => (current === tool ? "none" : tool));
            if (isHidden) setIsHidden(false);
          }}
          lastPositionTool={lastPositionTool}
          onSelectPositionTool={(tool) => {
            setLastPositionTool(tool);
            setDrawMode((current) => (current === tool ? "none" : tool));
            if (isHidden) setIsHidden(false);
          }}
          magnetOn={magnetOn}
          onToggleMagnet={() => setMagnetOn((v) => !v)}
          isLocked={isLocked}
          onToggleLocked={() => setIsLocked((v) => !v)}
          isHidden={isHidden}
          onToggleHidden={() => setIsHidden((v) => !v)}
          drawingsCount={drawings.length}
          onClearDrawings={clearDrawings}
          selectedId={selectedId}
          onDeleteSelected={() => selectedId && removeDrawingById(selectedId)}
        />

        {/* Chart Canvas Area */}
        <div className="relative flex-1 min-w-0 h-full overflow-hidden">
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
    </div>
  );
}

export default memo(PriceChart);
