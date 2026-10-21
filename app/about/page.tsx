"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme, type Theme } from "@/context/ThemeContext";
import { REPO_URL } from "@/lib/links";

interface ReleaseUpdate {
  version: string;
  badge: string;
  tagline: string;
  date: string;
  isLatest?: boolean;
  categories: {
    name: string;
    items: string[];
  }[];
}

const RELEASES: ReleaseUpdate[] = [
  {
    version: "v0.1.4",
    badge: "Latest Release · Phase 3 Polish",
    tagline: "Chart Visuals Dropdown (Candles, Heikin Ashi, Line) & 24H / Prev Session High-Low Key Levels",
    date: "Current",
    isLatest: true,
    categories: [
      {
        name: "Advanced Chart Visual Styles",
        items: [
          "Chart Visuals Dropdown: Instant toggle between Candlesticks, smoothed Heikin Ashi trend bars, and continuous Line chart with custom vector icons.",
          "Mathematical Heikin Ashi computation (lib/heikenAshi.ts) filtering market noise and emphasizing prevailing trend direction.",
          "Seamless zero-flicker transitions that maintain technical drawings, sub-pane indicators, and day separators intact without recreating the chart canvas.",
          "Local persistence across sessions via localStorage (btc-terminal:chart-type).",
        ],
      },
      {
        name: "Multi-Session Watermark Key Levels (H/L)",
        items: [
          "Multi-session price watermarks: 24H Rolling High (Green dashed), 24H Rolling Low (Red dashed), Previous Day High (PDH - Cyan dotted), and Previous Day Low (PDL - Amber dotted).",
          "Windowed precision: anchored to live 24H exchange stats and yesterday's UTC 00:00–23:59 session, eliminating historical candle scale distortion.",
          "Dynamic price scale auto-fit: activating H/L automatically adjusts the right price scale to bring all active session levels cleanly into view.",
          "Toggle state persisted to localStorage (btc-terminal:session-hl) with active visual feedback.",
        ],
      },
    ],
  },
  {
    version: "v0.1.3",
    badge: "Phase 3 Release",
    tagline: "Precious Metals & Commodities, Vector Asset Logos, and Broker-Style Day Lines",
    date: "Prior",
    categories: [
      {
        name: "Precious Metals & Commodities Universe",
        items: [
          "Added Gold (XAU/USDT), Silver (XAG/USDT), and Crude Oil (OIL/USDT) powered by institutional derivatives feeds.",
          "Smart command bar and search resolution: typing GOLD, SILVER, CRUDE, WTI, or OIL automatically maps to proper exchange pair codes.",
        ],
      },
      {
        name: "Bespoke Vector Asset Logos",
        items: [
          "Integrated crisp, high-definition SVG coin logos for all cryptocurrencies (BTC, ETH, SOL, XRP, BNB, DOGE, SUI, AVAX, LINK).",
          "Custom 3D metallic bullion ingot badges for Gold (AU) and Silver (AG), plus industrial steel drum for Crude Oil.",
          "Badges surfaced across Watchlist, MarketStats, CommandBar chips, and Comparison panel.",
        ],
      },
      {
        name: "Broker-Style Day Lines & UI Enhancements",
        items: [
          "Re-engineered UTC day boundary lines to render strictly in between the last candle of the previous day and the first candle of the new day.",
          "Broken/dashed line styling matching professional broker chart layouts, preventing vertical lines from ever slicing through candle bodies.",
          "Global Long/Short Account Sentiment Ratio displaying real-time net long % vs. net short % trader positioning.",
          "Mark Price vs. Spot Price Basis Spread metric in MarketStats.",
          "Watchlist 1-click sorting: 24h Change % (Top Gainers/Losers), 24h Notional Volume, and Alphabetical.",
          "One-click 'Reset Layout' action in Settings to restore the default 12-column Bloomberg grid.",
        ],
      },
    ],
  },
  {
    version: "v0.1.2",
    badge: "Phase 1 & Perpetual Analytics",
    tagline: "Live Liquidation Feed, Funding Countdown, Delta Ruler, and Solo Focus",
    date: "Prior",
    categories: [
      {
        name: "Order Flow & Derivatives",
        items: [
          "Real-time Perpetual Liquidation Feed streaming contract liquidations across all USDT perpetual derivatives.",
          "Next Funding Countdown timer with annualized APR rate calculation.",
        ],
      },
      {
        name: "Charting Utilities & Navigation",
        items: [
          "Interactive Chart Delta Ruler tool (Shift + click or toolbar icon) to measure price difference, percentage delta, and bar counts.",
          "Panel Maximize / Solo Focus mode (hotkey 'f' or panel header icon) for fullscreen analysis.",
          "Bloomberg Command Bar syntax parser (e.g. 'BTC 15M', 'THEME MATRIX', 'FULL', 'GRID').",
          "Added 30m and 2h timeframes with future whitespace projection for technical drawing tools.",
        ],
      },
    ],
  },
  {
    version: "v0.1.1",
    badge: "Phase 0 & Terminal Operator Tools",
    tagline: "Dynamic Sentiment, Keyboard Hotkeys, and Chart Export",
    date: "Prior",
    categories: [
      {
        name: "Core Workstation Utilities",
        items: [
          "Dynamic per-symbol sentiment, funding rates, and open interest for the active chart pair.",
          "Operator keyboard hotkeys with cheat sheet modal (? key, 1-9 & 0 quick select, [ / ] timeframe cycling).",
          "High-resolution PNG chart snapshots and full OHLCV CSV historical data download.",
        ],
      },
    ],
  },
];

const FEATURES = [
  "Real-time multi-exchange price aggregate (Binance, Coinbase, OKX, Bybit WebSockets)",
  "Live order book, time & sales, and per-exchange spread view",
  "Perpetual derivatives analytics: Liquidation feed, Long/Short ratio, funding countdown & APR",
  "Candlestick chart with RSI, MACD, Stoch RSI and Bollinger Bands in native sub-panes",
  "Level / trendline / box drawings, ruler delta tool, crosshair snap-to-price, shaded bands",
  "Commodities & precious metals: Gold (XAU/USDT), Silver (XAG/USDT), Crude Oil (OIL/USDT)",
  "Price alerts with sound and toast notifications",
  "Drag-and-drop terminal panels with a persisted layout",
  "Multi-source news feed with bull/bear sentiment filter",
  "BTC/ETH rolling correlation and macroeconomic calendar",
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
  ["Commodities / Perpetuals", "Binance Futures (fapi / fstream)"],
  ["Historical candles", "static-klines (GitHub Pages) + Binance REST gap-fill"],
  ["24h stats / funding / OI", "Binance REST (spot + futures)"],
  ["Sentiment", "alternative.me Fear & Greed + Binance Long/Short Ratio"],
  ["News", "CoinDesk, CoinTelegraph, The Block, Decrypt, Bitcoin Magazine, CNBC"],
];

export default function AboutPage() {
  const { theme } = useTheme();
  const [showOlderReleases, setShowOlderReleases] = useState(false);

  return (
    <div
      className="app-scale flex flex-col h-full overflow-hidden"
      style={{ background: theme.bg, color: theme.text }}
    >
      <header
        className="h-11 px-3.5 flex items-center gap-4 shrink-0"
        style={{ background: theme.panel, borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-2">
          <div className="font-bold text-base tracking-wider" style={{ color: theme.yellow }}>
            YMC TERMINAL
          </div>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
            style={{ borderColor: theme.border, color: theme.dim }}
          >
            v0.1.4
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: theme.dim }}>
          About & Changelog
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
        <div className="w-full flex flex-col gap-6 max-w-6xl mx-auto">
          {/* Hero Section */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded"
                style={{ background: `${theme.green}25`, color: theme.green }}
              >
                Production Release v0.1.4
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl tracking-wide font-bold" style={{ color: theme.text }}>
              Bloomberg-style workstation for Crypto & Perpetual Derivatives
            </h1>
            <p className="text-sm lg:text-base leading-relaxed" style={{ color: theme.dim }}>
              A real-time financial trading terminal with a multi-panel layout, live market
              data from four exchanges, derivatives order flow telemetry, technical indicators, drawing tools,
              price alerts, macroeconomic calendar, and a multi-source news feed — open source and entirely free of API keys.
            </p>
          </section>

          {/* Release Notes & Major Updates Section */}
          <Card title="Major Updates & Release Notes" theme={theme}>
            <div className="flex flex-col gap-5">
              {RELEASES.filter((r) => r.isLatest || showOlderReleases).map((rel) => (
                <div
                  key={rel.version}
                  className="rounded p-4 border flex flex-col gap-3"
                  style={{
                    background: rel.isLatest ? `${theme.bg}90` : "transparent",
                    borderColor: rel.isLatest ? theme.yellow : `${theme.border}80`,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: `${theme.border}60` }}>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-base font-bold" style={{ color: theme.text }}>
                        {rel.version}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded font-medium"
                        style={{
                          background: rel.isLatest ? `${theme.yellow}20` : `${theme.dim}20`,
                          color: rel.isLatest ? theme.yellow : theme.dim,
                        }}
                      >
                        {rel.badge}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: theme.dim }}>
                      {rel.tagline}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {rel.categories.map((cat) => (
                      <div key={cat.name} className="flex flex-col gap-1.5">
                        <div
                          className="text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: rel.isLatest ? theme.yellow : theme.blue }}
                        >
                          {cat.name}
                        </div>
                        <ul className="flex flex-col gap-1.5 text-xs" style={{ color: theme.text }}>
                          {cat.items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                              <span className="shrink-0" style={{ color: theme.green }}>
                                ▹
                              </span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-center pt-1">
                <button
                  onClick={() => setShowOlderReleases((prev) => !prev)}
                  className="text-xs px-3 py-1 rounded border hover:opacity-80 transition-opacity font-mono"
                  style={{ borderColor: theme.border, color: theme.dim }}
                >
                  {showOlderReleases ? "▲ Collapse Prior Versions" : "▼ View Prior Versions (v0.1.3, v0.1.2, v0.1.1)"}
                </button>
              </div>
            </div>
          </Card>

          {/* Features Section */}
          <Card title="Terminal Features" theme={theme}>
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm leading-snug">
                  <span className="shrink-0" style={{ color: theme.green }}>
                    ▹
                  </span>
                  <span style={{ color: theme.text }}>{f}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Tech Stack & Data Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card title="Tech Stack" theme={theme}>
              <ul className="flex flex-col gap-2">
                {STACK.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm leading-snug">
                    <span className="shrink-0" style={{ color: theme.blue }}>
                      ▹
                    </span>
                    <span style={{ color: theme.text }}>{s}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Data Sources" theme={theme} className="lg:col-span-2">
              <ul className="flex flex-col gap-2.5">
                {SOURCES.map(([name, detail]) => (
                  <li key={name} className="flex items-baseline gap-3 text-sm leading-snug">
                    <span className="shrink-0 w-48 uppercase tracking-wider text-xs" style={{ color: theme.dim }}>
                      {name}
                    </span>
                    <span className="flex-1 h-px self-center" style={{ background: theme.border }} />
                    <span className="text-right" style={{ color: theme.text }}>
                      {detail}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Footer */}
          <footer
            className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t text-sm pb-6"
            style={{ borderColor: theme.border, color: theme.dim }}
          >
            <span>YMC Terminal is free software, licensed under the GNU GPLv3.</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs">YMC Terminal v0.1.4</span>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border px-3 py-1.5 hover:opacity-70"
                style={{ borderColor: theme.border, color: theme.blue }}
              >
                View source on GitHub →
              </a>
            </div>
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
      <h2 className="text-[11px] uppercase tracking-widest font-bold" style={{ color: theme.yellow }}>
        {title}
      </h2>
      {children}
    </section>
  );
}