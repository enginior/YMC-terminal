"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { WatchlistItem } from "@/lib/types";
import { isChartable } from "@/lib/symbols";

interface WatchlistProps {
  selected?: string;
  onSelect?: (symbol: string) => void;
}

export default function Watchlist({ selected, onSelect }: WatchlistProps) {
  const { theme } = useTheme();
  const [items, setItems] = useState<WatchlistItem[]>([]);
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

  return (
    <div className="h-full flex flex-col">
      <div
        className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider shrink-0"
        style={{ borderColor: theme.border, color: theme.dim }}
      >
        Watchlist
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="p-3 text-center text-[10px]" style={{ color: failed ? theme.red : theme.dim }}>
            {failed ? "Market data unavailable" : "Loading markets…"}
          </div>
        )}

        {items.map((item) => {
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
                <span className="text-[11px] font-medium" style={{ color: theme.text }}>
                  {item.symbol}
                </span>
                <span
                  className="text-[11px] tabular-nums"
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
