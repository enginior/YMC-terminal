"use client";

import { useTheme } from "@/context/ThemeContext";

interface ExchangeData {
  name: string;
  price: number;
  connected: boolean;
  lastUpdate: number;
}

interface ExchangePanelProps {
  prices: ExchangeData[];
  aggregatedPrice: number;
  exchangeCount: number;
}

export default function ExchangePanel({ prices, aggregatedPrice, exchangeCount }: ExchangePanelProps) {
  const { theme } = useTheme();

  const maxPrice = Math.max(...prices.filter((p) => p.connected).map((p) => p.price), 0);
  const minPrice = Math.min(...prices.filter((p) => p.connected).map((p) => p.price), Infinity);
  const spread = maxPrice - minPrice;
  const spreadPercent = aggregatedPrice > 0 ? (spread / aggregatedPrice) * 100 : 0;

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider" style={{ borderColor: theme.border, color: theme.dim }}>
        Exchange Prices
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <div className="text-center pb-2 border-b" style={{ borderColor: theme.border }}>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: theme.dim }}>Aggregated Price</div>
          <div className="text-lg font-bold" style={{ color: theme.text }}>
            ${aggregatedPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[9px]" style={{ color: theme.dim }}>
            {exchangeCount} exchange{exchangeCount !== 1 ? "s" : ""} connected
          </div>
        </div>

        {prices.map((exchange) => {
          const deviation = aggregatedPrice > 0 ? ((exchange.price - aggregatedPrice) / aggregatedPrice) * 100 : 0;
          return (
            <div key={exchange.name} className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: `${theme.border}50` }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: exchange.connected ? theme.green : theme.red }}
                />
                <span className="text-[11px]" style={{ color: theme.text }}>{exchange.name}</span>
              </div>
              <div className="text-right">
                <div className="text-[11px]" style={{ color: theme.text }}>
                  ${exchange.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[9px]" style={{ color: deviation >= 0 ? theme.green : theme.red }}>
                  {deviation >= 0 ? "+" : ""}{deviation.toFixed(3)}%
                </div>
              </div>
            </div>
          );
        })}

        <div className="pt-2 border-t" style={{ borderColor: theme.border }}>
          <div className="flex justify-between text-[10px]">
            <span style={{ color: theme.dim }}>Spread</span>
            <span style={{ color: theme.yellow }}>${spread.toFixed(2)} ({spreadPercent.toFixed(4)}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
