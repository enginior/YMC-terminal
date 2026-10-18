# YMC Terminal

A **Bloomberg Terminal–style** trading workstation curated for BTC/USDT and
perpetual crypto derivative pairs. It streams live prices from multiple exchanges,
renders a TradingView-grade candlestick chart with technical indicators and
drawing tools, and surrounds it with the telemetry a trader actively glances at:
order book, trade tape, 24h stats, exchange comparison, sentiment, economic calendar,
correlation, multi-source news, and price alerts.

Live in production on Vercel: [github.com/enginior/YMC-terminal](https://github.com/enginior/YMC-terminal)

Originally built to demonstrate what a dense, real-time trading UI looks like on the modern
React/Next.js stack. No API keys, no paid feeds — every data source is free and public.

> Not financial advice. This is a data-display tool, not a trading system —
> there is no order entry and no wallet integration.

## Features

### Live market data
- **Four exchanges over WebSocket** — Binance, Coinbase, OKX and Bybit — with
  price aggregation and a live/offline connection indicator.
- **Candlesticks** — full history from static-klines (back to 2010), gap-filled
  from Binance REST, with the current bar updated live over the Binance kline
  stream.
- **Timeframes** — `1m`, `5m`, `15m`, `1h`, `4h`, `1d` (default `1h`).
- **Six pairs** — BTC, ETH, SOL, XRP, BNB and GOLD (GOLD maps to PAXG/USDT, the
  tokenized gold pair).
- **Order book** with depth visualization, and a **trade tape** colour-coded by
  side.

### Charting
- **Overlays** — SMA 20/50, EMA 20/50, Bollinger Bands (20, 2).
- **Sub-panes** — RSI (14), MACD (12, 26, 9) and Stochastic RSI (14, 14, 3, 3),
  each in its own pane below the price chart with an independent right-side value
  scale and a **draggable divider** to resize it. The crosshair and time axis are
  shared with the main chart.
- **Reference lines & bands** — RSI shows dashed 70/50/30, Stoch RSI shows dashed
  80/20, and the neutral zone between the limits is shaded.
- **Volume** bars and **UTC day separators** (both toggleable).
- **Drawing tools** — horizontal levels, trendlines and boxes, drawn by dragging
  with a live preview. Drawings are persisted per symbol. Hover to highlight,
  click to select, then delete via the on-drawing ✕ handle, the toolbar's
  **✕ Delete** button, or the `Delete`/`Backspace` key.
- **Magnet mode** — snaps the crosshair and drawing anchors to the nearest
  open/high/low/close of the hovered candle.

### Analysis panels
- **Market stats** — 24h change, high/low, volume from the Binance ticker.
- **Exchange comparison** — per-venue price, aggregated mid, and spread.
- **Multi-symbol comparison** — sparklines across the tracked pairs.
- **Market sentiment** — Fear & Greed gauge, funding rate and open interest.
- **Economic Calendar** — high-impact macroeconomic events (Fed, CPI, NFP, interest rate decisions) with previous, forecast, and actual prints.
- **Correlation** — BTC/ETH 30-day rolling correlation (BTC/SPX, DXY and Gold are
  placeholders pending a TradFi feed).
- **News** — multi-source headlines (CoinDesk, CoinTelegraph, The Block, Decrypt, Bitcoin Magazine, CNBC) with bull/bear sentiment filter.

### Alerts & theming
- **Price alerts** — above/below thresholds with a sound notification (on/off
  toggle and volume slider). Alerts and preferences persist across reloads.
- **Theming** — 15 preset palettes, saved named palettes, and a fine-tuning
  editor covering 15 colour fields. Everything is theme-driven; persistence is
  handled via `localStorage`.
- **Layout** — drag panels to reorder; the order is persisted. Collapses to a
  single column below 900px.

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
npm run build   # production build (also type-checks)
npm run start   # serve the production build on port 3030
```

> `npm run lint` is currently broken: Next 16 removed `next lint` and no ESLint
> config ships with the project. Use `npm run build` for type-checking.

## Using it

- **Switch pairs** from the **Watchlist** on the left.
- **Change timeframe** with the buttons above the chart.
- **Add indicators** via the **Indicators** menu — overlay entries land on the
  price chart, sub-pane entries (RSI, MACD, Stoch RSI) open their own pane.
  Drag the pane divider to resize.
- **Draw** with the level / trend / box tools in the chart toolbar; press `Esc`
  to cancel an in-progress drawing.
- **Magnet** (🧲) snaps to OHLC; **VOL** and **DAY** toggle volume and day lines.
- **Alerts** — set a symbol, condition and price in the Alerts panel.
- **Themes** — open Settings from the command bar to pick a preset or edit
  colours.
- **Command bar** — the top bar shows the clock and a search field (`/` to
  focus, `Esc` to clear).

## Project structure

```
app/         Next.js routes, layout, global styles, and the /api route handlers
components/  UI panels (chart, watchlist, order book, alerts, settings, ...)
context/     ThemeContext — colours, presets, saved palettes
hooks/       useMultiExchangeData (sockets + candles), useAlerts
lib/         indicators, symbol mapping, chart series primitives, types
```

See [`PROJECT.md`](./PROJECT.md) for architecture and roadmap,
[`UPDATE_PHASE.md`](./UPDATE_PHASE.md) for the upcoming features and UI/UX blueprint,
and [`AGENTS.md`](./AGENTS.md) for conventions and hard-won constraints.

## Data sources

All free and public — **no API keys required**.

| Provider | Used for |
|----------|----------|
| Binance WebSocket | Trades, order book, live klines |
| Coinbase / OKX / Bybit WebSocket | Trades (price aggregation) |
| Binance REST | Klines (fill + live), 24h ticker, funding rate, open interest |
| static-klines (GitHub Pages) | Full historical OHLCV |
| alternative.me | Fear & Greed Index |
| biquote.io | High-impact global economic calendar |
| Multi-Source RSS (CoinDesk, CT, Block, Decrypt, etc.) | News headlines |

## Persistence

State is kept in `localStorage` under these keys:

`btc-terminal:theme`, `btc-terminal:themes`, `btc-terminal:alerts`,
`btc-terminal:alert-prefs`, `btc-terminal:panel-order`, `btc-terminal:drawings`

## Known limitations

- BTC/SPX, DXY and Gold correlation are placeholders (need a premium TradFi feed).
- static-klines refreshes once a day at 00:00 UTC; the tail is backfilled from
  Binance REST.
- `1m`/`5m` have no static archive, so history is Binance-only (~2–14 days).
- The RSI/Stoch RSI panes are pinned to a 0–100 scale; MACD autoscales.

## License

Released under the [GNU General Public License v3.0](LICENSE) (GPL-3.0-or-later).
You are free to use, study, share and modify the software, provided derivative
works are distributed under the same license.
