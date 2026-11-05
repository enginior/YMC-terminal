# YMC Terminal

A **Bloomberg Terminal–style** trading workstation curated for BTC/USDT and
perpetual crypto derivative pairs. It streams live prices from multiple exchanges,
renders a TradingView-grade candlestick chart with technical indicators and
drawing tools, and surrounds it with the telemetry a trader actively glances at:
order book, trade tape, 24h stats, exchange comparison, sentiment, economic calendar,
market sessions, multi-source news, and price alerts.

Live in production on Vercel: [github.com/enginior/YMC-terminal](https://github.com/enginior/YMC-terminal)

Originally built to demonstrate what a dense, real-time trading UI looks like on the modern
React/Next.js stack. No API keys, no paid feeds — every data source is free and public.

> Not financial advice. This is a data-display tool, not a trading system —
> there is no order entry and no wallet integration.

## Features

### Live market data
- **Unified exchange feed routing** — Selectable authority feed (`BINANCE | BYBIT | OKX`) syncing 24h ticker stats, PriceChart candles, L2 order book, and live time & sales tape with 100% price synchronization.
- **Candlesticks** — full history from static-klines (back to 2010), gap-filled from Binance / Bybit / OKX REST, with the current bar updated live over WebSockets.
- **Timeframes** — `1m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `1d` (default `1h`).
- **Twelve pairs** — BTC, ETH, SOL, XRP, BNB, DOGE, SUI, AVAX, LINK, XAU (Gold), XAG (Silver), and OIL (Crude Oil) with bespoke vector coin logos and metallic bullion badges.
- **Order book** with depth visualization, a **trade tape** colour-coded by side, and a real-time **perpetual liquidations tape** (`!forceOrder@arr`).

### Day Trader Desk & Quantitative Engine
- **Tactical setup scanner** — Focused multi-timeframe scanner for BTC/USDT and Gold (XAU/USDT) across 5m, 15m, 1h, and 4h intervals.
- **6 Pine-style deterministic setup detectors**:
  1. *Opening Range Breakout (ORB)*: Session killzone expansion with relative volume confirmation.
  2. *ICT AMD (Power of 3)*: Accumulation box $\to$ Judas Swing manipulation sweep $\to$ distribution displacement.
  3. *Bollinger Volatility Squeeze (SQZ)*: 25th-percentile bandwidth coiling $\to$ 2σ band expansion with MACD ignition.
  4. *Mean-Reversion Extremes (MRV)*: Outer 2σ band touch + RSI(14) / Stoch RSI exhaustion + 35% rejection wick.
  5. *Trend Pullback Flag (FLG)*: EMA(20) dynamic value zone continuation in stacked directional trends.
  6. *Liquidity Sweep Reversal (SWP)*: 15-bar structural swing low/high stop-raid & failed auction reclaim.
- **1-Click chart plotting & TP/SL arming** — Projects Long/Short Risk-Reward boxes directly onto PriceChart and arms Take Profit and Stop Loss alerts in one click.
- **Hybrid Time Machine Simulator (3-pillar quant engine)**:
  - *Strategy Backtester (45% weight)*: Evaluates win rate, profit factor, expectancy ($\mathbb{E}[R]$), and cumulative-$R$ equity curve over 12b / 24b / 48b horizons.
  - *10-Bar Pattern Analogs (30% weight)*: Normalizes 10-bar price and RSI into an 11-dimensional feature vector, finding the top 25 closest Euclidean twins.
  - *Monte Carlo Bootstrap (25% weight)*: Simulates 2,500 forward paths by resampling empirical returns and intrabar wicks to project TP/SL hit rates and P10 / P50 / P90 volatility cones.
  - *Master Bayesian Formulation*: $P_{\text{win}} = 0.45 \cdot \mathcal{W}_{\text{Backtest}} + 0.30 \cdot \mathcal{W}_{\text{Analogs}} + 0.25 \cdot \mathcal{W}_{\text{MonteCarlo}}$.

### Charting
- **Visual styles** — dropdown selector with instant switching between standard **Candlesticks** (OHLC), smoothed **Heikin Ashi** trend bars, and continuous **Line** chart (persisted).
- **Free-floating crosshair & OHLC magnet** — TradingView-style cursor where perpendicular horizontal price and vertical time axis lines float smoothly across the canvas without automatically sticking to candle wicks; 🧲 toggle activates `CrosshairMode.MagnetOHLC` for pixel-perfect anchor snapping to candle Open/High/Low/Close.
- **Session key levels** — `24H HI` (green dashed), `24H LO` (red dashed), `PREV HI` (cyan dotted), and `PREV LO` (amber dotted) watermark lines with auto-fit price scale (`H/L` toggle).
- **Measurement & export** — delta ruler tool (📐 Ruler) for measuring price change, percentage, and bar count; 📷 Snap for PNG screenshot and ⬇ CSV for full historical OHLCV download.
- **Overlays** — SMA 20/50, EMA 20/50, Bollinger Bands (20, 2).
- **Sub-panes** — RSI (14), MACD (12, 26, 9), Stochastic RSI (14, 14, 3, 3), Open Interest (OI in $B/$M), Funding Rate (8h histograms with 0.00% line), and Cumulative Volume Delta (CVD continuous oscillator), each in its own native sub-pane with independent right scale and draggable dividers.
- **Drawing tools (11 tools)** — Trendline, Extended Ray, Horizontal Ray, Horizontal Level, Arrow, Fibonacci Retracement (golden pocket shading), Parallel Channel, Long/Short Position tools with R:R, Rectangle/Box, and Delta Ruler. Includes floating properties toolbar (1-3px stroke, solid/dashed/dotted, 10 colors, lock, delete), anchor dragging, and 50-step undo/redo history engine (`Ctrl+Z` / `Ctrl+Y`).

### Analysis panels
- **Market stats** — 24h change, high/low, volume, mark price, basis spread from live exchange tickers.
- **Watchlist** — compact symbol list with inline 24h trend sparklines, notional quote volume, and 1-click sorting (Gainers, Losers, Volume, Alphabetical).
- **Crypto Market Heatmap** — S&P 500 / Finviz / Coin360 style squarified treemap widget sized by 24h volume with high-contrast performance heat gradients and 1-click chart selection.
- **Exchange comparison** — per-venue price, aggregated mid, and spread across Binance, Coinbase, OKX, and Bybit.
- **Market sentiment** — Fear & Greed gauge, funding rates, 8h funding settlement countdown, annualized APR, open interest, and Global Long/Short account ratio.
- **Economic Calendar** — macroeconomic events with high/medium impact toggle, dynamic currency filtering, previous/forecast/actual prints, and importance dots.
- **Market Sessions** — Forex Factory-style 24-hour visual horizontal timeline showing global trading hours (Sydney, Tokyo, London, New York) with live NOW beacon line, automatic two-pass IANA timezone conversion, wrap-around segments, DST adjustment, TSE lunch break, UTC offset display, and Equities (Cash Bell) vs Forex modes.
- **News** — multi-source headlines (CoinDesk, CoinTelegraph, The Block, Decrypt, Bitcoin Magazine, CNBC) with bull/bear sentiment filter, asset tagging, and a 1-click active-symbol filter.

### Alerts, Audio Telemetry & Theming
- **Price alerts with voice telemetry** — above/below price thresholds with audio notifications. Armed trade alerts (e.g. from Day Trader Desk TP/SL) trigger an authentic **"Order filled"** voice sound pre-decoded into memory via `AudioContext.decodeAudioData` for zero latency; standard alerts play the synthesizer chime. Includes live audio preview test button, active alert Armed toggles, and visual notification banners.
- **Collapsible panels & layout density** — quick collapse controls for secondary panels (OrderBook, TradeTape, Sentiment, Alerts) to maximize chart space, plus 50/50 split-screen maximize for deep analytics.
- **Theming** — 15 preset palettes, saved named palettes, and a fine-tuning editor covering 15 colour fields. Everything is theme-driven; persistence is handled via `localStorage`.
- **Background tab throttling** — intelligent visibility polling (`useVisibilityPolling`) pauses REST polling when the browser tab is hidden to conserve CPU and network, with instant hydration on focus.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| Charts | lightweight-charts 5.2.1 (TradingView) — v5 series API + native panes |
| Styling | Tailwind CSS v4 (CSS-first) + inline styles driven by `ThemeContext` |
| State | React Context (`ThemeContext`) + custom hooks |
| Data | Binance/Coinbase/OKX/Bybit WebSocket + Binance REST + static-klines + alternative.me + CoinDesk RSS |

## Getting started

**Prerequisites:** Node.js 20.9 or later.

```bash
# install dependencies
npm install

# start the dev server (http://localhost:3030)
npm run dev
```

The app runs on port **3030**.

```bash
npm run typecheck # type-check TypeScript without building (tsc --noEmit)
npm run test      # run unit test suite with Vitest (vitest run)
npm run build     # production build (also type-checks)
npm run start     # serve the production build on port 3030
```

## Using it

- **Switch pairs** from the **Watchlist** on the left, click tiles in the **Market Heatmap**, or press `1`–`9` and `0`.
- **Change timeframe** with the buttons above the chart or `[` / `]`.
- **Chart Visuals** — toggle between **Candles**, smoothed **Heikin Ashi**, and continuous **Line** from the visual selector dropdown.
- **Session Key Levels** — toggle **H/L** to display `24H HI`/`LO` and `PREV HI`/`LO` session watermark lines with auto-fit scaling.
- **Measure delta** — activate **📐 Ruler** (or hold `Shift` + click) to measure price difference, percentage delta, and bar counts.
- **Export & Snap** — click **📷 Snap** to download a high-res PNG chart screenshot, or **⬇ CSV** for historical OHLCV data.
- **Add indicators** via the **Indicators** menu — overlay entries land on the
  price chart, sub-pane entries (RSI, MACD, Stoch RSI) open their own pane.
  Drag the pane divider to resize.
- **Draw** with the level / trend / box tools in the chart toolbar; press `Esc`
  to cancel an in-progress drawing.
- **Magnet** (🧲) snaps to OHLC; **VOL** and **DAY** toggle volume and day lines.
- **Maximize panel** into focus mode with `f` or the `⤢` button on any panel header.
- **Alerts** — set a symbol, condition and price in the Alerts panel.
- **Themes** — open Settings from the command bar to pick a preset, customize colors, or reset the layout.
- **Command bar** — the top bar shows the clock, search, and action parser (`/` to
  focus, `Esc` to clear, `?` for the Bloomberg keyboard cheat sheet modal). Supports action syntax: `BTC 15M`, `ALERT 75000`, `THEME MATRIX`, `CLEAR`, `FULL`.

## Project structure

```
app/         Next.js routes, layout, global styles, and the /api route handlers
components/  UI panels (chart, watchlist, heatmap, order book, alerts, settings, ...)
context/     ThemeContext — colours, presets, saved palettes
hooks/       useMultiExchangeData (sockets, candles, universe tickers), useAlerts (per-symbol, sound, desktop)
lib/         indicators, heikenAshi, symbol mapping, chart series primitives, types
```

See [`PROJECT.md`](./PROJECT.md) for architecture and roadmap,
[`UPDATE_PHASE.md`](./UPDATE_PHASE.md) for the upcoming features and UI/UX blueprint,
and [`AGENTS.md`](./AGENTS.md) for conventions and hard-won constraints.

## Data sources

All free and public — **no API keys required**.

| Provider | Used for |
|----------|----------|
| Binance WebSocket | Trades, order book, live klines |
| Binance Futures WebSocket | Real-time perpetual liquidation bursts (`!forceOrder@arr`) |
| Coinbase / OKX / Bybit WebSocket | Trades (price aggregation) |
| Binance REST (Spot & Futures) | Klines (fill + live), 24hr ticker, funding rate, open interest, L/S ratio |
| static-klines (GitHub Pages) | Full historical OHLCV |
| alternative.me | Fear & Greed Index |
| biquote.io | High-impact global economic calendar |
| Multi-Source RSS (CoinDesk, CT, Block, Decrypt, etc.) | News headlines |

## Persistence

State is kept in `localStorage` under these keys:

`btc-terminal:theme`, `btc-terminal:themes`, `btc-terminal:alerts`,
`btc-terminal:alert-prefs`, `btc-terminal:panel-order`, `btc-terminal:drawings`,
`btc-terminal:chart-type`, `btc-terminal:session-hl`, `btc-terminal:calendar-filters`,
`btc-terminal:sessions-prefs`
(plus opt-in read-only `btc-terminal:debug-renders`)

## Known limitations

- static-klines refreshes once a day at 00:00 UTC; the tail is backfilled from
  Binance REST.
- `1m`/`5m` have no static archive, so history is Binance-only (~2–14 days).
- The RSI/Stoch RSI panes are pinned to a 0–100 scale; MACD autoscales.

## License

Released under the [GNU General Public License v3.0](LICENSE) (GPL-3.0-or-later).
You are free to use, study, share and modify the software, provided derivative
works are distributed under the same license.
