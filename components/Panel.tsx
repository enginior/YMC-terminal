"use client";

import { ReactNode } from "react";
import { useTheme } from "@/context/ThemeContext";

interface PanelProps {
  children: ReactNode;
  height?: number;
  span?: 1 | 2;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragging?: boolean;
  label?: string;
}

/**
 * Wrapper for right-hand widgets.
 *
 * Only the grip strip is draggable. Making the whole panel draggable breaks
 * text selection and wheel-scrolling inside OrderBook/TradeTape.
 * Each panel renders its own header, so this adds only a slim grip row.
 */
export default function Panel({
  children,
  height = 200,
  span = 1,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging = false,
  label = "Drag to reorder",
}: PanelProps) {
  const { theme } = useTheme();

  return (
    <div
      className={`overflow-hidden flex flex-col ${span === 2 ? "col-span-2" : ""}`}
      style={{
        background: theme.panel,
        height,
        opacity: isDragging ? 0.4 : 1,
        outline: isDragging ? `1px dashed ${theme.yellow}` : "none",
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          // Firefox requires data to be set for the drag to begin
          e.dataTransfer.setData("text/plain", "panel");
          onDragStart?.();
        }}
        onDragEnd={() => onDragStart?.()}
        title={label}
        className="h-1.5 shrink-0 cursor-grab active:cursor-grabbing hover:opacity-100 opacity-30 transition-opacity"
        style={{ background: theme.yellow }}
      />
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
