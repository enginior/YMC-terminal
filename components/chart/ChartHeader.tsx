import { useState, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";
import { ChartTypeIcon } from "./ChartTypeIcon";
import {
  ChartType,
  DrawMode,
  IndicatorType,
  TIMEFRAMES,
  CHART_TYPE_LABELS,
  CHART_TYPE_DESCRIPTIONS,
  OVERLAYS,
  PANES,
  INDICATOR_LABELS,
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
  magnetOn: boolean;
  onToggleMagnet: () => void;
  drawMode: DrawMode;
  onSetDrawMode: React.Dispatch<React.SetStateAction<DrawMode>>;
  drawingsCount: number;
  onClearDrawings: () => void;
  selectedId: string | null;
  onDeleteSelected: () => void;
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
  magnetOn,
  onToggleMagnet,
  drawMode,
  onSetDrawMode,
  drawingsCount,
  onClearDrawings,
  selectedId,
  onDeleteSelected,
  candlesCount,
  candleError,
  onExportPng,
  onExportCsv,
  onToggleMaximize,
  isMaximized = false,
}: ChartHeaderProps) {
  const { theme } = useTheme();
  const [chartTypeMenuOpen, setChartTypeMenuOpen] = useState(false);
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);

  return (
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

      <button
        onClick={onToggleVolume}
        className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
        style={{ color: showVolume ? theme.green : theme.dim }}
      >
        VOL
      </button>

      <button
        onClick={onToggleDayLines}
        className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
        style={{ color: showDayLines ? theme.green : theme.dim }}
        title="UTC day boundaries"
      >
        DAY
      </button>

      <button
        onClick={onToggleSessionHL}
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
          onClick={() => setIndicatorMenuOpen((v) => !v)}
          onBlur={() => setTimeout(() => setIndicatorMenuOpen(false), 120)}
          className="text-[10px] px-1.5 py-0.5 rounded border hover:opacity-70"
          style={{
            borderColor: theme.border,
            color: activeIndicators.size ? theme.green : theme.dim,
          }}
        >
          Indicators{activeIndicators.size ? ` (${activeIndicators.size})` : ""}
        </button>

        {indicatorMenuOpen && (
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
                  onChange={() => onToggleIndicator(id)}
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
                  onChange={() => onToggleIndicator(id)}
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
        onClick={onToggleMagnet}
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
        onClick={() => onSetDrawMode((m) => (m === "level" ? "none" : "level"))}
        className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
        style={{
          color: drawMode === "level" ? theme.bg : theme.dim,
          background: drawMode === "level" ? theme.yellow : "transparent",
        }}
      >
        ─ Level
      </button>

      <button
        onClick={() => onSetDrawMode((m) => (m === "trend" ? "none" : "trend"))}
        className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
        style={{
          color: drawMode === "trend" ? theme.bg : theme.dim,
          background: drawMode === "trend" ? theme.blue : "transparent",
        }}
      >
        ╱ Trend
      </button>

      <button
        onClick={() => onSetDrawMode((m) => (m === "rect" ? "none" : "rect"))}
        className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
        style={{
          color: drawMode === "rect" ? theme.bg : theme.dim,
          background: drawMode === "rect" ? theme.green : "transparent",
        }}
      >
        ▭ Box
      </button>

      <button
        onClick={() => onSetDrawMode((m) => (m === "ruler" ? "none" : "ruler"))}
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
        onClick={onClearDrawings}
        disabled={drawingsCount === 0}
        className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70 disabled:opacity-30"
        style={{ color: theme.red }}
      >
        Clear
      </button>

      {selectedId && (
        <button
          onClick={onDeleteSelected}
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

      {candlesCount === 0 && (
        <span className="text-[11px] ml-2" style={{ color: candleError ? theme.red : theme.yellow }}>
          {candleError ? "Candle feed unavailable for this symbol" : "Loading candles…"}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={onExportPng}
          disabled={candlesCount === 0}
          className="text-[10px] px-1.5 py-0.5 rounded border hover:opacity-70 disabled:opacity-30"
          style={{ borderColor: theme.border, color: theme.dim }}
          title="Export chart snapshot as PNG"
        >
          📷 Snap
        </button>
        <button
          onClick={onExportCsv}
          disabled={candlesCount === 0}
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
  );
}
