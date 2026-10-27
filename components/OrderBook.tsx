"use client";

import { memo } from "react";
import { OrderBookEntry } from "@/lib/types";
import { useTheme } from "@/context/ThemeContext";
import { useMarket } from "@/lib/marketStore";
import { useRenderCount } from "@/lib/devRenderCount";

interface OrderBookProps {
  data?: { bids: OrderBookEntry[]; asks: OrderBookEntry[] };
}

function OrderBook({ data: propData }: OrderBookProps) {
  useRenderCount("OrderBook");
  const { theme } = useTheme();
  const storeData = useMarket((s) => s.orderBook);
  const data = propData ?? storeData;

  const maxTotal = Math.max(
    data.bids[data.bids.length - 1]?.total || 0,
    data.asks[data.asks.length - 1]?.total || 0
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider" style={{ borderColor: theme.border, color: theme.dim }}>
        Order Book
      </div>
      <div className="grid grid-cols-3 px-2 py-1 text-[10px] border-b" style={{ borderColor: `${theme.border}50`, color: theme.dim }}>
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        {data.asks.slice().reverse().map((ask, i) => (
          <div key={`ask-${i}`} className="relative grid grid-cols-3 px-2 py-0.5 text-[11px]">
            <div
              className="absolute inset-0"
              style={{ width: `${(ask.total / maxTotal) * 100}%`, right: 0, left: "auto", background: theme.askBg }}
            />
            <span className="relative" style={{ color: theme.red }}>{ask.price.toFixed(2)}</span>
            <span className="relative text-right" style={{ color: theme.text }}>{ask.size.toFixed(4)}</span>
            <span className="relative text-right" style={{ color: theme.dim }}>{ask.total.toFixed(4)}</span>
          </div>
        ))}
        <div className="px-2 py-1 text-center text-sm font-bold border-y" style={{ background: "rgba(255,255,255,0.05)", color: theme.yellow, borderColor: theme.border }}>
          {data.asks[0]?.price.toFixed(2) || "—"}
        </div>
        {data.bids.map((bid, i) => (
          <div key={`bid-${i}`} className="relative grid grid-cols-3 px-2 py-0.5 text-[11px]">
            <div
              className="absolute inset-0"
              style={{ width: `${(bid.total / maxTotal) * 100}%`, right: 0, left: "auto", background: theme.bidBg }}
            />
            <span className="relative" style={{ color: theme.green }}>{bid.price.toFixed(2)}</span>
            <span className="relative text-right" style={{ color: theme.text }}>{bid.size.toFixed(4)}</span>
            <span className="relative text-right" style={{ color: theme.dim }}>{bid.total.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(OrderBook);
