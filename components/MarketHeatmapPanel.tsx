"use client";

import { memo, useEffect, useRef, useState, useMemo } from "react";
import { useTheme } from "@/context/ThemeContext";
import { AssetIcon } from "@/components/AssetIcon";

interface SymbolData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  rawVolume?: number;
}

interface TreemapNode extends SymbolData {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MarketHeatmapPanelProps {
  onSelect?: (symbol: string) => void;
  selected?: string;
}

/**
 * Standard Squarified Treemap layout algorithm (Bruls, Huizing, van Wijk).
 * Partitions a bounding box [0, 0, width, height] into sub-rectangles
 * proportional to each item's 24h volume while minimizing aspect ratio distortion.
 */
function squarify(
  items: SymbolData[],
  x: number,
  y: number,
  w: number,
  h: number
): TreemapNode[] {
  if (items.length === 0 || w <= 0 || h <= 0) return [];
  if (items.length === 1) {
    return [{ ...items[0], x, y, w, h }];
  }

  // Ensure every item has a reasonable floor weight so smaller pairs remain visible tiles
  const totalVolume = items.reduce(
    (sum, i) => sum + Math.max(i.rawVolume ?? 1, 5000000),
    0
  );
  const totalArea = w * h;

  // Normalized area values for each item
  const mapped = items.map((i) => ({
    ...i,
    area: (Math.max(i.rawVolume ?? 1, 5000000) / totalVolume) * totalArea,
  }));

  const results: TreemapNode[] = [];

  function layoutRow(
    row: typeof mapped,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    horizontal: boolean
  ) {
    const rowArea = row.reduce((sum, item) => sum + item.area, 0);
    const rowLength = horizontal ? rw : rh;
    const rowThickness = rowArea / rowLength;

    let offset = 0;
    for (const item of row) {
      const itemLen = item.area / rowThickness;
      if (horizontal) {
        results.push({
          ...item,
          x: rx + offset,
          y: ry,
          w: itemLen,
          h: rowThickness,
        });
      } else {
        results.push({
          ...item,
          x: rx,
          y: ry + offset,
          w: rowThickness,
          h: itemLen,
        });
      }
      offset += itemLen;
    }
  }

  function worst(row: typeof mapped, length: number): number {
    const rowArea = row.reduce((sum, item) => sum + item.area, 0);
    if (rowArea === 0 || length === 0) return Infinity;
    const thickness = rowArea / length;
    let maxAspect = 0;
    for (const item of row) {
      const itemLen = item.area / thickness;
      const aspect = Math.max(thickness / itemLen, itemLen / thickness);
      if (aspect > maxAspect) maxAspect = aspect;
    }
    return maxAspect;
  }

  let currX = x;
  let currY = y;
  let currW = w;
  let currH = h;
  let remaining = [...mapped];

  while (remaining.length > 0) {
    const horizontal = currW >= currH;
    const length = horizontal ? currH : currW;
    let row: typeof mapped = [remaining[0]];
    let i = 1;

    while (i < remaining.length) {
      const testRow = [...row, remaining[i]];
      if (worst(testRow, length) <= worst(row, length)) {
        row = testRow;
        i++;
      } else {
        break;
      }
    }

    // Lay out finalized row
    layoutRow(row, currX, currY, currW, currH, !horizontal);

    const rowArea = row.reduce((sum, item) => sum + item.area, 0);
    const rowThickness = rowArea / length;

    if (horizontal) {
      currX += rowThickness;
      currW -= rowThickness;
    } else {
      currY += rowThickness;
      currH -= rowThickness;
    }

    remaining = remaining.slice(row.length);
  }

  return results;
}

/**
 * Returns heatmap background and accent colors based on 24h percentage return,
 * matching Finviz / Coin360 / Bloomberg heatmaps with high-contrast red/green gradients.
 */
function getHeatmapColor(changePercent: number): { bg: string; border: string } {
  if (changePercent <= -6) return { bg: "#7f1d1d", border: "#991b1b" }; // Dark crimson red
  if (changePercent <= -3) return { bg: "#991b1b", border: "#b91c1c" }; // Deep red
  if (changePercent <= -1.5) return { bg: "#b91c1c", border: "#dc2626" }; // Vibrant red
  if (changePercent < 0) return { bg: "#dc2626", border: "#ef4444" }; // Standard red

  if (changePercent >= 6) return { bg: "#14532d", border: "#15803d" }; // Deep emerald green
  if (changePercent >= 3) return { bg: "#15803d", border: "#16a34a" }; // Rich green
  if (changePercent >= 1.5) return { bg: "#16a34a", border: "#22c55e" }; // Vibrant green
  if (changePercent > 0) return { bg: "#22c55e", border: "#4ade80" }; // Standard green

  return { bg: "#27272a", border: "#3f3f46" }; // Neutral slate
}

function MarketHeatmapPanel({ onSelect, selected }: MarketHeatmapPanelProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<SymbolData[]>([]);
  const [failed, setFailed] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Track container dimensions via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.floor(width),
          height: Math.floor(height),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch real market comparison data
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/comparison");
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (cancelled || !Array.isArray(json)) return;

        setData(
          json.map((i: any) => ({
            symbol: i.symbol,
            price: i.price,
            change: i.change,
            changePercent: i.changePercent,
            volume: i.volume,
            rawVolume: i.rawVolume,
          }))
        );
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Compute squarified treemap tiles whenever dimensions or data changes
  const tiles = useMemo(() => {
    if (dimensions.width <= 10 || dimensions.height <= 10 || data.length === 0) {
      return [];
    }

    // Sort descending by rawVolume for optimal squarified layout
    const sorted = [...data].sort((a, b) => (b.rawVolume ?? 0) - (a.rawVolume ?? 0));
    return squarify(sorted, 0, 0, dimensions.width, dimensions.height);
  }, [data, dimensions]);

  return (
    <div className="h-full flex flex-col overflow-hidden select-none">
      <div
        className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider shrink-0 flex items-center justify-between"
        style={{ borderColor: theme.border, color: theme.dim }}
      >
        <span className="font-semibold">Market Heatmap</span>
        <span className="text-[9px] font-mono opacity-80" style={{ color: theme.blue }}>
          24h Vol-Weighted
        </span>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-black/40">
        {tiles.length === 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center text-[10px]"
            style={{ color: failed ? theme.red : theme.dim }}
          >
            {failed ? "Heatmap feed unavailable" : "Loading heatmap…"}
          </div>
        )}

        {tiles.map((tile) => {
          const isSelected = selected === tile.symbol;
          const { bg, border } = getHeatmapColor(tile.changePercent);
          const shortSymbol = tile.symbol.replace(/\/USDT$/, "");
          const isBig = tile.w >= 65 && tile.h >= 50;
          const isMedium = (tile.w >= 45 && tile.h >= 36) || isBig;
          const isCompact = !isMedium;

          return (
            <div
              key={tile.symbol}
              onClick={() => onSelect?.(tile.symbol)}
              title={`${tile.symbol}\nPrice: $${tile.price.toLocaleString("en-US", {
                maximumFractionDigits: tile.price < 1 ? 4 : 2,
              })}\n24h Change: ${tile.changePercent >= 0 ? "+" : ""}${tile.changePercent.toFixed(
                2
              )}%\n24h Volume: ${tile.volume}\nClick to chart`}
              className="absolute cursor-pointer flex flex-col items-center justify-center p-1 overflow-hidden transition-all duration-150 hover:brightness-125 hover:z-20 group"
              style={{
                left: `${tile.x}px`,
                top: `${tile.y}px`,
                width: `${Math.max(tile.w - 1, 0)}px`,
                height: `${Math.max(tile.h - 1, 0)}px`,
                background: bg,
                border: isSelected
                  ? `2px solid ${theme.yellow}`
                  : `1px solid ${border}40`,
                boxShadow: isSelected
                  ? `0 0 8px ${theme.yellow}80`
                  : "inset 0 0 12px rgba(0,0,0,0.25)",
              }}
            >
              {isBig ? (
                <>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <AssetIcon symbol={tile.symbol} size={18} className="drop-shadow shrink-0" />
                    <span className="font-bold text-white text-[13px] tracking-wide drop-shadow-sm">
                      {shortSymbol}
                    </span>
                  </div>
                  <span className="font-extrabold text-white text-[12px] tabular-nums drop-shadow-sm leading-tight">
                    {tile.changePercent >= 0 ? "+" : ""}
                    {tile.changePercent.toFixed(2)}%
                  </span>
                  <span className="text-[9px] text-white/80 tabular-nums font-mono mt-0.5">
                    ${tile.price >= 1000
                      ? tile.price.toLocaleString("en-US", { maximumFractionDigits: 0 })
                      : tile.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </span>
                </>
              ) : isMedium ? (
                <>
                  <div className="flex items-center gap-1 mb-0.5">
                    <AssetIcon symbol={tile.symbol} size={13} className="drop-shadow shrink-0" />
                    <span className="font-bold text-white text-[10px] tracking-tight drop-shadow-sm">
                      {shortSymbol}
                    </span>
                  </div>
                  <span className="font-bold text-white text-[10px] tabular-nums drop-shadow-sm leading-none">
                    {tile.changePercent >= 0 ? "+" : ""}
                    {tile.changePercent.toFixed(2)}%
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center leading-none">
                  <span className="font-bold text-white text-[9px] tracking-tight">
                    {shortSymbol}
                  </span>
                  <span className="text-[8px] font-semibold text-white/90 tabular-nums">
                    {tile.changePercent >= 0 ? "+" : ""}
                    {tile.changePercent.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(MarketHeatmapPanel);
