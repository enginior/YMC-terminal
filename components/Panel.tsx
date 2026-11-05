"use client";

import { ReactNode } from "react";
import { useTheme } from "@/context/ThemeContext";

interface PanelProps {
  children: ReactNode;
  title?: string;
  height?: number;
  span?: 1 | 2;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragging?: boolean;
  label?: string;
  onToggleMaximize?: () => void;
  isMaximized?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * Wrapper for right-hand widgets.
 *
 * Features a distinct visible border, a draggable grip header with widget title,
 * an optional collapse toggle, and a high-visibility Expand/Enlarge button.
 */
export default function Panel({
  children,
  title,
  height = 200,
  span = 1,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging = false,
  label = "Drag to reorder",
  onToggleMaximize,
  isMaximized = false,
  collapsed = false,
  onToggleCollapse,
}: PanelProps) {
  const { theme } = useTheme();

  return (
    <div
      className={`overflow-hidden flex flex-col rounded ${span === 2 ? "col-span-2" : ""}`}
      style={{
        background: theme.panel,
        height: collapsed ? "auto" : height,
        opacity: isDragging ? 0.45 : 1,
        border: `1px solid ${isDragging || isMaximized ? theme.yellow : `${theme.dim}55`}`,
        boxShadow: `0 1px 0 0 ${theme.border}`,
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className="h-6 shrink-0 flex items-center justify-between px-2 border-b select-none"
        style={{
          background: theme.bg,
          borderColor: collapsed ? "transparent" : `${theme.dim}40`,
        }}
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
          className="flex items-center gap-1.5 flex-1 min-w-0 cursor-grab active:cursor-grabbing py-0.5"
        >
          <span
            className="text-[11px] leading-none font-mono"
            style={{ color: theme.yellow }}
          >
            ⠿
          </span>
          {title ? (
            <span
              className="text-[9px] font-mono font-bold uppercase tracking-wider truncate"
              style={{ color: theme.dim }}
            >
              {title}
            </span>
          ) : (
            <div
              className="h-1 w-12 rounded"
              style={{ background: `${theme.yellow}80` }}
            />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? "Expand widget body" : "Collapse widget body"}
              className="px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold leading-none transition-colors hover:opacity-90 cursor-pointer"
              style={{
                borderColor: `${theme.dim}45`,
                background: theme.panel,
                color: theme.dim,
              }}
            >
              {collapsed ? "+ SHOW" : "− HIDE"}
            </button>
          )}

          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              title={isMaximized ? "Restore right grid (Esc)" : "Enlarge widget to 50% split-screen"}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold leading-none transition-all hover:opacity-95 cursor-pointer"
              style={{
                borderColor: `${theme.yellow}80`,
                background: isMaximized ? theme.yellow : `${theme.yellow}18`,
                color: isMaximized ? theme.bg : theme.yellow,
              }}
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isMaximized ? (
                  <>
                    <path d="M4 1v3H1" />
                    <path d="M8 11V8h3" />
                    <path d="M1 4l3-3" />
                    <path d="M11 8l-3 3" />
                  </>
                ) : (
                  <>
                    <path d="M7 1h4v4" />
                    <path d="M5 11H1V7" />
                    <path d="M11 1L6.5 5.5" />
                    <path d="M1 11l4.5-4.5" />
                  </>
                )}
              </svg>
              <span>{isMaximized ? "RESTORE" : "ENLARGE"}</span>
            </button>
          )}
        </div>
      </div>

      {!collapsed && <div className="flex-1 min-h-0 overflow-hidden">{children}</div>}
    </div>
  );
}
