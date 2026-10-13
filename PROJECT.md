# BTC Terminal — Project Plan

## Overview
A simplified Bloomberg Terminal-style dashboard for BTC/USDT and a handful of
other crypto pairs. Real-time multi-panel layout, exchange aggregation, custom
theming, drag-and-drop panels, technical indicators, and alerts.

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 (CSS-first, no `tailwind.config.js`) + inline
  styles driven by `ThemeContext`
- **Charts:** lightweight-charts 5.2.1 (TradingView) — v5 series API (`addSeries`) + native sub-panes (`addPane`)
- **State:** React Context (`ThemeContext`), custom hooks (`useMultiExchangeData`, `useAlerts`)
- **Data:** Binance/Coinbase/OKX/Bybit WebSocket + Binance REST + static-klines +
  alternative.me (Fear & Greed) + CoinDesk RSS

## Architecture

```
AI_fintech/
├── app/
│   ├── layout.tsx              # Root layout, ThemeProvider wrapper
│   ├── page.tsx                # Grid layout, panel order (persisted), orchestration
│   ├── globals.css             # Base styles
│   ├── icon.svg                # Favicon
│   └── api/
│       ├── klines/route.ts     # OHLCV: static-klines history + Binance gap-fill + live tick
│       ├── ticker/route.ts     # 24hr stats for MarketStats
│       ├── sentiment/route.ts  # Fear & Greed + funding rate + open interest
│       ├── comparison/route.ts # Multi-symbol ticker + sparklines
│       ├── news/route.ts       # CoinDesk RSS with keyword sentiment
│       └── correlation/route.ts# BTC/ETH 30d rolling correlation
├── components/
│   ├── Panel.tsx               # Wrapper: drag grip + height/span
│   ├── CommandBar.tsx          # Top bar: logo, search, settings, clock
│   ├── Watchlist.tsx           # Left sidebar symbol list
│   ├── MarketStats.tsx         # 24hr strip (real ticker, live/offline dot)
│   ├── PriceChart.tsx          # Candles, volume, indicator sub-panes, drawing tools
│   ├── OrderBook.tsx           # Bid/ask ladder
│   ├── TradeTape.tsx           # Time & sales
│   ├── AlertsPanel.tsx         # Price alerts (persisted)
│   ├── AlertNotification.tsx   # Toast for triggered alerts
│   ├── ExchangePanel.tsx       # Per-exchange prices, aggregation, spread
│   ├── ComparisonPanel.tsx     # Multi-symbol sparklines
│   ├── MarketSentimentPanel.tsx# F&G gauge, funding rates, OI
│   ├── CorrelationPanel.tsx    # BTC/ETH correlation bars
│   ├── NewsFeedPanel.tsx       # News with bull/bear filter
│   └── SettingsPanel.tsx       # Theme presets + color editor
├── context/
│   └── ThemeContext.tsx        # 15-color theme, presets, saved palettes
├── hooks/
│   ├── useMultiExchangeData.ts # Binance/Coinbase/OKX/Bybit sockets + candles
│   └── useAlerts.ts            # Alert evaluation, sound, persistence
├── lib/
│   ├── types.ts                # Candle, Trade, OrderBookEntry, WatchlistItem
│   ├── symbols.ts              # Label <-> exchange symbol mapping (GOLD/USDT -> PAXGUSDT)
│   ├── indicators.ts           # SMA, EMA, RSI, MACD, Bollinger Bands, Stoch RSI
│   ├── dayLines.ts             # UTC day separators via a lightweight-charts series primitive
│   ├── bands.ts                # Shaded price band (RSI/Stoch RSI neutral zone), series primitive
│   └── drawings.ts             # Level / trend / box drawings + live draft, series primitive
└── package.json
```

## Current Features
- Multi-panel terminal layout (watchlist, chart, order book, trade tape, stats, alerts)
- Multi-exchange WebSocket data (Binance, Coinbase, OKX, Bybit) with price aggregation
- Historical candle data via static-klines + Binance REST, live kline updates via WebSocket
- Candlestick chart with working timeframe selector (1m/5m/15m/1h/4h/1d), default 1h
- Chart symbol switching across 6 pairs (BTC/ETH/SOL/XRP/BNB/GOLD), each refitted on change
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
- UTC day separators (DAY toggle)
- Order book with depth visualization
- Trade tape with buy/sell coloring
- Price alerts with sound notifications (toggle + volume, persisted)
- Exchange price comparison panel with spread
- Multi-symbol comparison view with sparklines
- Market sentiment panel (F&G gauge, funding rates, OI)
- Correlation panel (BTC/ETH real; BTC/SPX/DXY/Gold placeholders)
- News feed with bull/bear sentiment filter
- Drag-and-drop panel reordering (persisted)
- Command bar with keyboard shortcuts (`/` to focus, `Esc` to clear)
- Theme customization: 15 presets + saved palettes + fine-tuning editor (15 fields)
- Dark terminal aesthetic; single-column responsive layout below 900px

## API Services

| Service | Provider | Used For | Endpoint |
|---------|----------|----------|----------|
| Binance WebSocket | Binance | Trades, order book, klines | `wss://stream.binance.com:9443/ws` |
| Coinbase WebSocket | Coinbase | Trades (price aggregate) | `wss://ws-feed.exchange.coinbase.com` |
| OKX WebSocket | OKX | Trades (price aggregate) | `wss://ws.okx.com:8443/ws/v5/public` |
| Bybit WebSocket | Bybit | Trades (price aggregate) | `wss://stream.bybit.com/v5/public/spot` |
| Binance REST API | Binance | Klines (fill/live), 24hr ticker, funding rate, open interest | `api.binance.com/api/v3/` + `fapi.binance.com/fapi/v1/` |
| Fear & Greed Index | alternative.me | Market sentiment gauge | `api.alternative.me/fng/` |
| CoinDesk RSS | CoinDesk | BTC news headlines | `coindesk.com/arc/outboundfeeds/rss/` |
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

## Recommendations / Potential Updates
Deferred rather than abandoned. Ordered roughly by value per unit of effort.

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
  `btc-terminal:drawings`
