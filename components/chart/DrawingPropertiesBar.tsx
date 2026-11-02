"use client";

import React, { memo } from "react";
import { Theme } from "@/context/ThemeContext";
import { Drawing, LineStylePattern } from "@/lib/drawings";

export interface DrawingPropertiesBarProps {
  drawing: Drawing;
  theme: Theme;
  onUpdate: (updates: Partial<Drawing>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const DrawingPropertiesBar = memo(function DrawingPropertiesBar({
  drawing,
  theme,
  onUpdate,
  onDelete,
  onClose,
}: DrawingPropertiesBarProps) {
  const swatches = [
    { name: "Yellow", value: theme.yellow },
    { name: "Blue", value: theme.blue },
    { name: "Green", value: theme.green },
    { name: "Red", value: theme.red },
    { name: "Purple", value: "#a855f7" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "White", value: "#ffffff" },
  ];

  const widths = [1, 2, 3];
  const styles: { id: LineStylePattern; label: string; preview: string }[] = [
    { id: "solid", label: "Solid", preview: "——" },
    { id: "dashed", label: "Dashed", preview: "- -" },
    { id: "dotted", label: "Dotted", preview: "···" },
  ];

  const currentWidth = drawing.lineWidth ?? 1.5;
  const currentStyle = drawing.lineStyle ?? "solid";
  const isLocked = Boolean(drawing.locked);

  return (
    <div
      role="toolbar"
      aria-label="Drawing properties"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded border shadow-2xl backdrop-blur select-none pointer-events-auto"
      style={{
        background: `${theme.panel}f5`,
        borderColor: theme.border,
        color: theme.text,
      }}
    >
      {/* Tool Label */}
      <span
        className="font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded"
        style={{
          background: `${theme.yellow}15`,
          color: theme.yellow,
        }}
      >
        {drawing.tool}
      </span>

      <div className="w-[1px] h-4" style={{ background: theme.border }} />

      {/* Color Swatches */}
      <div className="flex items-center gap-1.5">
        {swatches.map((s) => {
          const isActive = drawing.color.toLowerCase() === s.value.toLowerCase();
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onUpdate({ color: s.value })}
              title={s.name}
              className="w-4 h-4 rounded-full transition-transform hover:scale-110 relative flex items-center justify-center"
              style={{
                backgroundColor: s.value,
                boxShadow: isActive ? `0 0 0 2px ${theme.panel}, 0 0 0 3.5px ${s.value}` : "none",
              }}
            />
          );
        })}
      </div>

      <div className="w-[1px] h-4" style={{ background: theme.border }} />

      {/* Line Width */}
      <div className="flex items-center gap-1">
        {widths.map((w) => {
          const isActive = Math.round(currentWidth) === w;
          return (
            <button
              key={w}
              type="button"
              onClick={() => onUpdate({ lineWidth: w })}
              className="px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors"
              style={{
                background: isActive ? `${theme.yellow}25` : "transparent",
                color: isActive ? theme.yellow : theme.dim,
                border: `1px solid ${isActive ? theme.yellow : "transparent"}`,
              }}
              title={`Line Width: ${w}px`}
            >
              {w}px
            </button>
          );
        })}
      </div>

      <div className="w-[1px] h-4" style={{ background: theme.border }} />

      {/* Line Style */}
      <div className="flex items-center gap-1">
        {styles.map((s) => {
          const isActive = currentStyle === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onUpdate({ lineStyle: s.id })}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors tracking-tighter"
              style={{
                background: isActive ? `${theme.yellow}25` : "transparent",
                color: isActive ? theme.yellow : theme.dim,
                border: `1px solid ${isActive ? theme.yellow : "transparent"}`,
              }}
              title={`Line Style: ${s.label}`}
            >
              {s.preview}
            </button>
          );
        })}
      </div>

      <div className="w-[1px] h-4" style={{ background: theme.border }} />

      {/* Individual Lock Toggle */}
      <button
        type="button"
        onClick={() => onUpdate({ locked: !isLocked })}
        className="w-6 h-6 rounded flex items-center justify-center transition-colors"
        style={{
          background: isLocked ? `${theme.yellow}25` : "transparent",
          color: isLocked ? theme.yellow : theme.dim,
          border: `1px solid ${isLocked ? theme.yellow : "transparent"}`,
        }}
        title={isLocked ? "Unlock Drawing (allow dragging)" : "Lock Drawing (prevent moving)"}
      >
        {isLocked ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
        )}
      </button>

      {/* Delete Drawing Button */}
      <button
        type="button"
        onClick={() => onDelete(drawing.id)}
        className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:opacity-80"
        style={{
          color: theme.red,
        }}
        title="Delete Drawing (Del / Backspace)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </button>

      {/* Close/Deselect Button */}
      <button
        type="button"
        onClick={onClose}
        className="w-5 h-5 rounded flex items-center justify-center transition-colors text-xs opacity-60 hover:opacity-100"
        style={{ color: theme.dim }}
        title="Deselect (Esc)"
      >
        ✕
      </button>
    </div>
  );
});
