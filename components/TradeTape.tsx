"use client";

import { useState } from "react";
import { Trade } from "@/lib/types";
import { useTheme } from "@/context/ThemeContext";
import LiquidationsTape from "@/components/LiquidationsTape";

interface TradeTapeProps {
  trades: Trade[];
}

export default function TradeTape({ trades }: TradeTapeProps) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<"trades" | "liquidations">("trades");

  return (
    <div className="h-full flex flex-col">
      <div
        className="px-2 py-1 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: theme.border }}
      >
        <div className="flex gap-1">
          <button
            onClick={() => setTab("trades")}
            className="text-[10px] px-1.5 py-0.5 rounded uppercase font-medium"
            style={{
              background: tab === "trades" ? theme.text : "transparent",
              color: tab === "trades" ? theme.bg : theme.dim,
            }}
          >
            Trades
          </button>
          <button
            onClick={() => setTab("liquidations")}
            className="text-[10px] px-1.5 py-0.5 rounded uppercase font-medium flex items-center gap-1"
            style={{
              background: tab === "liquidations" ? theme.text : "transparent",
              color: tab === "liquidations" ? theme.bg : theme.dim,
            }}
            title="Real-time Binance Perpetual Liquidations"
          >
            <span>Liquidations</span>
            <span
              className="w-1.5 h-1.5 rounded-full inline-block animate-pulse"
              style={{ background: tab === "liquidations" ? theme.red : theme.yellow }}
            />
          </button>
        </div>

        <span className="text-[9px]" style={{ color: theme.dim }}>
          {tab === "trades" ? "Time & Sales" : "Rekt Tape"}
        </span>
      </div>

      {tab === "liquidations" ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <LiquidationsTape />
        </div>
      ) : (
        <>
          <div
            className="grid grid-cols-3 px-2 py-1 text-[10px] border-b shrink-0"
            style={{ borderColor: `${theme.border}50`, color: theme.dim }}
          >
            <span>Time</span>
            <span className="text-right">Price</span>
            <span className="text-right">Size</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="grid grid-cols-3 px-2 py-0.5 text-[11px]"
                style={{ borderBottom: `1px solid ${theme.border}30` }}
              >
                <span style={{ color: theme.dim }}>{trade.time}</span>
                <span className="text-right" style={{ color: trade.side === "buy" ? theme.green : theme.red }}>
                  {trade.price.toFixed(2)}
                </span>
                <span className="text-right" style={{ color: theme.text }}>
                  {trade.size.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
