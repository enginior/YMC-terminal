"use client";

import { Trade } from "@/lib/types";
import { useTheme } from "@/context/ThemeContext";

interface TradeTapeProps {
  trades: Trade[];
}

export default function TradeTape({ trades }: TradeTapeProps) {
  const { theme } = useTheme();

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider" style={{ borderColor: theme.border, color: theme.dim }}>
        Time & Sales
      </div>
      <div className="grid grid-cols-3 px-2 py-1 text-[10px] border-b" style={{ borderColor: `${theme.border}50`, color: theme.dim }}>
        <span>Time</span>
        <span className="text-right">Price</span>
        <span className="text-right">Size</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {trades.map((trade) => (
          <div key={trade.id} className="grid grid-cols-3 px-2 py-0.5 text-[11px]" style={{ borderBottom: `1px solid ${theme.border}30` }}>
            <span style={{ color: theme.dim }}>{trade.time}</span>
            <span className="text-right" style={{ color: trade.side === "buy" ? theme.green : theme.red }}>
              {trade.price.toFixed(2)}
            </span>
            <span className="text-right" style={{ color: theme.text }}>{trade.size.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
