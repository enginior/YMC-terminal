"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { DrawMode } from "./types";

interface DrawingRailProps {
  drawMode: DrawMode;
  onSetDrawMode: React.Dispatch<React.SetStateAction<DrawMode>>;
  lastLineTool: "trend" | "ray" | "hray" | "level" | "arrow";
  onSelectLineTool: (tool: "trend" | "ray" | "hray" | "level" | "arrow") => void;
  lastShapeTool: "rect" | "channel";
  onSelectShapeTool: (tool: "rect" | "channel") => void;
  lastPositionTool: "long" | "short";
  onSelectPositionTool: (tool: "long" | "short") => void;
  magnetOn: boolean;
  onToggleMagnet: () => void;
  isLocked: boolean;
  onToggleLocked: () => void;
  isHidden: boolean;
  onToggleHidden: () => void;
  drawingsCount: number;
  onClearDrawings: () => void;
  selectedId: string | null;
  onDeleteSelected: () => void;
}

export function DrawingRail({
  drawMode,
  onSetDrawMode,
  lastLineTool,
  onSelectLineTool,
  lastShapeTool,
  onSelectShapeTool,
  lastPositionTool,
  onSelectPositionTool,
  magnetOn,
  onToggleMagnet,
  isLocked,
  onToggleLocked,
  isHidden,
  onToggleHidden,
  drawingsCount,
  onClearDrawings,
  selectedId,
  onDeleteSelected,
}: DrawingRailProps) {
  const { theme } = useTheme();
  const [activeFlyout, setActiveFlyout] = useState<"lines" | "shapes" | "positions" | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // Close flyouts when clicking outside
  useEffect(() => {
    if (!activeFlyout) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setActiveFlyout(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeFlyout]);

  const isLineActive = ["trend", "ray", "hray", "level", "arrow"].includes(drawMode);
  const isFibActive = drawMode === "fib";
  const isShapeActive = ["rect", "channel"].includes(drawMode);
  const isPositionActive = ["long", "short"].includes(drawMode);
  const isRulerActive = drawMode === "ruler";

  return (
    <div
      ref={railRef}
      className="w-10 border-r flex flex-col items-center py-2 shrink-0 select-none z-20"
      style={{
        background: theme.panel,
        borderColor: theme.border,
      }}
    >
      {/* 1. Lines Group (Trendline, Ray, Horizontal Ray, Level, Arrow) */}
      <div className="relative group/tool mb-1.5">
        <div className="flex items-center">
          <button
            onClick={() => onSelectLineTool(lastLineTool)}
            className="w-8 h-8 rounded flex items-center justify-center transition-colors relative"
            style={{
              background: isLineActive ? `${theme.yellow}25` : "transparent",
              color: isLineActive ? theme.yellow : theme.dim,
              border: `1px solid ${isLineActive ? theme.yellow : "transparent"}`,
            }}
            title={`${getLineToolLabel(lastLineTool)} — click arrow for more`}
          >
            {renderLineToolIcon(lastLineTool)}

            {/* Tiny arrow indicating flyout menu */}
            <span
              onClick={(e) => {
                e.stopPropagation();
                setActiveFlyout((prev) => (prev === "lines" ? null : "lines"));
              }}
              className="absolute bottom-0.5 right-0.5 text-[7px] leading-none opacity-60 hover:opacity-100 cursor-pointer"
              style={{ color: isLineActive ? theme.yellow : theme.text }}
            >
              ▶
            </span>
          </button>
        </div>

        {/* Lines Flyout Popover */}
        {activeFlyout === "lines" && (
          <div
            className="absolute left-full top-0 ml-1.5 py-1 px-1 rounded border shadow-xl z-30 min-w-[155px] flex flex-col gap-0.5"
            style={{ background: theme.panel, borderColor: theme.border }}
          >
            <div className="text-[9px] uppercase tracking-wider px-2 py-1 font-semibold" style={{ color: theme.dim }}>
              Lines & Rays
            </div>
            {(
              [
                { id: "trend", label: "Trend Line", icon: <TrendIcon size={14} /> },
                { id: "ray", label: "Extended Ray", icon: <RayIcon size={14} /> },
                { id: "hray", label: "Horizontal Ray", icon: <HRayIcon size={14} /> },
                { id: "level", label: "Horizontal Level", icon: <LevelIcon size={14} /> },
                { id: "arrow", label: "Arrow", icon: <ArrowIcon size={14} /> },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelectLineTool(item.id);
                  setActiveFlyout(null);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:opacity-80 transition-colors"
                style={{
                  background: drawMode === item.id ? `${theme.yellow}20` : "transparent",
                  color: drawMode === item.id ? theme.yellow : theme.text,
                }}
              >
                {item.icon}
                <span>{item.label}</span>
                {lastLineTool === item.id && <span className="ml-auto text-[9px] opacity-60">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Fibonacci Retracement */}
      <div className="relative group/tool mb-1.5">
        <button
          onClick={() => onSetDrawMode((m) => (m === "fib" ? "none" : "fib"))}
          className="w-8 h-8 rounded flex items-center justify-center transition-colors relative"
          style={{
            background: isFibActive ? `${theme.yellow}25` : "transparent",
            color: isFibActive ? theme.yellow : theme.dim,
            border: `1px solid ${isFibActive ? theme.yellow : "transparent"}`,
          }}
          title="Fibonacci Retracement (☷)"
        >
          <FibIcon />
        </button>
      </div>

      {/* 3. Geometric Shapes Group (Rectangle, Parallel Channel) */}
      <div className="relative group/tool mb-1.5">
        <div className="flex items-center">
          <button
            onClick={() => onSelectShapeTool(lastShapeTool)}
            className="w-8 h-8 rounded flex items-center justify-center transition-colors relative"
            style={{
              background: isShapeActive ? `${theme.blue}25` : "transparent",
              color: isShapeActive ? theme.blue : theme.dim,
              border: `1px solid ${isShapeActive ? theme.blue : "transparent"}`,
            }}
            title={`${lastShapeTool === "rect" ? "Rectangle / Box (▭)" : "Parallel Channel (⫽)"} — click arrow for more`}
          >
            {lastShapeTool === "rect" ? <RectIcon /> : <ChannelIcon />}

            {/* Tiny arrow indicating flyout menu */}
            <span
              onClick={(e) => {
                e.stopPropagation();
                setActiveFlyout((prev) => (prev === "shapes" ? null : "shapes"));
              }}
              className="absolute bottom-0.5 right-0.5 text-[7px] leading-none opacity-60 hover:opacity-100 cursor-pointer"
              style={{ color: isShapeActive ? theme.blue : theme.text }}
            >
              ▶
            </span>
          </button>
        </div>

        {/* Shapes Flyout Popover */}
        {activeFlyout === "shapes" && (
          <div
            className="absolute left-full top-0 ml-1.5 py-1 px-1 rounded border shadow-xl z-30 min-w-[160px] flex flex-col gap-0.5"
            style={{ background: theme.panel, borderColor: theme.border }}
          >
            <div className="text-[9px] uppercase tracking-wider px-2 py-1 font-semibold" style={{ color: theme.dim }}>
              Geometric Shapes
            </div>
            <button
              onClick={() => {
                onSelectShapeTool("rect");
                setActiveFlyout(null);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:opacity-80 transition-colors"
              style={{
                background: drawMode === "rect" ? `${theme.blue}20` : "transparent",
                color: drawMode === "rect" ? theme.blue : theme.text,
              }}
            >
              <RectIcon size={14} />
              <span>Rectangle / Box</span>
              {lastShapeTool === "rect" && <span className="ml-auto text-[9px] opacity-60">✓</span>}
            </button>
            <button
              onClick={() => {
                onSelectShapeTool("channel");
                setActiveFlyout(null);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:opacity-80 transition-colors"
              style={{
                background: drawMode === "channel" ? `${theme.blue}20` : "transparent",
                color: drawMode === "channel" ? theme.blue : theme.text,
              }}
            >
              <ChannelIcon size={14} />
              <span>Parallel Channel</span>
              {lastShapeTool === "channel" && <span className="ml-auto text-[9px] opacity-60">✓</span>}
            </button>
          </div>
        )}
      </div>

      {/* 4. Positions & Risk Tools (Long Position, Short Position) */}
      <div className="relative group/tool mb-1.5">
        <div className="flex items-center">
          <button
            onClick={() => onSelectPositionTool(lastPositionTool)}
            className="w-8 h-8 rounded flex items-center justify-center transition-colors relative"
            style={{
              background: isPositionActive
                ? lastPositionTool === "long"
                  ? `${theme.green}25`
                  : `${theme.red}25`
                : "transparent",
              color: isPositionActive
                ? lastPositionTool === "long"
                  ? theme.green
                  : theme.red
                : theme.dim,
              border: `1px solid ${
                isPositionActive
                  ? lastPositionTool === "long"
                    ? theme.green
                    : theme.red
                  : "transparent"
              }`,
            }}
            title={`${lastPositionTool === "long" ? "Long Position (▲)" : "Short Position (▼)"} — click arrow for more`}
          >
            {lastPositionTool === "long" ? <LongPositionIcon /> : <ShortPositionIcon />}

            {/* Tiny arrow indicating flyout menu */}
            <span
              onClick={(e) => {
                e.stopPropagation();
                setActiveFlyout((prev) => (prev === "positions" ? null : "positions"));
              }}
              className="absolute bottom-0.5 right-0.5 text-[7px] leading-none opacity-60 hover:opacity-100 cursor-pointer"
              style={{ color: isPositionActive ? theme.text : theme.dim }}
            >
              ▶
            </span>
          </button>
        </div>

        {/* Positions Flyout Popover */}
        {activeFlyout === "positions" && (
          <div
            className="absolute left-full top-0 ml-1.5 py-1 px-1 rounded border shadow-xl z-30 min-w-[155px] flex flex-col gap-0.5"
            style={{ background: theme.panel, borderColor: theme.border }}
          >
            <div className="text-[9px] uppercase tracking-wider px-2 py-1 font-semibold" style={{ color: theme.dim }}>
              Trading & Risk
            </div>
            <button
              onClick={() => {
                onSelectPositionTool("long");
                setActiveFlyout(null);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:opacity-80 transition-colors"
              style={{
                background: drawMode === "long" ? `${theme.green}20` : "transparent",
                color: drawMode === "long" ? theme.green : theme.text,
              }}
            >
              <LongPositionIcon size={14} />
              <span>Long Position</span>
              {lastPositionTool === "long" && <span className="ml-auto text-[9px] opacity-60">✓</span>}
            </button>
            <button
              onClick={() => {
                onSelectPositionTool("short");
                setActiveFlyout(null);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:opacity-80 transition-colors"
              style={{
                background: drawMode === "short" ? `${theme.red}20` : "transparent",
                color: drawMode === "short" ? theme.red : theme.text,
              }}
            >
              <ShortPositionIcon size={14} />
              <span>Short Position</span>
              {lastPositionTool === "short" && <span className="ml-auto text-[9px] opacity-60">✓</span>}
            </button>
          </div>
        )}
      </div>

      {/* 5. Measurement Group (Delta Ruler) */}
      <div className="relative group/tool mb-1.5">
        <button
          onClick={() => onSetDrawMode((m) => (m === "ruler" ? "none" : "ruler"))}
          className="w-8 h-8 rounded flex items-center justify-center transition-colors"
          style={{
            background: isRulerActive ? `${theme.yellow}25` : "transparent",
            color: isRulerActive ? theme.yellow : theme.dim,
            border: `1px solid ${isRulerActive ? theme.yellow : "transparent"}`,
          }}
          title="Delta Ruler (📐) — measure price delta & percentage"
        >
          <RulerIcon />
        </button>
      </div>

      {/* Spacer pushing utilities to the bottom */}
      <div className="flex-1" />

      {/* Divider */}
      <div className="w-5 h-[1px] my-2" style={{ background: theme.border }} />

      {/* 6. Bottom Utility Actions */}

      {/* Magnet Mode */}
      <button
        onClick={onToggleMagnet}
        className="w-8 h-8 rounded flex items-center justify-center mb-1 transition-colors"
        style={{
          background: magnetOn ? `${theme.green}25` : "transparent",
          color: magnetOn ? theme.green : theme.dim,
          border: `1px solid ${magnetOn ? theme.green : "transparent"}`,
        }}
        title={`Magnet Mode (M): ${magnetOn ? "ON (snapping to OHLC)" : "OFF"}`}
      >
        <MagnetIcon />
      </button>

      {/* Lock All Drawings */}
      <button
        onClick={onToggleLocked}
        className="w-8 h-8 rounded flex items-center justify-center mb-1 transition-colors"
        style={{
          background: isLocked ? `${theme.yellow}25` : "transparent",
          color: isLocked ? theme.yellow : theme.dim,
          border: `1px solid ${isLocked ? theme.yellow : "transparent"}`,
        }}
        title={`Lock All Drawings: ${isLocked ? "LOCKED (prevent accidental editing/deletion)" : "UNLOCKED"}`}
      >
        {isLocked ? <LockIcon /> : <UnlockIcon />}
      </button>

      {/* Hide / Unhide All Drawings */}
      <button
        onClick={onToggleHidden}
        className="w-8 h-8 rounded flex items-center justify-center mb-1 transition-colors"
        style={{
          background: isHidden ? `${theme.dim}25` : "transparent",
          color: isHidden ? theme.dim : theme.text,
        }}
        title={`Hide All Drawings: ${isHidden ? "HIDDEN (click to show)" : "VISIBLE (click to hide)"}`}
      >
        {isHidden ? <EyeOffIcon /> : <EyeIcon />}
      </button>

      {/* Delete Selected Drawing (if one is selected) */}
      {selectedId && (
        <button
          onClick={onDeleteSelected}
          className="w-8 h-8 rounded flex items-center justify-center mb-1 transition-colors animate-pulse"
          style={{
            background: `${theme.red}25`,
            color: theme.red,
            border: `1px solid ${theme.red}`,
          }}
          title="Delete Selected Drawing (Del / Backspace)"
        >
          <DeleteIcon />
        </button>
      )}

      {/* Clear All Drawings */}
      <button
        onClick={onClearDrawings}
        disabled={drawingsCount === 0}
        className="w-8 h-8 rounded flex items-center justify-center transition-colors disabled:opacity-25 relative"
        style={{
          color: drawingsCount > 0 ? theme.red : theme.dim,
        }}
        title={drawingsCount > 0 ? `Clear All Drawings (${drawingsCount})` : "No drawings to clear"}
      >
        <TrashIcon />
        {drawingsCount > 0 && (
          <span
            className="absolute -top-1 -right-1 text-[8px] font-mono px-1 rounded-full font-bold"
            style={{ background: theme.red, color: theme.bg }}
          >
            {drawingsCount}
          </span>
        )}
      </button>
    </div>
  );
}

function getLineToolLabel(tool: string): string {
  switch (tool) {
    case "trend":
      return "Trend Line (╱)";
    case "ray":
      return "Extended Ray (⟶)";
    case "hray":
      return "Horizontal Ray (─⟶)";
    case "level":
      return "Horizontal Level (─)";
    case "arrow":
      return "Arrow (➜)";
    default:
      return "Line Tool";
  }
}

function renderLineToolIcon(tool: string) {
  switch (tool) {
    case "trend":
      return <TrendIcon />;
    case "ray":
      return <RayIcon />;
    case "hray":
      return <HRayIcon />;
    case "level":
      return <LevelIcon />;
    case "arrow":
      return <ArrowIcon />;
    default:
      return <TrendIcon />;
  }
}

/* ---------------- Vector SVG Icons ---------------- */

function TrendIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="3" y1="13" x2="13" y2="3" />
      <circle cx="3" cy="13" r="1.5" fill="currentColor" />
      <circle cx="13" cy="3" r="1.5" fill="currentColor" />
    </svg>
  );
}

function RayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2.5" y1="13.5" x2="14" y2="2" />
      <circle cx="2.5" cy="13.5" r="1.5" fill="currentColor" />
      <path d="M10 2h4v4" />
    </svg>
  );
}

function HRayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2.5" y1="8" x2="14" y2="8" />
      <circle cx="2.5" cy="8" r="1.5" fill="currentColor" />
      <path d="M10.5 4.5L14 8l-3.5 3.5" />
    </svg>
  );
}

function LevelIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="2" y1="8" x2="14" y2="8" />
      <circle cx="2" cy="8" r="1.5" fill="currentColor" />
      <circle cx="14" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="2.5" y1="13.5" x2="13" y2="3" />
      <path d="M7 3h6v6" />
    </svg>
  );
}

function FibIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <line x1="2" y1="3" x2="14" y2="3" />
      <line x1="2" y1="7" x2="14" y2="7" />
      <line x1="2" y1="10" x2="14" y2="10" />
      <line x1="2" y1="13" x2="14" y2="13" />
      <line x1="4" y1="3" x2="12" y2="13" strokeDasharray="2 2" strokeWidth="1" />
    </svg>
  );
}

function RectIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2.5" y="4" width="11" height="8" rx="1" />
    </svg>
  );
}

function ChannelIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="2.5" y1="10" x2="13.5" y2="2" />
      <line x1="2.5" y1="14" x2="13.5" y2="6" />
      <line x1="2.5" y1="12" x2="13.5" y2="4" strokeDasharray="2 2" strokeWidth="1" />
    </svg>
  );
}

function LongPositionIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="3" y="3" width="10" height="5" rx="0.5" fill="currentColor" fillOpacity="0.25" stroke="#22c55e" />
      <rect x="3" y="8" width="10" height="5" rx="0.5" fill="currentColor" fillOpacity="0.25" stroke="#ef4444" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  );
}

function ShortPositionIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="3" y="3" width="10" height="5" rx="0.5" fill="currentColor" fillOpacity="0.25" stroke="#ef4444" />
      <rect x="3" y="8" width="10" height="5" rx="0.5" fill="currentColor" fillOpacity="0.25" stroke="#22c55e" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  );
}

function RulerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M2.5 13.5L13.5 2.5" />
      <path d="M5 11l1.5 1.5" />
      <path d="M7.5 8.5l2 2" />
      <path d="M10 6l1.5 1.5" />
    </svg>
  );
}

function MagnetIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3.5 3v5a4.5 4.5 0 009 0V3" />
      <line x1="3.5" y1="6" x2="5.5" y2="6" strokeWidth="1.5" />
      <line x1="10.5" y1="6" x2="12.5" y2="6" strokeWidth="1.5" />
      <line x1="3" y1="3" x2="6" y2="3" strokeWidth="2" />
      <line x1="10" y1="3" x2="13" y2="3" strokeWidth="2" />
    </svg>
  );
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3.5" y="7" width="9" height="7" rx="1.5" />
      <path d="M5.5 7V4.5a2.5 2.5 0 015 0V7" />
    </svg>
  );
}

function UnlockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
      <rect x="3.5" y="7" width="9" height="7" rx="1.5" />
      <path d="M5.5 7V4.5a2.5 2.5 0 015 0" />
    </svg>
  );
}

function EyeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1.5 8s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5-6.5-4.5-6.5-4.5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EyeOffIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5">
      <path d="M2 14L14 2" />
      <path d="M6.5 6.6a2 2 0 002.8 2.8" />
      <path d="M1.5 8s2.5-4.5 6.5-4.5c1.4 0 2.6.5 3.6 1.2M14.5 8s-2.5 4.5-6.5 4.5c-1.5 0-2.8-.5-3.8-1.3" />
    </svg>
  );
}

function DeleteIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}

function TrashIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 4h10" />
      <path d="M6 4V2.5h4V4" />
      <path d="M4.5 4v9a1.5 1.5 0 001.5 1.5h4a1.5 1.5 0 001.5-1.5V4" />
    </svg>
  );
}
