"use client";

import { memo, useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";

interface SentimentData {
  fearGreedIndex: number;
  fundingRate: number;
  openInterest: number;
}

function MarketSentimentPanel() {
  const { theme } = useTheme();
  const [data, setData] = useState<SentimentData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/sentiment");
        const json = await res.json();
        if (json.fearGreedIndex !== undefined) {
          setData(json);
        }
      } catch {
        // retry on next interval
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return <div className="h-full flex items-center justify-center text-[10px]" style={{ color: theme.dim }}>Loading sentiment data...</div>;

  const fg = data.fearGreedIndex;
  const fgLabel = fg >= 75 ? { label: "Extreme Greed", color: theme.green } :
    fg >= 55 ? { label: "Greed", color: theme.green } :
    fg >= 45 ? { label: "Neutral", color: theme.yellow } :
    fg >= 25 ? { label: "Fear", color: theme.red } :
    { label: "Extreme Fear", color: theme.red };

  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(fg / 100) * circumference} ${circumference}`;

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider" style={{ borderColor: theme.border, color: theme.dim }}>
        Market Sentiment
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r={radius} fill="none" stroke={theme.border} strokeWidth="4" />
              <circle
                cx="40" cy="40" r={radius} fill="none" stroke={fgLabel.color} strokeWidth="4"
                strokeDasharray={strokeDasharray} strokeDashoffset={circumference * 0.25}
                strokeLinecap="round" transform="rotate(90 40 40)"
              />
              <text x="40" y="36" textAnchor="middle" fill={theme.text} fontSize="16" fontWeight="bold">{fg}</text>
              <text x="40" y="52" textAnchor="middle" fill={theme.dim} fontSize="8">{fgLabel.label}</text>
            </svg>
            <span className="text-[9px] mt-1" style={{ color: theme.dim }}>Fear & Greed Index</span>
          </div>
        </div>

        <div>
          <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: theme.dim }}>Derivatives</div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div>
              <div style={{ color: theme.dim }}>Funding Rate</div>
              <div style={{ color: data.fundingRate >= 0 ? theme.green : theme.red }}>
                {(data.fundingRate * 100).toFixed(4)}%
              </div>
            </div>
            <div>
              <div style={{ color: theme.dim }}>Open Interest</div>
              <div style={{ color: theme.text }}>${(data.openInterest / 1e9).toFixed(2)}B</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MarketSentimentPanel);