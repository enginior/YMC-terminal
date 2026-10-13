"use client";

import Link from "next/link";
import { useTheme, type Theme } from "@/context/ThemeContext";

const REPO_URL = "https://github.com/enginior/YMC-terminal";

const FEATURES = [
  "Real-time multi-exchange price aggregate (Binance, Coinbase, OKX, Bybit WebSockets)",
  "Live order book, time & sales, and per-exchange spread view",
  "Candlestick chart with RSI, MACD, Stoch RSI and Bollinger Bands",
  "Level / trendline / box drawings, crosshair snap-to-price, shaded bands",
  "Price alerts with sound and toast notifications",
  "Drag-and-drop terminal panels with a persisted layout",
  "Multi-source news feed with bull/bear sentiment filter",
  "Fear & Greed gauge, funding rate and open interest",
  "BTC/ETH rolling correlation",
  "Customizable themes with an in-app color editor",
];

const STACK = [
  "Next.js 16 · React 19 · TypeScript",
  "lightweight-charts v5 (TradingView)",
  "Tailwind CSS v4 (CSS-first theming)",
  "Binance / Coinbase / OKX / Bybit WebSockets + REST",
];

const SOURCES: [string, string][] = [
  ["Market data", "Binance, Coinbase, OKX, Bybit WebSockets"],
  ["Historical candles", "static-klines (GitHub Pages) + Binance REST gap-fill"],
  ["24h stats / funding / OI", "Binance REST (spot + futures)"],
  ["Sentiment", "alternative.me Fear & Greed Index"],
  ["News", "CoinDesk, CoinTelegraph, The Block, Decrypt, Bitcoin Magazine, CNBC"],
];

export default function AboutPage() {
  const { theme } = useTheme();

  return (
    <div
      className="app-scale flex flex-col overflow-x-hidden"
      style={{ background: theme.bg, color: theme.text }}
    >
      <header
        className="h-11 px-3.5 flex items-center gap-4 shrink-0 sticky top-0 z-10"
        style={{ background: theme.panel, borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="font-bold text-base tracking-wider" style={{ color: theme.yellow }}>
          YMC TERMINAL
        </div>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: theme.dim }}>
          About
        </span>
        <Link
          href="/"
          className="text-sm px-2 py-1 rounded border hover:opacity-70 ml-auto"
          style={{ borderColor: theme.border, color: theme.dim }}
        >
          ← Terminal
        </Link>
      </header>

      <main className="max-w-3xl w-full mx-auto px-5 py-6 flex flex-col gap-6 overflow-y-auto min-h-0">
        <section className="flex flex-col gap-1.5">
          <h1 className="text-xl tracking-wide" style={{ color: theme.text }}>
            Bloomberg-style terminal for Bitcoin
          </h1>
          <p className="text-xs leading-relaxed" style={{ color: theme.dim }}>
            A real-time BTC/USDT trading dashboard with a multi-panel layout, live market
            data from four exchanges, technical indicators, drawing tools, price alerts and
            a news feed — all open-source and free of API keys.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle label="Features" theme={theme} />
          <ul className="flex flex-col gap-1">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-xs leading-snug">
                <span className="shrink-0" style={{ color: theme.green }}>▹</span>
                <span style={{ color: theme.text }}>{f}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle label="Tech Stack" theme={theme} />
          <ul className="flex flex-col gap-1">
            {STACK.map((s) => (
              <li key={s} className="flex items-start gap-2 text-xs leading-snug">
                <span className="shrink-0" style={{ color: theme.blue }}>▹</span>
                <span style={{ color: theme.text }}>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle label="Data Sources" theme={theme} />
          <ul className="flex flex-col gap-1">
            {SOURCES.map(([name, detail]) => (
              <li key={name} className="flex items-baseline gap-2 text-xs leading-snug">
                <span className="shrink-0 uppercase tracking-wider" style={{ color: theme.dim }}>
                  {name}
                </span>
                <span className="flex-1 h-px self-center" style={{ background: theme.border }} />
                <span style={{ color: theme.text }}>{detail}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer
        className="px-5 py-4 flex items-center gap-2 text-xs"
        style={{ borderTop: `1px solid ${theme.border}`, color: theme.dim }}
      >
        <span>YMC Terminal is open source</span>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border px-2 py-1 hover:opacity-70"
          style={{ borderColor: theme.border, color: theme.blue }}
        >
          github.com/enginior/YMC-terminal →
        </a>
      </footer>
    </div>
  );
}

function SectionTitle({ label, theme }: { label: string; theme: Theme }) {
  return (
    <h2 className="text-[11px] uppercase tracking-widest" style={{ color: theme.yellow }}>
      {label}
    </h2>
  );
}