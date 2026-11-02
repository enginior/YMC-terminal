"use client";

import { useState, useMemo, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import {
  IndicatorType,
  INDICATOR_METAS,
  IndicatorMeta,
  IndicatorSettings,
  DEFAULT_INDICATOR_SETTINGS,
} from "./types";

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeIndicators: Set<IndicatorType>;
  onToggleIndicator: (id: IndicatorType) => void;
  onClearAll?: () => void;
  settings?: IndicatorSettings;
  onUpdateSettings?: <K extends keyof IndicatorSettings>(
    key: K,
    updates: Partial<IndicatorSettings[K]>
  ) => void;
  onResetSettings?: (key?: keyof IndicatorSettings) => void;
}

const CONFIGURABLE_INDICATORS = new Set<IndicatorType>([
  "sma",
  "ema",
  "bollinger",
  "rsi",
  "macd",
  "stochrsi",
]);

export function IndicatorsModal({
  isOpen,
  onClose,
  activeIndicators,
  onToggleIndicator,
  onClearAll,
  settings = DEFAULT_INDICATOR_SETTINGS,
  onUpdateSettings,
  onResetSettings,
}: IndicatorsModalProps) {
  const { theme } = useTheme();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<IndicatorType | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered indicator list based on search term
  const filteredMetas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return INDICATOR_METAS;
    return INDICATOR_METAS.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.shortDesc.toLowerCase().includes(q) ||
        m.formula.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [search]);

  // Split into Overlays, Oscillators, and Perpetuals/Order Flow
  const overlays = useMemo(
    () => filteredMetas.filter((m) => m.category === "Overlay"),
    [filteredMetas]
  );
  const oscillators = useMemo(
    () => filteredMetas.filter((m) => m.category === "Oscillator"),
    [filteredMetas]
  );
  const perps = useMemo(
    () => filteredMetas.filter((m) => m.category === "Perpetual" || m.category === "Order Flow"),
    [filteredMetas]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px] animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        style={{
          background: theme.panel,
          borderColor: theme.border,
          color: theme.text,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: theme.border }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
              style={{ background: `${theme.yellow}20`, color: theme.yellow }}
            >
              ƒx
            </span>
            <span className="font-semibold text-sm tracking-wide">
              Technical Indicators & Oscillators
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: `${theme.dim}20`, color: theme.dim }}
            >
              {activeIndicators.size} active
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:opacity-70 transition-opacity text-xs"
            style={{ color: theme.dim }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b" style={{ borderColor: theme.border }}>
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded border transition-colors"
            style={{
              background: theme.bg,
              borderColor: search ? theme.yellow : theme.border,
            }}
          >
            <span className="text-xs opacity-60">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search indicators by name (SMA, RSI, MACD, Bollinger)..."
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: theme.text }}
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs opacity-60 hover:opacity-100"
                style={{ color: theme.dim }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Indicators List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          {filteredMetas.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: theme.dim }}>
              No indicators found matching &quot;{search}&quot;.
            </div>
          ) : (
            <>
              {overlays.length > 0 && (
                <div>
                  <div
                    className="text-[10px] uppercase font-bold tracking-wider mb-2 px-1 flex items-center justify-between"
                    style={{ color: theme.dim }}
                  >
                    <span>Price Overlays (Main Pane)</span>
                    <span className="text-[9px] font-normal opacity-70">
                      Plotted on the price scale
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {overlays.map((meta) => (
                      <IndicatorRow
                        key={meta.id}
                        meta={meta}
                        isActive={activeIndicators.has(meta.id)}
                        onToggle={() => onToggleIndicator(meta.id)}
                        isConfigurable={CONFIGURABLE_INDICATORS.has(meta.id)}
                        isExpanded={expandedId === meta.id}
                        onToggleExpand={() =>
                          setExpandedId((curr) => (curr === meta.id ? null : meta.id))
                        }
                        settings={settings}
                        onUpdateSettings={onUpdateSettings}
                        onResetSettings={onResetSettings}
                        theme={theme}
                      />
                    ))}
                  </div>
                </div>
              )}

              {oscillators.length > 0 && (
                <div>
                  <div
                    className="text-[10px] uppercase font-bold tracking-wider mb-2 px-1 flex items-center justify-between"
                    style={{ color: theme.dim }}
                  >
                    <span>Oscillators & Sub-Panes</span>
                    <span className="text-[9px] font-normal opacity-70">
                      Independent sub-panes with shared timeline
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {oscillators.map((meta) => (
                      <IndicatorRow
                        key={meta.id}
                        meta={meta}
                        isActive={activeIndicators.has(meta.id)}
                        onToggle={() => onToggleIndicator(meta.id)}
                        isConfigurable={CONFIGURABLE_INDICATORS.has(meta.id)}
                        isExpanded={expandedId === meta.id}
                        onToggleExpand={() =>
                          setExpandedId((curr) => (curr === meta.id ? null : meta.id))
                        }
                        settings={settings}
                        onUpdateSettings={onUpdateSettings}
                        onResetSettings={onResetSettings}
                        theme={theme}
                      />
                    ))}
                  </div>
                </div>
              )}

              {perps.length > 0 && (
                <div>
                  <div
                    className="text-[10px] uppercase font-bold tracking-wider mb-2 px-1 flex items-center justify-between"
                    style={{ color: theme.dim }}
                  >
                    <span>Perpetuals & Order Flow (Sub-Panes)</span>
                    <span className="text-[9px] font-normal opacity-70">
                      Open Interest, Funding & Net Volume Delta
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {perps.map((meta) => (
                      <IndicatorRow
                        key={meta.id}
                        meta={meta}
                        isActive={activeIndicators.has(meta.id)}
                        onToggle={() => onToggleIndicator(meta.id)}
                        isConfigurable={CONFIGURABLE_INDICATORS.has(meta.id)}
                        isExpanded={expandedId === meta.id}
                        onToggleExpand={() =>
                          setExpandedId((curr) => (curr === meta.id ? null : meta.id))
                        }
                        settings={settings}
                        onUpdateSettings={onUpdateSettings}
                        onResetSettings={onResetSettings}
                        theme={theme}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2.5 border-t flex items-center justify-between text-xs"
          style={{ borderColor: theme.border, background: `${theme.bg}40` }}
        >
          <div className="flex items-center gap-2">
            {activeIndicators.size > 0 && (
              <button
                onClick={() => {
                  if (onClearAll) {
                    onClearAll();
                  } else {
                    activeIndicators.forEach((id) => onToggleIndicator(id));
                  }
                }}
                className="text-[11px] px-2 py-1 rounded hover:opacity-80 transition-opacity"
                style={{ color: theme.red, border: `1px solid ${theme.border}` }}
              >
                Clear All
              </button>
            )}
            {onResetSettings && (
              <button
                onClick={() => onResetSettings()}
                className="text-[11px] px-2 py-1 rounded hover:opacity-80 transition-opacity font-mono"
                style={{ color: theme.dim, border: `1px solid ${theme.border}` }}
                title="Reset all indicator parameters to defaults"
              >
                Reset All Params
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-[11px] px-3 py-1 rounded font-medium hover:opacity-85 transition-opacity"
            style={{ background: theme.yellow, color: theme.bg }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function getDynamicLabels(meta: IndicatorMeta, settings: IndicatorSettings) {
  switch (meta.id) {
    case "sma":
      return {
        name: `SMA ${settings.sma.fast} / ${settings.sma.slow}`,
        formula: `${settings.sma.fast}-period (Blue) & ${settings.sma.slow}-period (Yellow) moving averages`,
      };
    case "ema":
      return {
        name: `EMA ${settings.ema.fast} / ${settings.ema.slow}`,
        formula: `${settings.ema.fast}-period (Green) & ${settings.ema.slow}-period (Red) moving averages`,
      };
    case "bollinger":
      return {
        name: `Bollinger (${settings.bollinger.period}, ${settings.bollinger.stdDev})`,
        formula: `${settings.bollinger.period}-period baseline with ±${settings.bollinger.stdDev} standard deviation envelope`,
      };
    case "rsi":
      return {
        name: `RSI (${settings.rsi.period})`,
        formula: `${settings.rsi.period}-period momentum oscillator with ${settings.rsi.overbought}/${settings.rsi.oversold} bands`,
      };
    case "macd":
      return {
        name: `MACD (${settings.macd.fast}, ${settings.macd.slow}, ${settings.macd.signal})`,
        formula: `${settings.macd.fast}/${settings.macd.slow} exponential spread with ${settings.macd.signal}-period signal line`,
      };
    case "stochrsi":
      return {
        name: `Stoch RSI (${settings.stochrsi.lengthRSI}, ${settings.stochrsi.lengthStoch}, ${settings.stochrsi.smoothK}, ${settings.stochrsi.smoothD})`,
        formula: `RSI ${settings.stochrsi.lengthRSI} stochastic ${settings.stochrsi.lengthStoch} with %K (${settings.stochrsi.smoothK}) & %D (${settings.stochrsi.smoothD}) smoothing (${settings.stochrsi.overbought}/${settings.stochrsi.oversold})`,
      };
    default:
      return {
        name: meta.name,
        formula: meta.formula,
      };
  }
}

interface IndicatorRowProps {
  meta: IndicatorMeta;
  isActive: boolean;
  onToggle: () => void;
  isConfigurable: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  settings: IndicatorSettings;
  onUpdateSettings?: <K extends keyof IndicatorSettings>(
    key: K,
    updates: Partial<IndicatorSettings[K]>
  ) => void;
  onResetSettings?: (key?: keyof IndicatorSettings) => void;
  theme: any;
}

function IndicatorRow({
  meta,
  isActive,
  onToggle,
  isConfigurable,
  isExpanded,
  onToggleExpand,
  settings,
  onUpdateSettings,
  onResetSettings,
  theme,
}: IndicatorRowProps) {
  const dynamic = getDynamicLabels(meta, settings);

  return (
    <div
      className="rounded border overflow-hidden transition-colors"
      style={{
        borderColor: isActive ? theme.green : isExpanded ? theme.yellow : theme.border,
        background: isActive ? `${theme.green}08` : "transparent",
      }}
    >
      <div
        onClick={onToggle}
        className="p-2.5 flex items-center justify-between cursor-pointer transition-colors"
      >
        <div className="flex-1 pr-3">
          <div className="flex items-center gap-2">
            <span
              className="font-medium text-xs tracking-tight"
              style={{ color: isActive ? theme.text : theme.dim }}
            >
              {dynamic.name}
            </span>
            <span
              className="text-[9px] px-1 py-0.2 rounded font-mono"
              style={{
                background: `${theme.dim}18`,
                color: theme.dim,
              }}
            >
              {meta.category}
            </span>
          </div>
          <div className="text-[10px] mt-0.5 line-clamp-1" style={{ color: theme.dim }}>
            {meta.shortDesc}
          </div>
          <div className="text-[9px] mt-0.5 font-mono opacity-60">
            {dynamic.formula}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isConfigurable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="p-1 rounded hover:opacity-80 transition-colors text-xs flex items-center justify-center w-6 h-6"
              style={{
                color: isExpanded ? theme.yellow : theme.dim,
                background: isExpanded ? `${theme.yellow}20` : `${theme.dim}15`,
                border: `1px solid ${isExpanded ? `${theme.yellow}50` : "transparent"}`,
              }}
              title="Configure indicator parameters (⚙)"
            >
              ⚙
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="px-2.5 py-1 rounded text-[10px] font-mono font-medium transition-all"
            style={{
              background: isActive ? theme.green : "transparent",
              color: isActive ? theme.bg : theme.dim,
              border: `1px solid ${isActive ? theme.green : theme.border}`,
            }}
          >
            {isActive ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Inline Configuration Drawer */}
      {isExpanded && isConfigurable && onUpdateSettings && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="p-3 border-t space-y-3"
          style={{
            borderColor: theme.border,
            background: `${theme.bg}70`,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.yellow }}>
              Parameters & Thresholds
            </span>
            {onResetSettings && (
              <button
                type="button"
                onClick={() => onResetSettings(meta.id as keyof IndicatorSettings)}
                className="text-[10px] px-1.5 py-0.5 rounded border hover:opacity-80 transition-opacity"
                style={{ borderColor: theme.border, color: theme.dim }}
              >
                ↺ Reset to Defaults
              </button>
            )}
          </div>

          {/* Indicator-Specific Parameter Fields */}
          {meta.id === "sma" && (
            <div className="grid grid-cols-2 gap-2">
              <ParamInput
                label="Fast Period"
                value={settings.sma.fast}
                min={1}
                max={500}
                onChange={(v) => onUpdateSettings("sma", { fast: v })}
                theme={theme}
              />
              <ParamInput
                label="Slow Period"
                value={settings.sma.slow}
                min={1}
                max={500}
                onChange={(v) => onUpdateSettings("sma", { slow: v })}
                theme={theme}
              />
            </div>
          )}

          {meta.id === "ema" && (
            <div className="grid grid-cols-2 gap-2">
              <ParamInput
                label="Fast Period"
                value={settings.ema.fast}
                min={1}
                max={500}
                onChange={(v) => onUpdateSettings("ema", { fast: v })}
                theme={theme}
              />
              <ParamInput
                label="Slow Period"
                value={settings.ema.slow}
                min={1}
                max={500}
                onChange={(v) => onUpdateSettings("ema", { slow: v })}
                theme={theme}
              />
            </div>
          )}

          {meta.id === "bollinger" && (
            <div className="grid grid-cols-2 gap-2">
              <ParamInput
                label="Length (Period)"
                value={settings.bollinger.period}
                min={2}
                max={200}
                onChange={(v) => onUpdateSettings("bollinger", { period: v })}
                theme={theme}
              />
              <ParamInput
                label="StdDev Multiplier"
                value={settings.bollinger.stdDev}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(v) => onUpdateSettings("bollinger", { stdDev: v })}
                theme={theme}
              />
            </div>
          )}

          {meta.id === "rsi" && (
            <div className="grid grid-cols-3 gap-2">
              <ParamInput
                label="Length"
                value={settings.rsi.period}
                min={2}
                max={100}
                onChange={(v) => onUpdateSettings("rsi", { period: v })}
                theme={theme}
              />
              <ParamInput
                label="Overbought (Upper)"
                value={settings.rsi.overbought}
                min={50}
                max={95}
                onChange={(v) => onUpdateSettings("rsi", { overbought: v })}
                theme={theme}
              />
              <ParamInput
                label="Oversold (Lower)"
                value={settings.rsi.oversold}
                min={5}
                max={50}
                onChange={(v) => onUpdateSettings("rsi", { oversold: v })}
                theme={theme}
              />
            </div>
          )}

          {meta.id === "macd" && (
            <div className="grid grid-cols-3 gap-2">
              <ParamInput
                label="Fast Length"
                value={settings.macd.fast}
                min={1}
                max={100}
                onChange={(v) => onUpdateSettings("macd", { fast: v })}
                theme={theme}
              />
              <ParamInput
                label="Slow Length"
                value={settings.macd.slow}
                min={1}
                max={200}
                onChange={(v) => onUpdateSettings("macd", { slow: v })}
                theme={theme}
              />
              <ParamInput
                label="Signal Smoothing"
                value={settings.macd.signal}
                min={1}
                max={50}
                onChange={(v) => onUpdateSettings("macd", { signal: v })}
                theme={theme}
              />
            </div>
          )}

          {meta.id === "stochrsi" && (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <ParamInput
                  label="RSI Length"
                  value={settings.stochrsi.lengthRSI}
                  min={2}
                  max={100}
                  onChange={(v) => onUpdateSettings("stochrsi", { lengthRSI: v })}
                  theme={theme}
                />
                <ParamInput
                  label="Stoch Length"
                  value={settings.stochrsi.lengthStoch}
                  min={2}
                  max={100}
                  onChange={(v) => onUpdateSettings("stochrsi", { lengthStoch: v })}
                  theme={theme}
                />
                <ParamInput
                  label="%K Smooth"
                  value={settings.stochrsi.smoothK}
                  min={1}
                  max={20}
                  onChange={(v) => onUpdateSettings("stochrsi", { smoothK: v })}
                  theme={theme}
                />
                <ParamInput
                  label="%D Smooth"
                  value={settings.stochrsi.smoothD}
                  min={1}
                  max={20}
                  onChange={(v) => onUpdateSettings("stochrsi", { smoothD: v })}
                  theme={theme}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ParamInput
                  label="Overbought Level"
                  value={settings.stochrsi.overbought}
                  min={50}
                  max={95}
                  onChange={(v) => onUpdateSettings("stochrsi", { overbought: v })}
                  theme={theme}
                />
                <ParamInput
                  label="Oversold Level"
                  value={settings.stochrsi.oversold}
                  min={5}
                  max={50}
                  onChange={(v) => onUpdateSettings("stochrsi", { oversold: v })}
                  theme={theme}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ParamInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  theme,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  theme: any;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] truncate" style={{ color: theme.dim }}>
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const num = parseFloat(e.target.value);
          if (!isNaN(num) && num >= min && num <= max) {
            onChange(num);
          }
        }}
        className="w-full px-2 py-1 text-xs rounded border font-mono outline-none"
        style={{
          background: theme.bg,
          borderColor: theme.border,
          color: theme.text,
        }}
      />
    </div>
  );
}
