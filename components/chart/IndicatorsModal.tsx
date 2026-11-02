"use client";

import { useState, useMemo, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { IndicatorType, INDICATOR_METAS, IndicatorMeta } from "./types";

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeIndicators: Set<IndicatorType>;
  onToggleIndicator: (id: IndicatorType) => void;
  onClearAll?: () => void;
}

export function IndicatorsModal({
  isOpen,
  onClose,
  activeIndicators,
  onToggleIndicator,
  onClearAll,
}: IndicatorsModalProps) {
  const { theme } = useTheme();
  const [search, setSearch] = useState("");

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

function IndicatorRow({
  meta,
  isActive,
  onToggle,
  theme,
}: {
  meta: IndicatorMeta;
  isActive: boolean;
  onToggle: () => void;
  theme: any;
}) {
  return (
    <div
      onClick={onToggle}
      className="p-2.5 rounded border flex items-center justify-between cursor-pointer transition-colors group"
      style={{
        borderColor: isActive ? theme.green : theme.border,
        background: isActive ? `${theme.green}10` : "transparent",
      }}
    >
      <div className="flex-1 pr-3">
        <div className="flex items-center gap-2">
          <span
            className="font-medium text-xs tracking-tight"
            style={{ color: isActive ? theme.text : theme.dim }}
          >
            {meta.name}
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
          {meta.formula}
        </div>
      </div>

      <button
        type="button"
        className="px-2.5 py-1 rounded text-[10px] font-mono font-medium transition-all shrink-0"
        style={{
          background: isActive ? theme.green : "transparent",
          color: isActive ? theme.bg : theme.dim,
          border: `1px solid ${isActive ? theme.green : theme.border}`,
        }}
      >
        {isActive ? "ON" : "OFF"}
      </button>
    </div>
  );
}
