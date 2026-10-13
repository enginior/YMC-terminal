"use client";

import { memo, useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";

interface SymbolData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  sparkline: number[];
  unavailable?: boolean;
}

function ComparisonPanel() {
  const { theme } = useTheme();
  const [data, setData] = useState<SymbolData[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/comparison");
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (cancelled || !Array.isArray(json)) return;
        setData(json);
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
        Market Comparison
      </div>

      <div className="flex-1 overflow-y-auto">
        {data.length === 0 && (
          <div className="p-3 text-center text-[10px]" style={{ color: failed ? theme.red : theme.dim }}>
            {failed ? "Comparison feed unavailable" : "Loading comparison…"}
          </div>
        )}

        {data.map((item) => {
          if (item.unavailable || !(item.price > 0)) {
            return (
              <div
                key={item.symbol}
                className="px-2 py-1.5 border-b flex justify-between items-center"
                style={{ borderColor: `${theme.border}50` }}
              >
                <span className="text-[11px]" style={{ color: theme.dim }}>
                  {item.symbol}
                </span>
                <span className="text-[10px]" style={{ color: theme.dim }}>
                  unavailable
                </span>
              </div>
            );
          }

          const up = item.changePercent >= 0;
          const pts = item.sparkline.filter((n) => Number.isFinite(n));
          const min = pts.length ? Math.min(...pts) : 0;
          const max = pts.length ? Math.max(...pts) : 1;
          const range = max - min || 1;

          return (
            <div
              key={item.symbol}
              className="px-2 py-1.5 border-b"
              style={{ borderColor: `${theme.border}50` }}
            >
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-[11px] font-medium" style={{ color: theme.text }}>
                  {item.symbol}
                </span>
                <span className="text-[11px] tabular-nums" style={{ color: theme.text }}>
                  ${item.price.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: item.price < 1 ? 4 : 2,
                  })}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2 mt-1">
                <div className="flex-1 h-5 min-w-0">
                  {pts.length > 1 && (
                    <svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 100 20"
                      preserveAspectRatio="none"
                      role="img"
                      aria-label={`${item.symbol} 24h trend`}
                    >
                      <polyline
                        fill="none"
                        stroke={up ? theme.green : theme.red}
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        points={pts
                          .map((p, i) => {
                            const x = (i / (pts.length - 1)) * 100;
                            const y = 19 - ((p - min) / range) * 18;
                            return `${x.toFixed(2)},${y.toFixed(2)}`;
                          })
                          .join(" ")}
                      />
                    </svg>
                  )}
                </div>
                <span
                  className="text-[10px] tabular-nums shrink-0"
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

export default memo(ComparisonPanel);