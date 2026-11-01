"use client";

import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { ChartTypeIcon } from "./ChartTypeIcon";
import { IndicatorsModal } from "./IndicatorsModal";
import {
  ChartType,
  DrawMode,
  IndicatorType,
  FAVORITE_TIMEFRAMES,
  MORE_TIMEFRAMES,
  CHART_TYPE_LABELS,
  CHART_TYPE_DESCRIPTIONS,
} from "./types";

interface ChartHeaderProps {
  symbol: string;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  showVolume: boolean;
  onToggleVolume: () => void;
  showDayLines: boolean;
  onToggleDayLines: () => void;
  showSessionHL: boolean;
  onToggleSessionHL: () => void;
  activeIndicators: Set<IndicatorType>;
  onToggleIndicator: (id: IndicatorType) => void;
  drawMode?: DrawMode;
  onSetDrawMode?: React.Dispatch<React.SetStateAction<DrawMode>>;
  candlesCount: number;
  candleError: boolean;
  onExportPng: () => void;
  onExportCsv: () => void;
  onToggleMaximize?: () => void;
  isMaximized?: boolean;
}

export function ChartHeader({
  symbol,
  timeframe,
  onTimeframeChange,
  chartType,
  onChartTypeChange,
  showVolume,
  onToggleVolume,
  showDayLines,
  onToggleDayLines,
  showSessionHL,
  onToggleSessionHL,
  activeIndicators,
  onToggleIndicator,
  drawMode = "none",
  onSetDrawMode,
  candlesCount,
  candleError,
  onExportPng,
  onExportCsv,
  onToggleMaximize,
  isMaximized = false,
}: ChartHeaderProps) {
  const { theme } = useTheme();
  const [chartTypeMenuOpen, setChartTypeMenuOpen] = useState(false);
  const [moreTfOpen, setMoreTfOpen] = useState(false);
  const [indicatorsModalOpen, setIndicatorsModalOpen] = useState(false);

  const isMoreTfActive = MORE_TIMEFRAMES.includes(timeframe as any);

  return (
    <>
      <div
        className="px-2 py-1.5 border-b flex items-center gap-2 flex-wrap shrink-0 select-none"
        style={{ borderColor: theme.border }}
      >
        {/* Symbol Indicator */}
        <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: theme.dim }}>
          {symbol}
        </span>
        <span style={{ color: theme.dim }}>|</span>

        {/* Favorite Timeframes Quick Strip */}
        <div className="flex items-center gap-1">
          {FAVORITE_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70 transition-colors"
              style={{
                color: timeframe === tf ? theme.bg : theme.dim,
                background: timeframe === tf ? theme.text : "transparent",
              }}
            >
              {tf}
            </button>
          ))}

          {/* More Timeframes Dropdown */}
          <div className="relative">
            <button
              onClick={() => setMoreTfOpen((v) => !v)}
              className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70 flex items-center gap-0.5 transition-colors"
              style={{
                color: isMoreTfActive ? theme.bg : theme.dim,
                background: isMoreTfActive ? theme.text : "transparent",
              }}
              title="More timeframes (30m, 2h)"
            >
              <span>{isMoreTfActive ? timeframe : "···"}</span>
              <span className="text-[8px] opacity-70">▾</span>
            </button>

            {moreTfOpen && (
              <div
                className="absolute top-full left-0 mt-1 rounded border p-1 z-30 min-w-[75px] shadow-xl flex flex-col gap-0.5"
                style={{ background: theme.panel, borderColor: theme.border }}
              >
                {MORE_TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      onTimeframeChange(tf);
                      setMoreTfOpen(false);
                    }}
                    className="text-[10px] px-2 py-1 rounded text-left hover:opacity-80 transition-colors flex items-center justify-between"
                    style={{
                      background: timeframe === tf ? `${theme.yellow}20` : "transparent",
                      color: timeframe === tf ? theme.yellow : theme.text,
                    }}
                  >
                    <span>{tf}</span>
                    {timeframe === tf && <span className="text-[8px] font-bold">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <span className="ml-1" style={{ color: theme.dim }}>|</span>

        {/* Chart Visuals Dropdown (Candles, Heikin Ashi, Line) */}
        <div className="relative">
          <button
            onClick={() => setChartTypeMenuOpen((v) => !v)}
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
                    onClick={() => {
                      onChartTypeChange(type);
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

        <span className="ml-1" style={{ color: theme.dim }}>|</span>

        {/* ƒx Indicators Modal Trigger */}
        <button
          onClick={() => setIndicatorsModalOpen(true)}
          className="text-[10px] px-2 py-0.5 rounded border hover:opacity-80 flex items-center gap-1.5 font-medium transition-colors"
          style={{
            borderColor: activeIndicators.size > 0 ? theme.green : theme.border,
            color: activeIndicators.size > 0 ? theme.green : theme.dim,
            background: activeIndicators.size > 0 ? `${theme.green}15` : "transparent",
          }}
          title="Technical indicators & oscillators (ƒx)"
        >
          <span className="font-mono font-bold" style={{ color: activeIndicators.size > 0 ? theme.green : theme.yellow }}>
            ƒx
          </span>
          <span>Indicators</span>
          {activeIndicators.size > 0 && (
            <span
              className="text-[9px] px-1 rounded-full font-bold"
              style={{ background: theme.green, color: theme.bg }}
            >
              {activeIndicators.size}
            </span>
          )}
        </button>

        {/* Display and Visual Overlays (VOL, DAY, H/L) */}
        <button
          onClick={onToggleVolume}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70 transition-colors"
          style={{ color: showVolume ? theme.green : theme.dim }}
          title="Volume bars (VOL)"
        >
          VOL
        </button>

        <button
          onClick={onToggleDayLines}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70 transition-colors"
          style={{ color: showDayLines ? theme.green : theme.dim }}
          title="UTC day boundaries (DAY)"
        >
          DAY
        </button>

        <button
          onClick={onToggleSessionHL}
          className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70 transition-colors"
          style={{
            color: showSessionHL ? theme.yellow : theme.dim,
            background: showSessionHL ? `${theme.yellow}22` : "transparent",
          }}
          title="24H & Previous Day High / Low price watermark lines (H/L)"
        >
          H/L
        </button>

        {/* Active Drawing Tool Hint Banner */}
        {drawMode !== "none" && (
          <div
            className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded animate-pulse"
            style={{ background: `${theme.yellow}20`, color: theme.yellow }}
          >
            <span>
              {drawMode === "level"
                ? "Click or drag to place a level"
                : drawMode === "trend"
                ? "Drag to draw a trendline"
                : drawMode === "rect"
                ? "Drag to draw a box"
                : "Drag to measure delta"}
            </span>
            {onSetDrawMode && (
              <button
                onClick={() => onSetDrawMode("none")}
                className="hover:opacity-75 text-xs font-bold leading-none ml-1"
                title="Cancel drawing (Esc)"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Candle loading / error status */}
        {candlesCount === 0 && (
          <span className="text-[11px] ml-2" style={{ color: candleError ? theme.red : theme.yellow }}>
            {candleError ? "Candle feed unavailable for this symbol" : "Loading candles…"}
          </span>
        )}

        {/* Right Action Utilities (Snap, CSV, Maximize) */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onExportPng}
            disabled={candlesCount === 0}
            className="text-[10px] px-1.5 py-0.5 rounded border hover:opacity-70 disabled:opacity-30 transition-opacity"
            style={{ borderColor: theme.border, color: theme.dim }}
            title="Export chart snapshot as PNG"
          >
            📷 Snap
          </button>
          <button
            onClick={onExportCsv}
            disabled={candlesCount === 0}
            className="text-[10px] px-1.5 py-0.5 rounded border hover:opacity-70 disabled:opacity-30 transition-opacity"
            style={{ borderColor: theme.border, color: theme.dim }}
            title="Download OHLCV candle data as CSV"
          >
            📥 CSV
          </button>
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              className="text-[10px] px-1.5 py-0.5 rounded border hover:opacity-70 font-mono transition-colors"
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

      {/* ƒx Indicators Modal */}
      <IndicatorsModal
        isOpen={indicatorsModalOpen}
        onClose={() => setIndicatorsModalOpen(false)}
        activeIndicators={activeIndicators}
        onToggleIndicator={onToggleIndicator}
      />
    </>
  );
}
