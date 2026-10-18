"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { WatchlistItem } from "@/lib/types";
import { isChartable } from "@/lib/symbols";
import { AssetIcon } from "@/components/AssetIcon";

interface WatchlistProps {
  selected?: string;
  onSelect?: (symbol: string) => void;
}

type SortMode = "default" | "change" | "volume" | "name";

export default function Watchlist({ selected, onSelect }: WatchlistProps) {
  const { theme } = useTheme();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/comparison");
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (cancelled || !Array.isArray(json)) return;

        setItems(
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

  const sortedItems = [...items].sort((a, b) => {
    if (sortMode === "change") return b.changePercent - a.changePercent;
    if (sortMode === "volume") return (b.rawVolume ?? 0) - (a.rawVolume ?? 0);
    if (sortMode === "name") return a.symbol.localeCompare(b.symbol);
    return 0;
  });

  return (
    <div className="h-full flex flex-col">
      <div
        className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider shrink-0 flex items-center justify-between"
        style={{ borderColor: theme.border, color: theme.dim }}
      >
        <span>Watchlist ({items.length})</span>
        <div className="flex items-center gap-1 font-mono text-[9px] lowercase">
          <button
            onClick={() => setSortMode((m) => (m === "change" ? "default" : "change"))}
            className="px-1 py-0.5 rounded hover:opacity-80"
            style={{
              color: sortMode === "change" ? theme.yellow : theme.dim,
              background: sortMode === "change" ? `${theme.yellow}20` : "transparent",
            }}
            title="Sort by 24h Change % (Top Gainers first)"
          >
            chg%
          </button>
          <button
            onClick={() => setSortMode((m) => (m === "volume" ? "default" : "volume"))}
            className="px-1 py-0.5 rounded hover:opacity-80"
            style={{
              color: sortMode === "volume" ? theme.yellow : theme.dim,
              background: sortMode === "volume" ? `${theme.yellow}20` : "transparent",
            }}
            title="Sort by 24h Volume (Highest volume first)"
          >
            vol
          </button>
          <button
            onClick={() => setSortMode((m) => (m === "name" ? "default" : "name"))}
            className="px-1 py-0.5 rounded hover:opacity-80"
            style={{
              color: sortMode === "name" ? theme.yellow : theme.dim,
              background: sortMode === "name" ? `${theme.yellow}20` : "transparent",
            }}
            title="Sort alphabetically A-Z"
          >
            a-z
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="p-3 text-center text-[10px]" style={{ color: failed ? theme.red : theme.dim }}>
            {failed ? "Market data unavailable" : "Loading markets…"}
          </div>
        )}

        {sortedItems.map((item) => {
          const up = item.changePercent >= 0;
          const selectable = Boolean(onSelect) && isChartable(item.symbol);
          const isSelected = selected === item.symbol;

          return (
            <div
              key={item.symbol}
              onClick={selectable ? () => onSelect?.(item.symbol) : undefined}
              role={selectable ? "button" : undefined}
              tabIndex={selectable ? 0 : undefined}
              onKeyDown={
                selectable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect?.(item.symbol);
                      }
                    }
                  : undefined
              }
              title={selectable ? `Chart ${item.symbol}` : "Not charted"}
              className={`px-2 py-1.5 border-b border-dotted ${
                selectable ? "cursor-pointer" : "cursor-default"
              }`}
              style={{
                borderColor: `${theme.border}60`,
                background: isSelected ? `${theme.blue}22` : "transparent",
                boxShadow: isSelected ? `inset 2px 0 0 ${theme.blue}` : "none",
              }}
            >
              <div className="flex justify-between items-baseline gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AssetIcon symbol={item.symbol} size={14} className="shrink-0" />
                  <span className="text-[11px] font-medium truncate" style={{ color: theme.text }}>
                    {item.symbol}
                  </span>
                </div>
                <span
                  className="text-[11px] tabular-nums shrink-0"
                  style={{ color: item.price > 0 ? theme.text : theme.dim }}
                >
                  {item.price > 0
                    ? "$" + item.price.toLocaleString("en-US", { maximumFractionDigits: item.price < 1 ? 4 : 2 })
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-baseline gap-2 mt-0.5">
                <span className="text-[9px]" style={{ color: theme.dim }}>
                  Vol {item.volume}
                </span>
                <span
                  className="text-[10px] tabular-nums"
                  style={{ color: up ? theme.green : theme.red }}
                >
                  {up ? "+" : ""}
                  {item.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
