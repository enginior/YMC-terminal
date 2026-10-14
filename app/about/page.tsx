"use client";

import Link from "next/link";
import { useTheme, type Theme } from "@/context/ThemeContext";
import { REPO_URL } from "@/lib/links";

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
  "Vercel serverless API routes, no API keys",
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
      className="app-scale flex flex-col h-full overflow-hidden"
      style={{ background: theme.bg, color: theme.text }}
    >
      <header
        className="h-11 px-3.5 flex items-center gap-4 shrink-0"
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

      <main className="flex-1 min-h-0 overflow-y-auto p-5 lg:p-8">
        <div className="w-full flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <h1 className="text-2xl lg:text-3xl tracking-wide" style={{ color: theme.text }}>
              Bloomberg-style terminal for Bitcoin
            </h1>
            <p className="text-sm lg:text-base leading-relaxed max-w-5xl" style={{ color: theme.dim }}>
              A real-time BTC/USDT trading dashboard with a multi-panel layout, live market
              data from four exchanges, technical indicators, drawing tools, price alerts and
              a multi-source news feed — open source and entirely free of API keys.
            </p>
          </section>

          <Card title="Features" theme={theme}>
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm leading-snug">
                  <span className="shrink-0" style={{ color: theme.green }}>▹</span>
                  <span style={{ color: theme.text }}>{f}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card title="Tech Stack" theme={theme}>
              <ul className="flex flex-col gap-2">
                {STACK.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm leading-snug">
                    <span className="shrink-0" style={{ color: theme.blue }}>▹</span>
                    <span style={{ color: theme.text }}>{s}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Data Sources" theme={theme} className="lg:col-span-2">
              <ul className="flex flex-col gap-2.5">
                {SOURCES.map(([name, detail]) => (
                  <li key={name} className="flex items-baseline gap-3 text-sm leading-snug">
                    <span className="shrink-0 w-44 uppercase tracking-wider text-xs" style={{ color: theme.dim }}>
                      {name}
                    </span>
                    <span className="flex-1 h-px self-center" style={{ background: theme.border }} />
                    <span className="text-right" style={{ color: theme.text }}>{detail}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <footer
            className="flex flex-wrap items-center gap-3 pt-2 text-sm"
            style={{ color: theme.dim }}
          >
            <span>YMC Terminal is free software, licensed under the GNU GPLv3.</span>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border px-3 py-1.5 hover:opacity-70"
              style={{ borderColor: theme.border, color: theme.blue }}
            >
              View source on GitHub →
            </a>
          </footer>
        </div>
      </main>
    </div>
  );
}

function Card({
  title,
  theme,
  className = "",
  children,
}: {
  title: string;
  theme: Theme;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded flex flex-col gap-3 p-4 ${className}`}
      style={{ background: theme.panel, border: `1px solid ${theme.border}` }}
    >
      <h2 className="text-[11px] uppercase tracking-widest" style={{ color: theme.yellow }}>
        {title}
      </h2>
      {children}
    </section>
  );
}