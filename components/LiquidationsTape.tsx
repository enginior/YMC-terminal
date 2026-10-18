"use client";

import { useEffect, useState, memo } from "react";
import { useTheme } from "@/context/ThemeContext";

export interface LiquidationOrder {
  id: string;
  symbol: string;
  side: "BUY" | "SELL"; // BUY = short liquidated (forced buy), SELL = long liquidated (forced sell)
  price: number;
  qty: number;
  usdValue: number;
  time: string;
  isLarge: boolean;
}

function fmtUsd(val: number): string {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function LiquidationsTape() {
  const { theme } = useTheme();
  const [orders, setOrders] = useState<LiquidationOrder[]>([]);
  const [connected, setConnected] = useState(false);
  const [totalVol, setTotalVol] = useState(0);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket("wss://fstream.binance.com/ws/!forceOrder@arr");

        ws.onopen = () => setConnected(true);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data?.o) return;
            const o = data.o;
            const price = parseFloat(o.p);
            const qty = parseFloat(o.q);
            const usdValue = price * qty;
            const side: "BUY" | "SELL" = o.S;
            const isLarge = usdValue >= 100000;

            const time = new Date(o.T).toLocaleTimeString("en-US", { hour12: false });
            const item: LiquidationOrder = {
              id: `${o.T}-${Math.random().toString(36).slice(2, 7)}`,
              symbol: o.s.replace("USDT", ""),
              side,
              price,
              qty,
              usdValue,
              time,
              isLarge,
            };

            setOrders((prev) => [item, ...prev.slice(0, 49)]);
            setTotalVol((prev) => prev + usdValue);
          } catch {
            /* ignore parse err */
          }
        };

        ws.onclose = () => {
          setConnected(false);
          timer = setTimeout(connect, 3000);
        };

        ws.onerror = () => ws?.close();
      } catch {
        timer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(timer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div
        className="grid grid-cols-4 px-2 py-1 text-[10px] border-b shrink-0"
        style={{ borderColor: `${theme.border}50`, color: theme.dim }}
      >
        <span>Time</span>
        <span>Asset</span>
        <span className="text-right">Side</span>
        <span className="text-right">Value</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {orders.length === 0 && (
          <div className="p-4 text-center text-[10px]" style={{ color: theme.dim }}>
            {connected ? "Streaming real-time liquidations…" : "Connecting to liquidations feed…"}
          </div>
        )}
        {orders.map((ord) => {
          const isShortLiq = ord.side === "BUY";
          const sideColor = isShortLiq ? theme.green : theme.red;
          return (
            <div
              key={ord.id}
              className={`grid grid-cols-4 px-2 py-0.5 text-[11px] items-center ${
                ord.isLarge ? "font-bold" : ""
              }`}
              style={{
                borderBottom: `1px solid ${theme.border}30`,
                background: ord.isLarge ? `${sideColor}15` : "transparent",
              }}
            >
              <span style={{ color: theme.dim }}>{ord.time}</span>
              <span style={{ color: theme.text }}>{ord.symbol}</span>
              <span className="text-right" style={{ color: sideColor }}>
                {isShortLiq ? "SHORT LIQ" : "LONG LIQ"}
              </span>
              <span className="text-right tabular-nums" style={{ color: ord.isLarge ? theme.yellow : theme.text }}>
                {fmtUsd(ord.usdValue)}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="px-2 py-1 border-t flex justify-between text-[9px] shrink-0"
        style={{ borderColor: theme.border, color: theme.dim }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{ background: connected ? theme.green : theme.red }}
            title={connected ? "Connected to Binance Liquidation Stream" : "Disconnected"}
          />
          <span>Binance Perp Liqs</span>
        </span>
        <span className="tabular-nums">Session: {fmtUsd(totalVol)}</span>
      </div>
    </div>
  );
}

export default memo(LiquidationsTape);
