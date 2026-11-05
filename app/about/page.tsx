"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme, type Theme } from "@/context/ThemeContext";
import { REPO_URL } from "@/lib/links";
import katex from "katex";
import "katex/dist/katex.min.css";

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
    version: "v0.3.2",
    badge: "Quant Math & Audio Telemetry Release",
    tagline: "LaTeX Mathematical Specifications, Order Filled Voice Telemetry, Armed Alert Controls & Time Machine Ensembles",
    date: "Current",
    isLatest: true,
    categories: [
      {
        name: "Audio Telemetry: 'Order Filled' Voice for Armed Setups",
        items: [
          "Institutional voice alert telemetry: automatically plays authentic 'Order filled' audio whenever armed Take Profit (TP) or Stop Loss (SL) levels are executed.",
          "High-performance AudioBuffer architecture: pre-decodes audio into memory via AudioContext.decodeAudioData upon user interaction for zero-latency, background-tab continuous playback.",
          "Armed vs. Standard Mode switch: tag individual price alerts as ⚡ ARMED or ♪ Chime directly from AlertsPanel with live audio preview testing.",
          "Visual 'Order Filled' alert beacon: distinct green glow and contextual setup labels (e.g. ORB TP, ICT AMD SL) when price targets are achieved.",
        ],
      },
      {
        name: "KaTeX / LaTeX Institutional Mathematical Typesetting",
        items: [
          "Mathematical formulations across all 6 Pine-style strategy detectors (ORB, ICT AMD, Bollinger Squeeze, Mean Reversion, Trend Flag, and Liquidity Sweep).",
          "Dedicated LaTeX display equations for dynamic Stop Loss and Take Profit risk-to-reward projections.",
          "Detailed notation and variable breakdown legends translating quantitative calculus into plain-English trading mechanics.",
        ],
      },
      {
        name: "Hybrid Time Machine Bayesian Master Equation",
        items: [
          "Master composite quant formulation: P_win = 45% Backtest + 30% Analogs + 25% Monte Carlo with mathematical expectancy E[R].",
          "Explicit formulas for historical trade backtest win rate & profit factor, 11-dimensional Euclidean vector distance for pattern analogs, and 2,500-path empirical return bootstrap resampling.",
        ],
      },
    ],
  },
  {
    version: "v0.3.1",
    badge: "Precision Charting & Multi-Exchange Update",
    tagline: "TradingView-Style Free Floating Cursor, Explicit OHLC Magnet Snapping, OKX Integration & Workspace Density",
    date: "Prior",
    isLatest: false,
    categories: [
      {
        name: "TradingView-Style Free Floating Crosshair & OHLC Magnet",
        items: [
          "Crosshair lines (perpendicular horizontal price and vertical time axis guides) float smoothly across the chart canvas without automatically sticking or snapping to candle wicks when Magnet Mode is off.",
          "Explicit OHLC Magnet Mode (🧲 button in chart drawing rail or toolbar) activates CrosshairMode.MagnetOHLC for pixel-perfect anchor snapping to candle Open, High, Low, or Close levels.",
          "Pointer-leave cleanup: instantly clears synthetic crosshair position on pointer exit, eliminating stuck or displaced crosshairs.",
        ],
      },
      {
        name: "Tri-Exchange Real-Time Data Routing (OKX, Bybit & Binance)",
        items: [
          "Full OKX spot & swap ticker API integration (fetchOkxTicker) and historical klines backfill (fetchOkxKlines) with graceful fallback resilience.",
          "Live WebSocket trade streams and ticker synchronization for OKX alongside Binance and Bybit in useMultiExchangeData.",
          "Unified Feed Source selector (BINANCE | BYBIT | OKX) in the top MarketStats strip and CommandBar with 100% price synchronization across ticker, chart, and order book.",
        ],
      },
      {
        name: "Collapsible Secondary Panels & Workspace Density",
        items: [
          "Quick one-click collapsible panel controls for secondary trading widgets: OrderBook, TradeTape, Market Sentiment, and Alerts.",
          "Sticky collapse header bars with instant expand/collapse indicators to maximize PriceChart and Day Trader scanner screen real estate.",
        ],
      },
      {
        name: "Build Resilience & Monorepo Dependency Fixes",
        items: [
          "Resolved upstream peer dependency resolution conflict with @types/node and vitest in production Vercel CI/CD via .npmrc legacy-peer-deps configuration.",
          "Maintained 100% test coverage with expanded Vitest test suites for crosshair modes, drawing primitives, and multi-exchange routing.",
        ],
      },
    ],
  },
  {
    version: "v0.3.0",
    badge: "Major Quantitative & Architecture Release",
    tagline: "Day Trader Desk, Hybrid Time Machine, ICT AMD Strategy, Unified Exchange Source & Split-Screen Workspace",
    date: "Prior",
    isLatest: false,
    categories: [
      {
        name: "Day Trader Desk & 6 Pine-Style Strategy Detectors",
        items: [
          "Dedicated multi-timeframe tactical scanner focused on BTC/USDT and XAU/USDT (Gold) across 5m, 15m, 1h, and 4h timeframes.",
          "6 deterministic Pine-style setup detectors: Opening Range Breakout (ORB), ICT AMD / Power of 3 (Accumulation · Manipulation Judas Swing · Distribution), Bollinger Volatility Squeeze (SQZ), Mean-Reversion Extremes (MRV), Trend Pullback Flag (FLG), and Liquidity Sweep Reversal (SWP).",
          "Configurable 1.5R / 2.0R / 3.0R Risk-Reward targets anchored to ATR(14) and structural swing stop-loss rules.",
          "One-click chart plotting (projects Long/Short Risk-Reward boxes with exact entry, stop, and TP directly onto PriceChart), live Pine-style Buy/Sell signal markers overlay, and 1-click TP/SL price alert arming.",
        ],
      },
      {
        name: "Hybrid Time Machine Simulator (3-Pillar Quant Engine)",
        items: [
          "Strategy Backtester (45% weight): Replays strategy rules bar-by-bar across historical klines over 12b / 24b / 48b horizons to compute Win Rate, Profit Factor, Expectancy (R), Max Drawdown, and an interactive SVG cumulative-R equity curve.",
          "10-Bar Pattern Analogs (30% weight): Normalizes price structure and RSI(14) into a 10-bar feature vector, scanning history via Euclidean distance to surface the top 25 closest historical twins and their forward win rate.",
          "Monte Carlo Bootstrap Simulator (25% weight): Simulates 2,500 seeded forward paths by resampling empirical returns and intrabar high/low wicks to output TP Hit %, SL Hit %, and the P10 / P50 / P90 price cone.",
        ],
      },
      {
        name: "Unified Exchange Feed Source (Binance, Bybit & OKX)",
        items: [
          "Replaced legacy 4-exchange price averaging with a unified, single-authority Feed Source selector (BINANCE | BYBIT | OKX) in the top MarketStats strip and command bar.",
          "100% price synchronization between the top MarketStats headline price, 24h ticker stats, PriceChart candlesticks, OrderBook L2 ladder, TradeTape, and Day Trader scanner.",
          "Automatic BINANCE FUT routing for commodity perpetuals (Gold XAU/USDT, Silver XAG/USDT, WTI Crude Oil OIL/USDT).",
        ],
      },
      {
        name: "O(1) Chart Performance & 45-Bar Focused Viewport",
        items: [
          "Focused initial & symbol-switch viewport zoom targeting the latest 45 candles via setVisibleLogicalRange instead of compressing 8,700+ historical bars into a single view.",
          "O(1) intrabar WebSocket updates via series.update() instead of full-array setData() rebuilds, plus lazy indicator evaluation (zero CPU overhead when sub-pane indicators are inactive).",
          "Cross-symbol store verification and price-scale guards preventing stale candles or plotted setups from leaking across BTC and Gold charts.",
        ],
      },
      {
        name: "Collapsible Left Rail & Half-Viewport Widget Expansion",
        items: [
          "One-click Left Sidebar toggle (◧ button in CommandBar or hotkey B) collapses the Watchlist, Economic Calendar, and Market Heatmap rail to give PriceChart up to 9–12 columns of workspace.",
          "Split-screen right widget maximize: expanding any right-hand widget (Day Trader Desk, Order Book, News, etc.) now occupies 50% of the viewport (6 columns) while keeping PriceChart live alongside it on the left.",
        ],
      },
      {
        name: "Full-Viewport Strategy Playbook & Visual Schematics",
        items: [
          "Added interactive SVG price-action schematics and mathematical rules for all 6 strategies plus the 3-pillar Time Machine architecture on the About page.",
          "Redesigned About & Documentation layout to occupy the full viewport width with ~20% larger responsive typography across desktop, tablet, and mobile.",
        ],
      },
    ],
  },
  {
    version: "v0.2.0",
    badge: "Milestone Release",
    tagline: "TradingView-Style Charting Engine, Native Sub-Panes, Institutional Pair Switcher & Market Sessions",
    date: "Prior",
    categories: [
      {
        name: "Professional TradingView-Style Drawing Suite (Specs 005–008)",
        items: [
          "Left drawing rail with flyout tool categories: Trendlines, Horizontal Lines, Rays, Channels, Fibonacci Retracements, Long/Short Position tools with R:R, and Measurement Ruler.",
          "Interactive anchor handle dragging with live OHLC magnet snapping.",
          "Floating drawing properties toolbar for stroke width (1-3px), line style (solid/dashed/dotted), 10 color swatches, lock toggle, and delete.",
          "Full 50-step undo/redo history engine (Ctrl+Z / Ctrl+Y) with versioned localStorage schema migration.",
        ],
      },
      {
        name: "Native Sub-Panes: Derivatives & Order Flow (Spec 012)",
        items: [
          "Native lightweight-charts v5 multi-pane architecture with draggable pane dividers and preserved user-resized heights.",
          "Open Interest (OI) sub-pane with formatted area series ($B / $M / $k).",
          "Funding Rate sub-pane with 8-hour settlement histograms, color-coded bars, and 0.00% reference line.",
          "Cumulative Volume Delta (CVD) continuous aggressive buy/sell market order flow oscillator.",
        ],
      },
      {
        name: "Real-Time Liquidation Markers on Chart (Spec 013)",
        items: [
          "Direct integration with Binance Futures liquidation stream (!forceOrder@arr).",
          "Price-level circle beacons scaled by notional USD liquidation volume with customizable minimum filters ($10K, $50K, $100K, $500K, $1M).",
        ],
      },
      {
        name: "Institutional Symbol Search Modal & Quick Pair Switcher (Spec 009)",
        items: [
          "Bloomberg-style pair switcher invoked via global hotkey Ctrl+K or / or header badges.",
          "Categorized asset filtering (All, Layer 1, DeFi, Meme, Commodities) with real-time streaming prices and 24h stats.",
          "Recent symbol search history with keyboard arrow-key navigation and instant Enter selection.",
        ],
      },
      {
        name: "Configurable Technical Indicators (Spec 010)",
        items: [
          "Customizable mathematical parameters for SMA, EMA, Bollinger Bands, RSI, MACD, and Stoch RSI.",
          "Inline configuration drawer in fx Indicators Modal with instant re-computation and localStorage persistence.",
          "Dynamic overbought/oversold translucent zones and dashed threshold lines.",
        ],
      },
      {
        name: "Global Market Sessions & DST Tracker (Specs 015 & 016)",
        items: [
          "Forex Factory-style 24-hour global trading sessions timeline (Sydney, Tokyo, London, New York).",
          "Automatic local viewer time conversion and daylight saving time (DST) offset calculations.",
          "Wraparound day boundary segments and Tokyo Stock Exchange 1h lunch break visualization.",
        ],
      },
      {
        name: "Background-Tab Resource Throttling & Power Optimization (Spec 017)",
        items: [
          "Intelligent visibility polling (useVisibilityPolling): pauses periodic REST requests when browser tab is hidden to conserve CPU, battery, and server bandwidth.",
          "Immediate on-visible hydration: automatically refreshes data the moment the user focuses back on the terminal tab.",
          "Background alert continuity: routes socket tickers via timeout dispatch so price alerts and desktop notifications continue firing seamlessly.",
        ],
      },
    ],
  },
  {
    version: "v0.1.6",
    badge: "Prior Release · Phase 4 & 5",
    tagline: "Reactive Tick Store, Render Isolation & Targeted Intelligence Filters",
    date: "Prior",
    categories: [
      {
        name: "Reactive External Tick Store (Render Isolation)",
        items: [
          "Zero-dependency reactive store (lib/marketStore.ts) on React 19 useSyncExternalStore with requestAnimationFrame batching.",
          "Complete root render isolation: Home and NewsFeedPanel idle re-renders drop from ~200/10s to exactly 0 renders.",
          "Panel-level slice subscriptions: OrderBook and TradeTape stream at display refresh rate (≤ 60/s) without parent reconciliation; MarketStats throttled to 1 Hz.",
          "Imperative alert evaluation in useAlerts decoupling price thresholds from page state.",
        ],
      },
      {
        name: "Active-Asset News Tagging & One-Click Filter",
        items: [
          "Server-side keyword and ticker classification (lib/newsTags.ts) covering all 12 tracked assets plus macro topics (ETF, SEC, MACRO) with strict word-boundary regexes and case-sensitive collision protection.",
          "Header toggle button ◎ {SYMBOL} to isolate headlines relevant to the currently charted asset with zero network refetches.",
          "Visual tag chips with active symbol highlighted in amber, remainder badges (+N), and honest empty state counts.",
          "Expanded headline feed limits from 30 to 80 items across 6 institutional RSS sources.",
        ],
      },
      {
        name: "Economic Calendar Impact & Currency Filters",
        items: [
          "Interactive compact header filters: single-choice minimum impact (HIGH vs HIGH+MED) and multi-select currency pills (USD, EUR, GBP, JPY, etc.).",
          "6px visual importance dots on each row: red for High impact and yellow for Medium impact.",
          "Resilient parallel upstream fetching (biquote.io) via Promise.allSettled with deduplication and partial data retention.",
          "Persistence under btc-terminal:calendar-filters protected by skipNextSaveRef against StrictMode double-mount.",
        ],
      },
    ],
  },
  {
    version: "v0.1.5",
    badge: "Phase 4 Release",
    tagline: "Crypto Market Treemap Heatmap & Consolidated Sparkline Watchlist",
    date: "Prior",
    categories: [
      {
        name: "Crypto Market Treemap Status Widget",
        items: [
          "Institutional S&P 500 / Finviz / Coin360 style squarified treemap layout positioned directly below the High Impact Macro section.",
          "Dynamic volume-weighted tile sizing scaling proportionally with 24h market activity across all 12 tracked assets.",
          "High-contrast color heatmaps: deep crimson gradients for pullbacks, vibrant emerald gradients for market rallies, and neutral slate for flat sessions.",
          "Full tile telemetry: asset logo badge, uppercase symbol name, 24h % delta, live price, and 1-click terminal-wide chart synchronization.",
        ],
      },
      {
        name: "Consolidated Sparkline Watchlist",
        items: [
          "Embedded 24h mini SVG trendline curves directly into every Watchlist row, matching directional color coding without redundant polling.",
          "Unified information density: preserves live prices, notional 24h volume, sort controls (Gainers, Losers, Volume, A-Z), and instant symbol selection.",
          "Retires redundant standalone comparison panel to maximize terminal workspace efficiency.",
        ],
      },
    ],
  },
  {
    version: "v0.1.4",
    badge: "Phase 3 Polish",
    tagline: "Chart Visuals Dropdown (Candles, Heikin Ashi, Line) & 24H / Prev Session High-Low Key Levels",
    date: "Prior",
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
  "Unified Exchange Feed Source (selectable Binance, Bybit, or OKX WebSocket + REST authority)",
  "Day Trader Desk: 6 Pine-style setup detectors (ORB, AMD Power of 3, BB Squeeze, Mean Reversion, Trend Flag, Liq Sweep) + Hybrid Time Machine",
  "Live L2 order book, time & sales tape, and 24h mark/basis spread strip",
  "Collapsible left sidebar (Watchlist, Macro Calendar, Heatmap) & 50/50 split-screen widget expansion",
  "Perpetual derivatives analytics: Liquidation feed, Long/Short ratio, funding countdown & APR",
  "Candlestick chart with RSI, MACD, Stoch RSI, OI, Funding & CVD in native v5 sub-panes",
  "Level / trendline / box / fib / channel / position drawings, ruler delta tool, OHLC magnet snap",
  "Commodities & precious metals: Gold (XAU/USDT), Silver (XAG/USDT), Crude Oil (OIL/USDT)",
  "Price alerts with audio chimes, desktop notifications, and 1-click TP/SL setup arming",
  "Drag-and-drop terminal panels with persisted layout",
  "Multi-source news feed with bull/bear sentiment and active-asset filters",
  "Global market trading sessions (Sydney, Tokyo, London, New York) with automatic DST tracking",
  "Customizable themes with an in-app color editor",
];

interface StrategyPlaybookItem {
  id: "orb" | "amd" | "squeeze" | "mean_rev" | "flag" | "sweep";
  badge: string;
  title: string;
  subtitle: string;
  regime: string;
  phases: [string, string, string];
  stopRule: string;
  formula: string;
  formulaTex: string;
  targetRuleTex: string;
  variables: { symbol: string; meaning: string }[];
}

const STRATEGY_PLAYBOOK: StrategyPlaybookItem[] = [
  {
    id: "orb",
    badge: "ORB",
    title: "Opening Range Breakout",
    subtitle: "Session Killzone Range Expansion",
    regime: "Asia (00:00), London (07:00) & NY (13:00 UTC) Opens",
    phases: [
      "1. Range Lock: Tracks the high/low of the 6-bar opening consolidation box (span ≤ 3.8× ATR).",
      "2. Breakout Trigger: Candle closes cleanly outside range high/low with directional body.",
      "3. Volume & Trend Filter: Requires Relative Volume (RVOL) ≥ 1.1× and EMA(20) slope alignment.",
    ],
    stopRule: "Opposite opening range boundary (clamped 0.75×–2.5× ATR)",
    formula: "Close > RangeHigh ∧ RVOL(20) ≥ 1.1 ∧ Close ≥ EMA(20)",
    formulaTex: "\\mathcal{C}_t > \\mathcal{R}_{\\text{high}} \\;\\land\\; \\text{RVOL}_{20} \\ge 1.1 \\;\\land\\; \\mathcal{C}_t \\ge \\text{EMA}_{20}",
    targetRuleTex: "\\text{SL} = \\mathcal{R}_{\\text{low}} \\in [0.75, 2.5] \\cdot \\text{ATR}_{14}, \\quad \\text{TP} = \\text{Entry} + k \\cdot (\\text{Entry} - \\text{SL})",
    variables: [
      { symbol: "\\mathcal{C}_t", meaning: "Current bar closing price" },
      { symbol: "\\mathcal{R}_{\\text{high}}", meaning: "Upper boundary of 6-bar opening range consolidation (Asia / London / NY killzones)" },
      { symbol: "\\text{RVOL}_{20}", meaning: "Relative volume ratio: V_t / \\overline{V}_{20} \\ge 1.1\\times average volume" },
      { symbol: "\\text{EMA}_{20}", meaning: "20-period Exponential Moving Average dynamic trend filter" },
      { symbol: "k", meaning: "Configurable Risk-to-Reward multiple (1.5R / 2.0R / 3.0R)" },
    ],
  },
  {
    id: "amd",
    badge: "AMD",
    title: "ICT AMD (Power of 3)",
    subtitle: "Accumulation • Manipulation • Distribution",
    regime: "Session Transitions & Stop-Hunt Liquidity Raids (Gold & BTC)",
    phases: [
      "1. Accumulation: Tight 7-bar consolidation box forms prior to session expansion (span ≤ 3.2× ATR).",
      "2. Manipulation (Judas Swing): Liquidity raid sweeps beyond the Accumulation Low/High by ≥ 0.08× ATR to trap breakout traders.",
      "3. Distribution (Displacement): Aggressive opposing candle body (≥ 0.22× ATR) reclaims the box and breaks prior bar structure.",
    ],
    stopRule: "Judas Swing manipulation wick extreme + 0.2× ATR buffer",
    formula: "ManipLow < AccLow ∧ Close > AccLow ∧ |Close - Open| ≥ 0.22×ATR",
    formulaTex: "\\mathcal{L}_{\\text{manip}} < \\mathcal{L}_{\\text{acc}} - 0.08 \\cdot \\text{ATR} \\;\\land\\; \\mathcal{C}_t > \\mathcal{L}_{\\text{acc}} \\;\\land\\; |\\mathcal{C}_t - \\mathcal{O}_t| \\ge 0.22 \\cdot \\text{ATR}",
    targetRuleTex: "\\text{SL} = \\mathcal{L}_{\\text{manip}} - 0.20 \\cdot \\text{ATR}_{14}, \\quad \\text{TP} = \\text{Entry} + k \\cdot (\\text{Entry} - \\text{SL})",
    variables: [
      { symbol: "\\mathcal{L}_{\\text{acc}}", meaning: "Lower boundary of tight 7-bar accumulation box prior to session expansion" },
      { symbol: "\\mathcal{L}_{\\text{manip}}", meaning: "Judas Swing manipulation wick sweeping \\ge 0.08\\times ATR below accumulation" },
      { symbol: "|\\mathcal{C}_t - \\mathcal{O}_t|", meaning: "Aggressive displacement body (\\ge 0.22\\times ATR) reclaiming the range" },
      { symbol: "\\text{SL}", meaning: "Manipulation wick extreme with 0.20\\times ATR protective safety buffer" },
    ],
  },
  {
    id: "squeeze",
    badge: "SQZ",
    title: "Bollinger Volatility Squeeze",
    subtitle: "Volatility Compression → Expansion Release",
    regime: "Low-Volatility Coiling Before High-Momentum Breakouts",
    phases: [
      "1. Coiling Squeeze: Bollinger Bandwidth (Upper - Lower) / Middle compresses into the lowest 25th percentile over 50 bars.",
      "2. Band Piercing: Price breaks and closes outside the upper or lower 2σ Bollinger Band.",
      "3. Momentum Ignition: Confirmed by an expanding MACD(12,26,9) histogram bar in the breakout direction.",
    ],
    stopRule: "20-period Bollinger Basis (Middle SMA) or 1.4× ATR(14)",
    formula: "BBWidth ∈ P₂₅ ∧ Close > BBUpper ∧ MACDHist > MACDHist₋₁",
    formulaTex: "\\text{BBW}_t \\le \\mathcal{P}_{25}\\left(\\{\\text{BBW}_\\tau\\}_{t-50}^t\\right) \\;\\land\\; \\mathcal{C}_t > \\text{BB}_{\\text{upper}} \\;\\land\\; \\Delta\\text{MACD}_{\\text{hist}} > 0",
    targetRuleTex: "\\text{SL} = \\text{SMA}_{20} \\;\\lor\\; (\\text{Entry} - 1.4 \\cdot \\text{ATR}_{14}), \\quad \\text{BBW} = \\frac{\\text{BB}_{\\text{upper}} - \\text{BB}_{\\text{lower}}}{\\text{SMA}_{20}}",
    variables: [
      { symbol: "\\text{BBW}_t", meaning: "Bollinger Bandwidth: (Upper - Lower) / Middle SMA_{20}" },
      { symbol: "\\mathcal{P}_{25}", meaning: "25th percentile compression over 50-bar lookback (volatility coiling)" },
      { symbol: "\\text{BB}_{\\text{upper}}", meaning: "2\\sigma upper Bollinger envelope piercing: \\text{SMA}_{20} + 2\\cdot\\sigma" },
      { symbol: "\\Delta\\text{MACD}_{\\text{hist}}", meaning: "Expanding MACD histogram momentum: \\text{Hist}_t - \\text{Hist}_{t-1} > 0" },
    ],
  },
  {
    id: "mean_rev",
    badge: "MRV",
    title: "Mean-Reversion Extremes",
    subtitle: "Multi-Oscillator Exhaustion Snapback",
    regime: "Range-Bound Markets & Overextended Climactic Flushes",
    phases: [
      "1. Outer Band Stretch: High/Low touches or pierces the outer 2σ Bollinger Band.",
      "2. Oscillator Confluence: RSI(14) ≤ 36 or Stoch RSI K ≤ 22 (Long) / RSI(14) ≥ 64 or Stoch K ≥ 78 (Short).",
      "3. Exhaustion Rejection: Prints a ≥ 35% rejection wick or opposing reversal close back inside the band.",
    ],
    stopRule: "2-bar extreme wick high/low + 0.2× ATR buffer",
    formula: "Low ≤ BBLower ∧ (RSI ≤ 36 ∨ StochK ≤ 22) ∧ Wick/Range ≥ 0.35",
    formulaTex: "\\mathcal{L}_t \\le \\text{BB}_{\\text{lower}} \\;\\land\\; (\\text{RSI}_{14} \\le 36 \\;\\lor\\; \\%K_{\\text{Stoch}} \\le 22) \\;\\land\\; \\frac{\\text{Wick}_{\\text{lower}}}{\\mathcal{H}_t - \\mathcal{L}_t} \\ge 0.35",
    targetRuleTex: "\\text{SL} = \\min(\\mathcal{L}_t, \\mathcal{L}_{t-1}) - 0.20 \\cdot \\text{ATR}_{14}, \\quad \\text{TP} = \\text{Entry} + k \\cdot (\\text{Entry} - \\text{SL})",
    variables: [
      { symbol: "\\mathcal{L}_t \\le \\text{BB}_{\\text{lower}}", meaning: "Intrabar low pierces outer 2\\sigma statistical boundary" },
      { symbol: "\\text{RSI}_{14} / \\%K", meaning: "Dual-oscillator exhaustion confluence (RSI \\le 36 or Stoch K \\le 22)" },
      { symbol: "\\frac{\\text{Wick}}{\\text{Range}} \\ge 0.35", meaning: "\\ge 35% rejection wick showing buyer absorption and reversal pressure" },
      { symbol: "\\text{SL}", meaning: "2-bar extreme wick low buffered by 0.20\\times ATR" },
    ],
  },
  {
    id: "flag",
    badge: "FLG",
    title: "Trend Pullback (Bull/Bear Flag)",
    subtitle: "EMA(20) Dynamic Support/Resistance Continuation",
    regime: "Established Directional Trends (EMA 20 > EMA 50)",
    phases: [
      "1. Trend Structure: EMA(20) stacked cleanly above EMA(50) for Bull Flag (or below for Bear Flag).",
      "2. Controlled Pullback: Prior 1–3 bars retrace into the dynamic EMA(20) value zone without breaking trend structure.",
      "3. Resumption Trigger: Current candle closes back across EMA(20) and takes out the prior candle's high/low.",
    ],
    stopRule: "Pullback swing low/high below EMA(20)",
    formula: "EMA₂₀ > EMA₅₀ ∧ Low₋₁ ≤ EMA₂₀ ∧ Close > High₋₁",
    formulaTex: "\\text{EMA}_{20} > \\text{EMA}_{50} \\;\\land\\; \\mathcal{L}_{t-1} \\le \\text{EMA}_{20} \\;\\land\\; \\mathcal{C}_t > \\mathcal{H}_{t-1}",
    targetRuleTex: "\\text{SL} = \\min_{1 \\le i \\le 3}(\\mathcal{L}_{t-i}), \\quad \\text{TP} = \\text{Entry} + k \\cdot (\\text{Entry} - \\text{SL})",
    variables: [
      { symbol: "\\text{EMA}_{20} > \\text{EMA}_{50}", meaning: "Stacked exponential moving averages confirming bullish regime" },
      { symbol: "\\mathcal{L}_{t-1} \\le \\text{EMA}_{20}", meaning: "Controlled 1-3 bar pullback touching the dynamic support zone" },
      { symbol: "\\mathcal{C}_t > \\mathcal{H}_{t-1}", meaning: "Resumption candle closes above previous high to resume trend" },
      { symbol: "\\text{SL}", meaning: "Lowest swing low of the 1-3 bar pullback below EMA_{20}" },
    ],
  },
  {
    id: "sweep",
    badge: "SWP",
    title: "Liquidity Sweep Reversal",
    subtitle: "Swing High/Low Stop-Run & Reclaim",
    regime: "Key Structural Swing Levels & Session Extremes",
    phases: [
      "1. Liquidity Pool: Identifies the 15-bar structural swing high and swing low.",
      "2. Stop-Hunt Pierce: Intrabar wick pierces beyond the 15-bar swing level to clear resting stop orders.",
      "3. Failed Auction Reclaim: Candle closes back inside the prior range with opposing body momentum.",
    ],
    stopRule: "Sweeping candle wick extreme + 0.2× ATR buffer",
    formula: "Low < SwingLow₁₅ ∧ Close > SwingLow₁₅ ∧ Close ≥ Open",
    formulaTex: "\\mathcal{L}_t < \\mathcal{S}_{\\text{low}}^{(15)} \\;\\land\\; \\mathcal{C}_t > \\mathcal{S}_{\\text{low}}^{(15)} \\;\\land\\; \\mathcal{C}_t \\ge \\mathcal{O}_t",
    targetRuleTex: "\\text{SL} = \\mathcal{L}_t - 0.20 \\cdot \\text{ATR}_{14}, \\quad \\mathcal{S}_{\\text{low}}^{(15)} = \\min_{1 \\le i \\le 15}(\\mathcal{L}_{t-i})",
    variables: [
      { symbol: "\\mathcal{S}_{\\text{low}}^{(15)}", meaning: "15-bar structural swing low resting liquidity pool" },
      { symbol: "\\mathcal{L}_t < \\mathcal{S}_{\\text{low}}^{(15)}", meaning: "Intrabar stop-hunt raid clearing resting sell-stops" },
      { symbol: "\\mathcal{C}_t > \\mathcal{S}_{\\text{low}}^{(15)}", meaning: "Failed auction reclaim with bullish directional candle body" },
      { symbol: "\\text{SL}", meaning: "Sweeping candle low extreme buffered by 0.20\\times ATR" },
    ],
  },
];

const STACK = [
  "Next.js 16 · React 19 · TypeScript",
  "lightweight-charts v5 (TradingView)",
  "Tailwind CSS v4 (CSS-first theming)",
  "Unified Binance, Bybit V5 & OKX V5 WebSockets + REST",
  "Vercel serverless API routes, no API keys",
];

const SOURCES: [string, string][] = [
  ["Unified market feed", "Selectable Binance, Bybit V5, or OKX V5 WebSockets (Trades, L2 Book, Klines)"],
  ["Commodities / Perpetuals", "Binance Futures (fapi / fstream) for XAU, XAG, WTI Oil"],
  ["Historical candles", "static-klines (GitHub Pages) + Binance / Bybit V5 / OKX V5 REST"],
  ["24h stats / funding / OI", "Binance, Bybit V5 & OKX V5 REST (spot + linear perpetuals)"],
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
        className="h-13 sm:h-14 px-4 sm:px-6 lg:px-10 flex items-center gap-4 shrink-0"
        style={{ background: theme.panel, borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="font-bold text-lg sm:text-xl tracking-wider" style={{ color: theme.yellow }}>
            YMC TERMINAL
          </div>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded border"
            style={{ borderColor: theme.border, color: theme.dim }}
          >
            v0.3.2
          </span>
        </div>
        <span className="hidden sm:inline text-xs sm:text-sm uppercase tracking-wider" style={{ color: theme.dim }}>
          About &amp; Strategy Documentation
        </span>
        <Link
          href="/"
          className="text-sm sm:text-base px-3 py-1.5 rounded border hover:opacity-70 ml-auto font-mono"
          style={{ borderColor: theme.border, color: theme.dim }}
        >
          ← Terminal
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-10 py-5 sm:py-7 lg:py-9">
        <div className="w-full flex flex-col gap-7 lg:gap-8">
          {/* Hero Section */}
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span
                className="text-xs sm:text-[13px] uppercase tracking-wider font-bold px-2.5 py-1 rounded"
                style={{ background: `${theme.green}25`, color: theme.green }}
              >
                Production Release v0.3.2
              </span>
            </div>
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl tracking-wide font-bold leading-tight"
              style={{ color: theme.text }}
            >
              Bloomberg-style workstation for Crypto &amp; Perpetual Derivatives
            </h1>
            <p
              className="text-base sm:text-[17px] lg:text-lg leading-relaxed"
              style={{ color: theme.dim }}
            >
              A real-time financial trading terminal with a multi-panel layout, live market
              data from four exchanges, derivatives order flow telemetry, quantitative setup
              scanning, technical indicators, drawing tools, price alerts, macroeconomic
              calendar, and a multi-source news feed — open source and entirely free of API keys.
            </p>
          </section>

          {/* Release Notes & Major Updates Section */}
          <Card title="Major Updates & Release Notes" theme={theme}>
            <div className="flex flex-col gap-6">
              {RELEASES.filter((r) => r.isLatest || showOlderReleases).map((rel) => (
                <div
                  key={rel.version}
                  className="rounded p-4 sm:p-5 lg:p-6 border flex flex-col gap-4"
                  style={{
                    background: rel.isLatest ? `${theme.bg}90` : "transparent",
                    borderColor: rel.isLatest ? theme.yellow : `${theme.border}80`,
                  }}
                >
                  <div
                    className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b"
                    style={{ borderColor: `${theme.border}60` }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="font-mono text-lg sm:text-xl font-bold"
                        style={{ color: theme.text }}
                      >
                        {rel.version}
                      </span>
                      <span
                        className="text-xs sm:text-[13px] px-2.5 py-0.5 rounded font-medium"
                        style={{
                          background: rel.isLatest ? `${theme.yellow}20` : `${theme.dim}20`,
                          color: rel.isLatest ? theme.yellow : theme.dim,
                        }}
                      >
                        {rel.badge}
                      </span>
                    </div>
                    <span className="text-sm sm:text-[15px]" style={{ color: theme.dim }}>
                      {rel.tagline}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-1">
                    {rel.categories.map((cat) => (
                      <div key={cat.name} className="flex flex-col gap-2">
                        <div
                          className="text-xs sm:text-sm font-semibold uppercase tracking-wider"
                          style={{ color: rel.isLatest ? theme.yellow : theme.blue }}
                        >
                          {cat.name}
                        </div>
                        <ul
                          className="flex flex-col gap-2 text-sm sm:text-[15px]"
                          style={{ color: theme.text }}
                        >
                          {cat.items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 leading-relaxed">
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
                  className="text-sm sm:text-[15px] px-4 py-1.5 rounded border hover:opacity-80 transition-opacity font-mono"
                  style={{ borderColor: theme.border, color: theme.dim }}
                >
                  {showOlderReleases
                    ? "▲ Collapse Prior Versions"
                    : "▼ View Prior Versions (v0.3.1, v0.3.0, v0.2.0, v0.1.6, v0.1.5, v0.1.4, v0.1.3, v0.1.2, v0.1.1)"}
                </button>
              </div>
            </div>
          </Card>

          {/* Day Trader Desk — Strategy Playbook & Time Machine Infographic */}
          <Card
            title="Day Trader Desk — Quantitative Strategy Playbook & Time Machine Infographic"
            theme={theme}
          >
            <div className="flex flex-col gap-6">
              <p
                className="text-sm sm:text-base lg:text-[17px] leading-relaxed"
                style={{ color: theme.dim }}
              >
                The <b style={{ color: theme.text }}>Day Trader Desk</b> scans{" "}
                <b style={{ color: theme.yellow }}>BTC/USDT</b> and{" "}
                <b style={{ color: theme.yellow }}>XAU/USDT (Gold)</b> across{" "}
                <span className="font-mono">5m · 15m · 1h · 4h</span> using six deterministic,
                zero-LLM mathematical setup detectors. Each setup calculates an ATR(14) &amp;
                structure-anchored Stop Loss, projects a configurable{" "}
                <span className="font-mono">1.5R / 2.0R / 3.0R</span> Take Profit, and evaluates
                statistical odds through the <b style={{ color: theme.text }}>Hybrid Time Machine</b>.
              </p>

              {/* 6-Strategy Visual Infographic Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {STRATEGY_PLAYBOOK.map((strat) => (
                  <div
                    key={strat.id}
                    className="rounded border p-4 sm:p-5 flex flex-col justify-between gap-4"
                    style={{ background: theme.bg, borderColor: theme.border }}
                  >
                    <div className="flex flex-col gap-3">
                      {/* Header Badge & Title */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded font-mono text-xs sm:text-[13px] font-bold"
                              style={{ background: `${theme.yellow}22`, color: theme.yellow }}
                            >
                              ƒx {strat.badge}
                            </span>
                            <span
                              className="font-bold text-base sm:text-[17px]"
                              style={{ color: theme.text }}
                            >
                              {strat.title}
                            </span>
                          </div>
                          <div
                            className="text-xs sm:text-sm mt-1"
                            style={{ color: theme.dim }}
                          >
                            {strat.subtitle}
                          </div>
                        </div>
                      </div>

                      {/* Bespoke SVG Price Action Schematic */}
                      <StrategySchematicSvg id={strat.id} theme={theme} />

                      {/* 3-Step Execution Phases */}
                      <ul className="flex flex-col gap-1.5 text-xs sm:text-sm leading-relaxed pt-1">
                        {strat.phases.map((p, idx) => (
                          <li key={idx} style={{ color: theme.text }}>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Footer Telemetry: Stop Rule, Regime & Quant Formula */}
                    <div
                      className="pt-3 border-t flex flex-col gap-2 font-mono"
                      style={{ borderColor: theme.border }}
                    >
                      <div className="flex flex-col gap-1 text-xs">
                        <div>
                          <span style={{ color: theme.red }}>STOP RULE: </span>
                          <span style={{ color: theme.dim }}>{strat.stopRule}</span>
                        </div>
                        <div>
                          <span style={{ color: theme.blue }}>BEST REGIME: </span>
                          <span style={{ color: theme.dim }}>{strat.regime}</span>
                        </div>
                      </div>

                      {/* LaTeX Formulation & Notation Guide Box */}
                      <div
                        className="rounded border p-2.5 sm:p-3 flex flex-col gap-2 mt-1"
                        style={{ background: theme.panel, borderColor: theme.border }}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider"
                            style={{ color: theme.yellow }}
                          >
                            <span>ƒx</span>
                            <span>QUANT TRIGGER SPECIFICATION</span>
                          </div>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded border"
                            style={{ borderColor: `${theme.border}80`, color: theme.dim }}
                          >
                            LaTeX / KaTeX
                          </span>
                        </div>

                        {/* Display Equation */}
                        <div
                          className="py-1.5 px-2 rounded overflow-x-auto text-center border"
                          style={{ background: theme.bg, borderColor: `${theme.border}60` }}
                        >
                          <LaTeXMath math={strat.formulaTex} block />
                        </div>

                        {/* Target & Stop Projection Equation */}
                        <div
                          className="pt-1.5 border-t flex flex-col gap-1 text-[11px]"
                          style={{ borderColor: `${theme.border}50` }}
                        >
                          <div className="flex items-center justify-between">
                            <span style={{ color: theme.dim }}>Projection &amp; Stop Formulation:</span>
                          </div>
                          <div
                            className="overflow-x-auto text-center py-1 px-2 rounded"
                            style={{ background: theme.bg }}
                          >
                            <LaTeXMath math={strat.targetRuleTex} block />
                          </div>
                        </div>

                        {/* Variable Breakdown */}
                        <div
                          className="pt-1.5 border-t flex flex-col gap-1.5"
                          style={{ borderColor: `${theme.border}50` }}
                        >
                          <div
                            className="text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: theme.blue }}
                          >
                            Formula Variable &amp; Notation Breakdown:
                          </div>
                          <div className="grid grid-cols-1 gap-1 text-xs">
                            {strat.variables.map((v, idx) => (
                              <div key={idx} className="flex items-baseline gap-2 leading-snug">
                                <span
                                  className="shrink-0 text-xs font-semibold"
                                  style={{ color: theme.yellow }}
                                >
                                  <LaTeXMath math={v.symbol} />
                                </span>
                                <span className="text-[11px] font-sans" style={{ color: theme.dim }}>
                                  {v.meaning}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Hybrid Time Machine 3-Pillar Infographic Banner */}
              <div
                className="rounded border p-4 sm:p-5 flex flex-col gap-4"
                style={{ background: theme.bg, borderColor: theme.border }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className="px-2.5 py-0.5 rounded font-mono text-xs sm:text-[13px] font-bold"
                      style={{ background: `${theme.green}22`, color: theme.green }}
                    >
                      HYBRID QUANT ENGINE
                    </span>
                    <span
                      className="font-bold text-sm sm:text-base uppercase tracking-wider"
                      style={{ color: theme.text }}
                    >
                      How the &ldquo;Time Machine&rdquo; Calculates Combined Win Odds
                    </span>
                  </div>
                  <span
                    className="font-mono text-xs sm:text-sm font-bold"
                    style={{ color: theme.yellow }}
                  >
                    45% Backtest · 30% Analogs · 25% Monte Carlo
                  </span>
                </div>

                {/* Master Composite Formulation Card */}
                <div
                  className="rounded border p-3.5 sm:p-4 flex flex-col gap-2.5 font-mono"
                  style={{ background: theme.panel, borderColor: theme.border }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{ background: `${theme.yellow}20`, color: theme.yellow }}
                      >
                        MASTER COMPOSITE FORMULATION
                      </span>
                      <span
                        className="text-xs sm:text-sm font-semibold uppercase tracking-wider font-sans"
                        style={{ color: theme.text }}
                      >
                        Combined Statistical Win Probability &amp; Expectancy
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: theme.dim }}>
                      Tri-Pillar Ensemble
                    </span>
                  </div>

                  <div
                    className="py-2.5 px-3 rounded overflow-x-auto text-center border"
                    style={{ background: theme.bg, borderColor: `${theme.border}80` }}
                  >
                    <LaTeXMath
                      math="P_{\text{win}}(\text{Setup}) \;=\; 0.45 \cdot \mathcal{W}_{\text{Backtest}} \;+\; 0.30 \cdot \mathcal{W}_{\text{Analogs}} \;+\; 0.25 \cdot \mathcal{W}_{\text{MonteCarlo}}"
                      block
                    />
                    <div
                      className="mt-1.5 pt-1.5 border-t border-dashed"
                      style={{ borderColor: `${theme.border}50` }}
                    >
                      <LaTeXMath
                        math="\mathbb{E}[R] \;=\; \left(P_{\text{win}} \cdot k\right) - \left((1 - P_{\text{win}}) \cdot 1.0\right), \quad k \in \{1.5\text{R}, 2.0\text{R}, 3.0\text{R}\}"
                        block
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-sans">
                    <div className="flex items-center gap-1.5" style={{ color: theme.dim }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: theme.yellow }} />
                      <span><strong className="font-mono" style={{ color: theme.yellow }}>0.45</strong> Empirical Strategy Backtest Weight</span>
                    </div>
                    <div className="flex items-center gap-1.5" style={{ color: theme.dim }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: theme.blue }} />
                      <span><strong className="font-mono" style={{ color: theme.blue }}>0.30</strong> 10-Bar Vector Euclidean Similarity</span>
                    </div>
                    <div className="flex items-center gap-1.5" style={{ color: theme.dim }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: theme.green }} />
                      <span><strong className="font-mono" style={{ color: theme.green }}>0.25</strong> Monte Carlo 2,500 Bootstrap Paths</span>
                    </div>
                  </div>
                </div>

                {/* 3 Pillar Cards with LaTeX Math & Explanations */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Pillar 1 */}
                  <div
                    className="p-3.5 sm:p-4 rounded border flex flex-col gap-2.5 justify-between font-mono"
                    style={{ background: theme.panel, borderColor: theme.border }}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="font-bold" style={{ color: theme.yellow }}>
                          1. STRATEGY BACKTEST
                        </span>
                        <span style={{ color: theme.dim }}>WEIGHT: 45%</span>
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed font-sans" style={{ color: theme.dim }}>
                        Replays strategy entry, stop, and take-profit rules bar-by-bar across historical candles over your selected horizon (<span className="font-mono">12b / 24b / 48b</span>) to evaluate whether Target or Stop was touched first.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t" style={{ borderColor: `${theme.border}60` }}>
                      <div className="text-[10px] font-semibold" style={{ color: theme.yellow }}>
                        EMPIRICAL WIN RATE &amp; PROFIT FACTOR:
                      </div>
                      <div className="py-1 px-2 rounded overflow-x-auto text-center border" style={{ background: theme.bg, borderColor: `${theme.border}50` }}>
                        <LaTeXMath
                          math="\mathcal{W}_{\text{Backtest}} = \frac{N_{\text{TP}}}{N_{\text{TP}} + N_{\text{SL}}}, \quad \text{PF} = \frac{\sum R_{\text{gains}}}{\sum R_{\text{losses}}}"
                          block
                        />
                      </div>
                      <div className="text-[10.5px] leading-tight font-sans" style={{ color: theme.dim }}>
                        Calculates cumulative-<LaTeXMath math="R" /> equity curve trajectory and expectancy.
                      </div>
                    </div>
                  </div>

                  {/* Pillar 2 */}
                  <div
                    className="p-3.5 sm:p-4 rounded border flex flex-col gap-2.5 justify-between font-mono"
                    style={{ background: theme.panel, borderColor: theme.border }}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="font-bold" style={{ color: theme.blue }}>
                          2. 10-BAR PATTERN ANALOGS
                        </span>
                        <span style={{ color: theme.dim }}>WEIGHT: 30%</span>
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed font-sans" style={{ color: theme.dim }}>
                        Normalizes the latest 10-candle price structure and RSI(14) into an 11-dimensional feature vector, scanning history via Euclidean distance to find the top 25 closest historical twins.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t" style={{ borderColor: `${theme.border}60` }}>
                      <div className="text-[10px] font-semibold" style={{ color: theme.blue }}>
                        EUCLIDEAN DISTANCE &amp; ANALOG WIN RATE:
                      </div>
                      <div className="py-1 px-2 rounded overflow-x-auto text-center border" style={{ background: theme.bg, borderColor: `${theme.border}50` }}>
                        <LaTeXMath
                          math="D(\mathbf{x}, \mathbf{y}) = \sqrt{\sum_{i=1}^{10} (\tilde{c}_i - \tilde{c}'_i)^2 + \omega \left(\frac{\Delta\text{RSI}_i}{100}\right)^2}"
                          block
                        />
                        <div className="pt-1 mt-0.5 border-t border-dashed" style={{ borderColor: `${theme.border}40` }}>
                          <LaTeXMath
                            math="\mathcal{W}_{\text{Analogs}} = \frac{1}{25}\sum_{j \in \mathcal{K}_{25}} \mathbf{1}_{\{\text{Target reached}\}}"
                            block
                          />
                        </div>
                      </div>
                      <div className="text-[10.5px] leading-tight font-sans" style={{ color: theme.dim }}>
                        <LaTeXMath math="\mathcal{K}_{25}" />: top 25 historical structural twins minimizing Euclidean distance.
                      </div>
                    </div>
                  </div>

                  {/* Pillar 3 */}
                  <div
                    className="p-3.5 sm:p-4 rounded border flex flex-col gap-2.5 justify-between font-mono"
                    style={{ background: theme.panel, borderColor: theme.border }}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="font-bold" style={{ color: theme.green }}>
                          3. MONTE CARLO (2,500 PATHS)
                        </span>
                        <span style={{ color: theme.dim }}>WEIGHT: 25%</span>
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed font-sans" style={{ color: theme.dim }}>
                        Resamples empirical returns and intrabar high/low wicks from the recent 120-bar volatility regime across 2,500 seeded forward paths to compute TP Hit %, SL Hit %, and P10/P50/P90 cones.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t" style={{ borderColor: `${theme.border}60` }}>
                      <div className="text-[10px] font-semibold" style={{ color: theme.green }}>
                        BOOTSTRAP RESAMPLING &amp; HIT PROBABILITY:
                      </div>
                      <div className="py-1 px-2 rounded overflow-x-auto text-center border" style={{ background: theme.bg, borderColor: `${theme.border}50` }}>
                        <LaTeXMath
                          math="S_{t+h}^{(m)} = S_t \cdot \prod_{k=1}^h (1 + r_{\tau_k}^{(m)}), \quad r_\tau \sim \operatorname{Bootstrap}\left(\{r\}_{t-120}^t\right)"
                          block
                        />
                        <div className="pt-1 mt-0.5 border-t border-dashed" style={{ borderColor: `${theme.border}40` }}>
                          <LaTeXMath
                            math="\mathcal{W}_{\text{MonteCarlo}} = \frac{1}{M}\sum_{m=1}^{M=2500} \mathbf{1}_{\{\text{TP Hit before SL}\}}"
                            block
                          />
                        </div>
                      </div>
                      <div className="text-[10.5px] leading-tight font-sans" style={{ color: theme.dim }}>
                        Simulates 2,500 paths to map empirical volatility cones (P10 / P50 / P90).
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Features Section */}
          <Card title="Terminal Features" theme={theme}>
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-2.5">
              {FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm sm:text-base leading-relaxed"
                >
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
              <ul className="flex flex-col gap-2.5">
                {STACK.map((s) => (
                  <li
                    key={s}
                    className="flex items-start gap-2.5 text-sm sm:text-base leading-relaxed"
                  >
                    <span className="shrink-0" style={{ color: theme.blue }}>
                      ▹
                    </span>
                    <span style={{ color: theme.text }}>{s}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Data Sources" theme={theme} className="lg:col-span-2">
              <ul className="flex flex-col gap-3">
                {SOURCES.map(([name, detail]) => (
                  <li
                    key={name}
                    className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-sm sm:text-base leading-snug"
                  >
                    <span
                      className="shrink-0 sm:w-56 uppercase tracking-wider text-xs sm:text-sm font-mono"
                      style={{ color: theme.dim }}
                    >
                      {name}
                    </span>
                    <span
                      className="hidden sm:block flex-1 h-px self-center"
                      style={{ background: theme.border }}
                    />
                    <span className="sm:text-right" style={{ color: theme.text }}>
                      {detail}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Footer */}
          <footer
            className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t text-sm sm:text-base pb-8"
            style={{ borderColor: theme.border, color: theme.dim }}
          >
            <span>YMC Terminal is free software, licensed under the GNU GPLv3.</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs sm:text-sm">YMC Terminal v0.3.2</span>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border px-3.5 py-1.5 hover:opacity-70 text-sm sm:text-base"
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
      className={`rounded flex flex-col gap-4 p-4 sm:p-5 lg:p-6 ${className}`}
      style={{ background: theme.panel, border: `1px solid ${theme.border}` }}
    >
      <h2
        className="text-xs sm:text-sm uppercase tracking-widest font-bold"
        style={{ color: theme.yellow }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function LaTeXMath({
  math,
  block = false,
  className = "",
  style = {},
}: {
  math: string;
  block?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  let html = "";
  try {
    html = katex.renderToString(math, {
      displayMode: block,
      throwOnError: false,
    });
  } catch {
    html = `<code class="font-mono text-xs">${math}</code>`;
  }

  return (
    <span
      className={`katex-wrapper ${block ? "block overflow-x-auto text-center" : "inline"} ${className}`}
      style={{ color: "inherit", ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function StrategySchematicSvg({
  id,
  theme,
}: {
  id: StrategyPlaybookItem["id"];
  theme: Theme;
}) {
  return (
    <div
      className="w-full rounded border px-2.5 py-2"
      style={{ background: theme.panel, borderColor: theme.border }}
    >
      <svg viewBox="0 0 240 76" className="w-full h-22 sm:h-24 overflow-visible font-mono">
        {id === "orb" && (
          <>
            {/* Opening Range Box */}
            <rect
              x={14}
              y={30}
              width={105}
              height={26}
              fill={`${theme.blue}15`}
              stroke={theme.blue}
              strokeDasharray="3 2"
              strokeWidth={1}
            />
            <text x={18} y={26} fontSize={7} fill={theme.blue}>
              OPENING RANGE HIGH
            </text>
            <text x={18} y={65} fontSize={7} fill={theme.red}>
              STOP LOSS (RANGE LOW)
            </text>
            {/* Consolidation path + breakout */}
            <polyline
              fill="none"
              stroke={theme.dim}
              strokeWidth={1.5}
              points="20,46 38,34 56,50 74,36 92,48 112,35"
            />
            <polyline
              fill="none"
              stroke={theme.green}
              strokeWidth={2}
              points="112,35 135,22 162,25 198,10"
            />
            <circle cx={126} cy={27} r={3} fill={theme.yellow} />
            <text x={134} y={36} fontSize={7.5} fontWeight="bold" fill={theme.green}>
              ORB BREAKOUT ▲ (+2R)
            </text>
          </>
        )}

        {id === "amd" && (
          <>
            {/* Phase 1: Accumulation Box */}
            <rect
              x={12}
              y={26}
              width={78}
              height={22}
              fill={`${theme.yellow}14`}
              stroke={theme.yellow}
              strokeDasharray="2 2"
              strokeWidth={1}
            />
            <text x={15} y={22} fontSize={6.8} fill={theme.yellow}>
              1. ACCUMULATION
            </text>
            {/* Phase 2: Manipulation Judas Swing below box */}
            <polyline
              fill="none"
              stroke={theme.dim}
              strokeWidth={1.4}
              points="18,38 35,30 52,44 70,32 86,42"
            />
            <polyline
              fill="none"
              stroke={theme.red}
              strokeWidth={1.8}
              points="86,42 104,64 118,46"
            />
            <circle cx={104} cy={64} r={2.5} fill={theme.red} />
            <text x={74} y={73} fontSize={6.8} fill={theme.red}>
              2. JUDAS SWEEP (SL)
            </text>
            {/* Phase 3: Distribution Reclaim */}
            <polyline
              fill="none"
              stroke={theme.green}
              strokeWidth={2.2}
              points="118,46 136,24 165,20 205,8"
            />
            <circle cx={128} cy={34} r={3} fill={theme.green} />
            <text x={135} y={42} fontSize={7} fontWeight="bold" fill={theme.green}>
              3. DISTRIBUTION ▲
            </text>
          </>
        )}

        {id === "squeeze" && (
          <>
            {/* Upper & Lower Bollinger Bands pinching into a squeeze */}
            <path
              d="M 12,14 Q 65,32 115,32 T 215,8"
              fill="none"
              stroke={theme.blue}
              strokeDasharray="2 2"
              strokeWidth={1.1}
            />
            <path
              d="M 12,62 Q 65,44 115,44 T 215,56"
              fill="none"
              stroke={theme.blue}
              strokeDasharray="2 2"
              strokeWidth={1.1}
            />
            <text x={55} y={25} fontSize={6.8} fill={theme.yellow}>
              BB SQUEEZE (P25)
            </text>
            <polyline
              fill="none"
              stroke={theme.dim}
              strokeWidth={1.4}
              points="16,42 44,35 72,41 98,37 120,38"
            />
            <polyline
              fill="none"
              stroke={theme.green}
              strokeWidth={2}
              points="120,38 148,22 178,16 212,9"
            />
            <circle cx={136} cy={29} r={3} fill={theme.yellow} />
            <text x={142} y={40} fontSize={7} fontWeight="bold" fill={theme.green}>
              EXPANSION ▲
            </text>
          </>
        )}

        {id === "mean_rev" && (
          <>
            {/* Outer Oversold Band Line */}
            <line
              x1={12}
              y1={56}
              x2={225}
              y2={56}
              stroke={theme.blue}
              strokeDasharray="3 2"
              strokeWidth={1}
            />
            <text x={14} y={66} fontSize={6.8} fill={theme.blue}>
              LOWER 2σ BAND + RSI &lt; 35
            </text>
            <polyline
              fill="none"
              stroke={theme.red}
              strokeWidth={1.6}
              points="18,18 52,32 84,48 112,63"
            />
            {/* Rejection Wick */}
            <line x1={112} y1={52} x2={112} y2={70} stroke={theme.green} strokeWidth={2} />
            <circle cx={112} cy={63} r={3} fill={theme.yellow} />
            <polyline
              fill="none"
              stroke={theme.green}
              strokeWidth={2}
              points="112,52 145,34 180,26 215,16"
            />
            <text x={124} y={48} fontSize={7} fontWeight="bold" fill={theme.green}>
              SNAPBACK ▲ (MEAN)
            </text>
          </>
        )}

        {id === "flag" && (
          <>
            {/* EMA 20 Rising Dynamic Support */}
            <line
              x1={15}
              y1={62}
              x2={220}
              y2={20}
              stroke={theme.yellow}
              strokeDasharray="3 2"
              strokeWidth={1.2}
            />
            <text x={150} y={42} fontSize={6.8} fill={theme.yellow}>
              EMA(20) &gt; EMA(50)
            </text>
            {/* Impulse -> Flag Pullback -> Resumption */}
            <polyline
              fill="none"
              stroke={theme.green}
              strokeWidth={1.8}
              points="18,60 55,34 85,18"
            />
            <polyline
              fill="none"
              stroke={theme.red}
              strokeWidth={1.5}
              points="85,18 102,28 118,38"
            />
            <polyline
              fill="none"
              stroke={theme.green}
              strokeWidth={2.2}
              points="118,38 148,20 182,14 214,6"
            />
            <circle cx={132} cy={29} r={3} fill={theme.green} />
            <text x={55} y={13} fontSize={7} fontWeight="bold" fill={theme.green}>
              BULL FLAG RESUMPTION ▲
            </text>
          </>
        )}

        {id === "sweep" && (
          <>
            {/* 15-Bar Swing Low Line */}
            <line
              x1={12}
              y1={48}
              x2={225}
              y2={48}
              stroke={theme.dim}
              strokeDasharray="3 2"
              strokeWidth={1.1}
            />
            <text x={16} y={43} fontSize={6.8} fill={theme.dim}>
              15-BAR SWING LOW LIQUIDITY POOL
            </text>
            <polyline
              fill="none"
              stroke={theme.dim}
              strokeWidth={1.5}
              points="18,26 48,48 78,32 106,44"
            />
            {/* Sweep below 48 and reclaim */}
            <polyline
              fill="none"
              stroke={theme.red}
              strokeWidth={1.8}
              points="106,44 124,66 136,42"
            />
            <circle cx={124} cy={66} r={2.8} fill={theme.red} />
            <text x={88} y={74} fontSize={6.8} fill={theme.red}>
              STOP-RUN WICK (SL)
            </text>
            <polyline
              fill="none"
              stroke={theme.green}
              strokeWidth={2.1}
              points="136,42 166,24 208,12"
            />
            <text x={144} y={36} fontSize={7} fontWeight="bold" fill={theme.green}>
              RECLAIM ▲
            </text>
          </>
        )}
      </svg>
    </div>
  );
}