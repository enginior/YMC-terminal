"use client";

import { memo, useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";

interface CorrelationPair {
  name: string;
  correlation: number | null;
  period?: string;
  note?: string;
}

function CorrelationPanel() {
  const { theme } = useTheme();
  const [pairs, setPairs] = useState<CorrelationPair[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/correlation");
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (json.pairs) {
          setPairs(json.pairs);
          setFailed(false);
        }
      } catch {
        // Distinguish "still loading" from "upstream unavailable"
        setFailed(true);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getColor = (value: number | null) => {
    if (value === null) return theme.dim;
    if (value > 0.5) return theme.green;
    if (value < -0.5) return theme.red;
    return theme.yellow;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider" style={{ borderColor: theme.border, color: theme.dim }}>
        Correlation
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {pairs.length === 0 && (
          <div className="text-center text-[10px]" style={{ color: failed ? theme.red : theme.dim }}>
            {failed ? "Correlation feed unavailable" : "Loading..."}
          </div>
        )}
        {pairs.map((pair) => (
          <div key={pair.name} className="border-b pb-1.5" style={{ borderColor: `${theme.border}50` }}>
            <div className="flex justify-between items-center">
              <span className="text-[11px]" style={{ color: theme.text }}>{pair.name}</span>
              {pair.correlation !== null ? (
                <span className="text-[11px] font-bold" style={{ color: getColor(pair.correlation) }}>
                  {pair.correlation > 0 ? "+" : ""}{pair.correlation.toFixed(2)}
                </span>
              ) : (
                <span className="text-[9px]" style={{ color: theme.dim }}>{pair.note}</span>
              )}
            </div>
            {pair.correlation !== null && (
              <div className="h-1 rounded-full mt-1" style={{ background: theme.border }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.abs(pair.correlation) * 100}%`,
                    background: getColor(pair.correlation),
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(CorrelationPanel);