# YMC Terminal — Project Plan

## Overview
A Bloomberg Terminal-style workstation curated for BTC/USDT and perpetual crypto
derivative pairs. Real-time multi-panel layout, exchange aggregation, custom
theming, drag-and-drop panels, technical indicators, and price alerts.

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 (CSS-first, no `tailwind.config.js`) + inline
  styles driven by `ThemeContext`
- **Charts:** lightweight-charts 5.2.1 (TradingView) — v5 series API (`addSeries`) + native sub-panes (`addPane`)
- **State:** React Context (`ThemeContext`), custom hooks (`useMultiExchangeData`, `useAlerts`)
- **Data:** Binance/Coinbase/OKX/Bybit WebSocket + Binance REST + static-klines +
  alternative.me (Fear & Greed) + biquote.io (Economic Calendar) + Multi-source RSS
- **Deployment:** Vercel (Production)

## Architecture

```
ymc-terminal/
├── app/
│   ├── layout.tsx              # Root layout, ThemeProvider wrapper
│   ├── page.tsx                # Grid layout, panel order (persisted), orchestration
│   ├── globals.css             # Base styles
│   ├── icon.svg                # Favicon
│   ├── about/page.tsx          # About page & documentation
│   └── api/
│       ├── klines/route.ts     # OHLCV: static-klines history + Binance gap-fill + live tick
│       ├── ticker/route.ts     # 24hr stats for MarketStats
│       ├── sentiment/route.ts  # Fear & Greed + funding rate + open interest + L/S ratio
│       ├── comparison/route.ts # Multi-symbol ticker + 24h sparklines (powers Watchlist & Heatmap)
│       ├── news/route.ts       # Multi-source RSS with keyword sentiment
│       ├── calendar/route.ts   # Keyless high-impact macro economic calendar
│       └── correlation/route.ts# BTC/ETH 30d rolling correlation
├── components/
│   ├── Panel.tsx               # Wrapper: drag grip + height/span
│   ├── CommandBar.tsx          # Top bar: logo, search, settings, clock
│   ├── Watchlist.tsx           # Left sidebar symbol list with inline 24h sparklines and sorting
│   ├── MarketStats.tsx         # 24hr strip (real ticker, mark price, basis spread, live/offline dot)
│   ├── PriceChart.tsx          # Candles/Heikin-Ashi/Line visuals, indicators, sub-panes, drawing tools, session H/L
│   ├── OrderBook.tsx           # Bid/ask ladder
│   ├── TradeTape.tsx           # Time & sales
│   ├── LiquidationsTape.tsx    # Live perpetual liquidation feed (!forceOrder@arr)
│   ├── AlertsPanel.tsx         # Price alerts (persisted)
│   ├── AlertNotification.tsx   # Toast for triggered alerts
│   ├── ExchangePanel.tsx       # Per-exchange prices, aggregation, spread
│   ├── MarketHeatmapPanel.tsx  # 24h volume-weighted crypto treemap status widget
│   ├── EconomicCalendarPanel.tsx # High-impact macro calendar events
│   ├── MarketSentimentPanel.tsx# F&G gauge, funding rates, countdown, OI, L/S ratio
│   ├── CorrelationPanel.tsx    # BTC/ETH correlation bars
│   ├── NewsFeedPanel.tsx       # News with bull/bear filter
│   ├── SettingsPanel.tsx       # Theme presets + color editor + reset layout
│   ├── HotkeysModal.tsx        # Bloomberg shortcut cheat sheet modal (?)
│   └── AssetIcon.tsx           # Vector coin logos, metallic bullion ingots, crude oil drum
├── context/
│   └── ThemeContext.tsx        # 15-color theme, presets, saved palettes
├── hooks/
│   ├── useMultiExchangeData.ts # Binance/Coinbase/OKX/Bybit sockets + candles
│   └── useAlerts.ts            # Alert evaluation, sound, persistence
├── lib/
│   ├── types.ts                # Candle, Trade, OrderBookEntry, WatchlistItem
│   ├── symbols.ts              # Label <-> exchange symbol mapping (GOLD/USDT -> PAXGUSDT)
│   ├── indicators.ts           # SMA, EMA, RSI, MACD, Bollinger Bands, Stoch RSI
│   ├── heikenAshi.ts           # Heikin Ashi OHLC smoothing calculation
│   ├── newsTags.ts             # Headline tagging (UNIVERSE assets + ETF/SEC/MACRO)
│   ├── dayLines.ts             # UTC day separators via a lightweight-charts series primitive
│   ├── bands.ts                # Shaded price band (RSI/Stoch RSI neutral zone), series primitive
│   ├── drawings.ts             # Level / trend / box / ruler drawings + live draft, series primitive
│   └── links.ts                # Canonical repository links
└── package.json
```

## Current Features
- Multi-panel terminal layout (watchlist, chart, order book, trade tape, stats, heatmap, calendar, alerts)
- Multi-exchange WebSocket data (Binance, Coinbase, OKX, Bybit) with price aggregation
- Historical candle data via static-klines + Binance REST, live kline updates via WebSocket
- Candlestick chart with 8 working timeframes (1m, 5m, 15m, 30m, 1h, 2h, 4h, 1d), default 1h
- Chart symbol switching across 12 pairs (BTC, ETH, SOL, XRP, BNB, DOGE, SUI, AVAX, LINK, XAU, XAG, OIL), each refitted on change
- Chart visuals dropdown: instant toggle between standard Candlesticks, smoothed Heikin Ashi trend bars, and continuous Line chart (persisted)
- 24H and Previous Day High / Low watermark lines (H/L toggle with right-scale auto-fit)
- Delta ruler measurement tool (📐 Ruler) for price difference, percentage change, and bar counts
- High-resolution chart snapshot (📷 Snap PNG) and full historical OHLCV export (⬇ CSV)
- Panel Maximize / Solo Focus mode (`f` key or `⤢` panel header icon)
- Command bar action parser (`BTC 15M`, `ALERT 75000`, `THEME MATRIX`, `CLEAR`, `FULL`, `GRID`)
- Volume bars with toggle
- Technical indicators: SMA 20/50, EMA 20/50, Bollinger (20,2), RSI (14), MACD (12,26,9), Stoch RSI (14,14,3,3)
- RSI and MACD render in their own sub-panes below the price chart (lightweight-charts
  v5 native panes) with independent right-side value scales and a draggable divider
  to resize them; the crosshair and time axis are shared with the main chart. RSI and
  Stoch RSI are pinned to a 0–100 scale, with dashed 70/50/30 and 80/20 reference lines
  and the zone between those limits shaded (translucent `PriceBandPrimitive`).
- Drawing tools: level lines, trendlines, and boxes, drawn by drag with a live
  preview; persisted per symbol (localStorage), clear-all, Esc to cancel. Click a
  drawing to select it (hover highlights, cursor becomes a pointer), then delete
  it individually via the ✕ handle on the drawing, the toolbar's ✕ Delete button,
  or the Delete/Backspace key; click empty space to deselect.
- Magnet mode (🧲 toggle): snaps the crosshair and drawing anchors to the nearest
  OHLC value of the hovered candle; off restores free, pixel-accurate movement.
- Broker-style broken UTC day separators (DAY toggle) rendered between candles
- Order book with depth visualization
- Trade tape with buy/sell coloring
- Real-time perpetual liquidation bursts tape (`LiquidationsTape`)
- Price alerts with sound notifications (toggle + volume, persisted)
- Exchange price comparison panel with spread
- Watchlist with inline 24h trend sparklines, notional quote volume, and 1-click sorting (Gainers, Losers, Volume, A-Z)
- Crypto Market Heatmap: 24h volume-weighted squarified treemap widget with 1-click chart selection
- Market sentiment panel (F&G gauge, funding rates, countdown, OI, Global Long/Short account ratio)
- Correlation panel (BTC/ETH real; BTC/SPX/DXY/Gold placeholders)
- News feed with bull/bear sentiment filter
- Drag-and-drop panel reordering (persisted)
- Command bar with keyboard shortcuts (`/` to focus, `Esc` to clear, `?` for cheat sheet modal)
- Theme customization: 15 presets + saved palettes + fine-tuning editor (15 fields) + layout reset
- Dark terminal aesthetic; single-column responsive layout below 900px

## API Services

| Service | Provider | Used For | Endpoint |
|---------|----------|----------|----------|
| Binance WebSocket | Binance | Trades, order book, klines | `wss://stream.binance.com:9443/ws` |
| Coinbase WebSocket | Coinbase | Trades (price aggregate) | `wss://ws-feed.exchange.coinbase.com` |
| OKX WebSocket | OKX | Trades (price aggregate) | `wss://ws.okx.com:8443/ws/v5/public` |
| Bybit WebSocket | Bybit | Trades (price aggregate) | `wss://stream.bybit.com/v5/public/spot` |
| Binance Futures WebSocket | Binance Futures | Real-time liquidation bursts | `wss://fstream.binance.com/ws/!forceOrder@arr` |
| Binance REST API | Binance | Klines (fill/live), 24hr ticker, funding rate, open interest, L/S ratio | `api.binance.com/api/v3/` + `fapi.binance.com/fapi/v1/` + `fapi.binance.com/futures/data/` |
| Fear & Greed Index | alternative.me | Market sentiment gauge | `api.alternative.me/fng/` |
| Economic Calendar | biquote.io | High-impact global macroeconomic calendar | `biquote.io/api/calendar` |
| RSS news (6 feeds) | CoinDesk, CoinTelegraph, The Block, Decrypt, Bitcoin Magazine, CNBC | Crypto + macro headlines | per-feed URLs in `app/api/news/route.ts` |
| static-klines | GitHub Pages | Full historical OHLCV (2010–present) | `finom.github.io/static-klines/api/klines/` |

No API keys required — all endpoints are free and public.

## Data Flow
```
Binance/Coinbase/OKX/Bybit WebSocket → useMultiExchangeData → page.tsx → components
Binance REST / static-klines          → /api/klines          → PriceChart (candles)
                                                                    ↓
ThemeContext → all components (via useTheme hook)
useAlerts    → price monitoring → AlertNotification (toast)
```

## Future Roadmap

### Phase 1: Real Data Integration ✅
- [x] WebSocket connection to Binance for live BTC/USDT data
- [x] Replace mock generators with real-time data pipeline
- [x] Add multiple exchange support with aggregation (Binance, Coinbase, OKX, Bybit)

### Phase 2: Enhanced Charting ✅
- [x] Working timeframe selector (1m, 5m, 15m, 1h, 4h, 1d)
- [x] Technical indicators (SMA, EMA, Bollinger Bands, RSI, Stoch RSI, MACD)
- [x] Drawing tools (horizontal levels, trendlines, boxes)
- [x] Volume bars
- [x] UTC day separators

### Phase 3: Analytics & Alerts ✅
- [x] Price alerts (visual + sound notifications)
- [x] Market sentiment indicators (F&G gauge, funding rates, OI)
- [x] Correlation with other assets (BTC/ETH real; BTC/SPX/DXY/Gold placeholder)

### Phase 4: Advanced Features ✅
- [x] Multi-symbol comparison view
- [x] News feed integration (CoinDesk RSS)
- [x] Custom layout (drag-and-drop panels)
- [x] Multiple saved themes (named, persisted, deletable)

### Phase 5: Polish ✅
- [x] Sound effects for alerts — on/off toggle, volume slider, autoplay handling
- [x] Multiple saved themes — named palettes, persisted, deletable
- [x] Responsive design — single-column layout below 900px
- [x] Performance optimization — socket ticks throttled to 1Hz, panels memoized
- [x] Favicon (`app/icon.svg`)
- [x] Chart viewport refit + container resize handling on symbol/timeframe change
- [x] High-impact economic calendar panel (`components/EconomicCalendarPanel.tsx`)

### Phase 6: Update Phase (Perpetuals & UI/UX Evolution) 🚀
> Full blueprint and specifications documented in [`UPDATE_PHASE.md`](./UPDATE_PHASE.md).

- **Perpetual Derivatives Deep-Dive:**
  - Dynamic symbol funding rate & open interest (active pair reactive)
  - 8-hour funding settlement countdown timer & annualized APR display
  - Real-time perpetual liquidation bursts tape (`wss://fstream.binance.com/ws/!forceOrder@arr`)
  - Global Long/Short account ratio widget
  - Mark Price vs. Spot Price basis spread indicator
- **Bloomberg UI/UX & Information Density:**
  - Keyboard hotkeys (`?` cheat sheet modal, `1`–`6` symbol select, `[`/`]` timeframes, `v`/`d`/`m` toggles)
  - Command bar action parser (`BTC 15M`, `ALERT 75K`, `THEME MATRIX`)
  - Panel maximize / solo focus mode (`⤢` button / `f` key)
  - Chart percentage & delta measurement tool (Ruler)
  - Chart image snapshot (PNG) and candle data export (CSV)
- **Architecture & Streaming Performance:**
  - Decouple high-frequency WebSocket ticks from root `page.tsx` state to avoid full-tree reconciliation
  - Autoplay audio policy status & test sound button in Settings/Alerts
  - Watchlist filtering & top-volume perpetual pairs expansion

## Recommendations / Potential Updates
Deferred rather than abandoned. Ordered roughly by value per unit of effort. See [`UPDATE_PHASE.md`](./UPDATE_PHASE.md) for full breakdown.

### High value, low effort
- **Keyboard shortcuts.** `/` and `Esc` already work. Next: `1`–`6` to switch
  symbol, `[`/`]` for timeframe, `d` for DAY lines, `v` for volume, `g` for grid.
  Pure client work, no new dependencies.
- **CSV export.** Serialize the loaded candles and trigger a download. The data
  is already in memory, so this is a ~20-line addition to PriceChart.

### High value, higher effort
- **Render isolation.** Every websocket tick currently re-renders the whole tree
  from `page.tsx`. Lifting socket state into a store with selective subscriptions
  would cut this to the two panels that actually display price.

### Medium value
- **Portfolio tracker.** Static holdings entered by the user, valued against the
  live prices already being streamed. No new data source required.
- **Virtualized lists.** TradeTape and OrderBook render ~50 rows each; fine now,
  worth revisiting if the trade tape is extended to several hundred.

### Lower priority
- **TradFi correlation.** BTC/SPX/DXY/Gold currently show placeholders. Needs a
  paid TradFi feed, so only worth it if that data is actually wanted.
- **Order book depth heatmap.** Nice, but costly to render and low practical value
  at this size.

## Design Principles
- **Terminal aesthetic:** Dark background, monospace font, high information density
- **Keyboard-first:** Bloomberg-style command bar, shortcut-driven navigation
- **Real-time:** Sub-second updates, visual feedback on price changes
- **Customizable:** User-controlled color scheme
- **Performance:** Minimal re-renders, efficient data updates

## Notes
- All components use `useTheme()` — no hardcoded Tailwind color classes
- One WebSocket authority per data type: Binance drives the order book; all four
  feeds supply the price aggregate
- Never invent fallback data: a downed feed shows the last real value plus a
  disconnected indicator
- lightweight-charts recreates on theme change so new candle colors apply
- RSI/MACD sub-panes are created with `addPane(true)` so they keep a user-resized
  height; series are rebuilt only when the indicator set or theme changes, never on
  a data tick
- Default timeframe is 1h
- localStorage keys: `btc-terminal:theme`, `btc-terminal:themes`,
  `btc-terminal:alerts`, `btc-terminal:alert-prefs`, `btc-terminal:panel-order`,
  `btc-terminal:drawings`, `btc-terminal:chart-type`, `btc-terminal:session-hl`
