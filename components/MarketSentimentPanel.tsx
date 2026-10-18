"use client";

import { memo, useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { toBinanceSymbol } from "@/lib/symbols";

interface SentimentData {
  symbol?: string;
  fearGreedIndex: number;
  fundingRate: number | null;
  markPrice: number | null;
  openInterest: number | null;
  hasDerivatives: boolean;
}

interface MarketSentimentPanelProps {
  symbol?: string;
}

function fmtCompact(val: number | null): string {
  if (val === null || !Number.isFinite(val)) return "—";
  if (val >= 1e9) return "$" + (val / 1e9).toFixed(2) + "B";
  if (val >= 1e6) return "$" + (val / 1e6).toFixed(2) + "M";
  if (val >= 1e3) return "$" + (val / 1e3).toFixed(1) + "K";
  return "$" + val.toFixed(2);
}

function getNextFundingCountdown(): string {
  const now = new Date();
  const currentUtcHour = now.getUTCHours();
  const targetHour = currentUtcHour < 8 ? 8 : currentUtcHour < 16 ? 16 : 24;
  
  const target = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    targetHour,
    0,
    0,
    0
  ));
  
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function MarketSentimentPanel({ symbol = "BTC/USDT" }: MarketSentimentPanelProps) {
  const { theme } = useTheme();
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(getNextFundingCountdown);

  const binanceSymbol = toBinanceSymbol(symbol) ?? "BTCUSDT";
  const displayAsset = symbol.replace("/USDT", "");

  useEffect(() => {
    const id = setInterval(() => setCountdown(getNextFundingCountdown()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/sentiment?symbol=${binanceSymbol}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (!cancelled && json.fearGreedIndex !== undefined) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [binanceSymbol]);

  if (loading && !data) {
    return (
      <div className="h-full flex items-center justify-center text-[10px]" style={{ color: theme.dim }}>
        Loading sentiment…
      </div>
    );
  }

  const fg = data?.fearGreedIndex ?? 50;
  const fgLabel =
    fg >= 75
      ? { label: "Extreme Greed", color: theme.green }
      : fg >= 55
      ? { label: "Greed", color: theme.green }
      : fg >= 45
      ? { label: "Neutral", color: theme.yellow }
      : fg >= 25
      ? { label: "Fear", color: theme.red }
      : { label: "Extreme Fear", color: theme.red };

  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(fg / 100) * circumference} ${circumference}`;

  const hasPerp = data?.hasDerivatives ?? false;
  const fr = data?.fundingRate ?? 0;
  const frPct = fr * 100;
  const aprPct = fr * 3 * 365 * 100;

  return (
    <div className="h-full flex flex-col">
      <div
        className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider flex items-center justify-between shrink-0"
        style={{ borderColor: theme.border, color: theme.dim }}
      >
        <span>Market Sentiment</span>
        <span className="text-[9px] px-1 rounded" style={{ background: theme.border, color: theme.text }}>
          {displayAsset}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r={radius} fill="none" stroke={theme.border} strokeWidth="4" />
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke={fgLabel.color}
                strokeWidth="4"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={circumference * 0.25}
                strokeLinecap="round"
                transform="rotate(90 40 40)"
              />
              <text x="40" y="36" textAnchor="middle" fill={theme.text} fontSize="16" fontWeight="bold">
                {fg}
              </text>
              <text x="40" y="52" textAnchor="middle" fill={theme.dim} fontSize="8">
                {fgLabel.label}
              </text>
            </svg>
            <span className="text-[9px] mt-1" style={{ color: theme.dim }}>
              Fear & Greed Index
            </span>
          </div>
        </div>

        <div>
          <div className="text-[9px] uppercase tracking-wider mb-1 flex items-center justify-between" style={{ color: theme.dim }}>
            <span>Perpetual Derivatives</span>
            <span style={{ color: hasPerp ? theme.green : theme.dim }}>
              {hasPerp ? `${displayAsset}USDT PERP` : "SPOT ONLY"}
            </span>
          </div>

          {hasPerp ? (
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="p-1 rounded" style={{ background: `${theme.border}40` }}>
                <div className="flex items-baseline justify-between text-[9px] mb-0.5">
                  <span style={{ color: theme.dim }}>Funding (8h)</span>
                  <span className="tabular-nums" style={{ color: theme.yellow }} title="Countdown to next 8h funding settlement">
                    ⏱ {countdown}
                  </span>
                </div>
                <div className="tabular-nums font-bold" style={{ color: frPct >= 0 ? theme.green : theme.red }}>
                  {frPct >= 0 ? "+" : ""}
                  {frPct.toFixed(4)}%
                </div>
                <div className="text-[8px] tabular-nums" style={{ color: theme.dim }}>
                  {aprPct >= 0 ? "+" : ""}
                  {aprPct.toFixed(1)}% APR
                </div>
              </div>

              <div className="p-1 rounded" style={{ background: `${theme.border}40` }}>
                <div style={{ color: theme.dim }} className="text-[9px]">
                  Open Interest
                </div>
                <div className="tabular-nums font-bold" style={{ color: theme.text }}>
                  {fmtCompact(data?.openInterest ?? null)}
                </div>
                <div className="text-[8px] tabular-nums" style={{ color: theme.dim }}>
                  Mark: ${data?.markPrice ? data.markPrice.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-2 text-center text-[10px] rounded border" style={{ borderColor: `${theme.border}80`, color: theme.dim }}>
              {displayAsset} has no Binance perpetual futures contract.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(MarketSentimentPanel);