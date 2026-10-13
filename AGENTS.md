# AGENTS.md — BTC Terminal

## Overview
Bloomberg Terminal-style Next.js app for BTC/USDT trading data. Real-time dashboard with multi-panel layout, custom theming, drag-and-drop panels, technical indicators, and alerts.

## Tech Stack
- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS + inline styles (theme-driven via ThemeContext)
- lightweight-charts v5.2.1 (TradingView) — v5 series API (`addSeries(CandlestickSeries|LineSeries|HistogramSeries, ...)`) and native multi-pane charts (`addPane`, `IPaneApi`)
- React Context for theme, custom hooks for data/alerts

## Commands
- `npm run dev` — start dev server (localhost:3030)
- `npm run build` — production build (type-checks)
- `npm run lint` — **broken**: Next 16 removed `next lint` and no ESLint config ships; use `npm run build` for type-checking.

## Architecture
```
app/
├── layout.tsx              # Root layout, ThemeProvider wrapper
├── page.tsx                # Grid layout, panel order (persisted), orchestration
├── globals.css             # Base styles
└── api/
    ├── klines/route.ts     # OHLCV. static-klines history + Binance gap-fill + live tick
    ├── ticker/route.ts     # 24hr stats for MarketStats
    ├── sentiment/route.ts  # Fear & Greed + funding rate + open interest
    ├── comparison/route.ts # Multi-symbol ticker + sparklines
    ├── news/route.ts       # CoinDesk RSS with keyword sentiment
    └── correlation/route.ts# BTC/ETH 30d rolling correlation
components/
├── Panel.tsx               # Wrapper: drag grip + height/span. Use for side panels
├── CommandBar.tsx          # Top bar: logo, search, settings, clock
├── Watchlist.tsx           # Left sidebar symbol list
├── MarketStats.tsx         # 24hr strip (real ticker, live/offline dot)
├── PriceChart.tsx          # Candles, volume, indicator sub-panes, drawing tools
├── OrderBook.tsx           # Bid/ask ladder
├── TradeTape.tsx           # Time & sales
├── AlertsPanel.tsx         # Price alerts (persisted)
├── AlertNotification.tsx   # Toast for triggered alerts
├── ExchangePanel.tsx       # Per-exchange prices, aggregation, spread
├── ComparisonPanel.tsx     # Multi-symbol sparklines
├── MarketSentimentPanel.tsx# F&G gauge, funding rates, OI
├── CorrelationPanel.tsx    # BTC/ETH correlation bars
├── NewsFeedPanel.tsx       # News with bull/bear filter
└── SettingsPanel.tsx       # Theme presets + color editor
context/
└── ThemeContext.tsx        # 15-color theme, presets, localStorage persistence
hooks/
├── useMultiExchangeData.ts # Binance/Coinbase/OKX/Bybit sockets + candles
└── useAlerts.ts            # Alert evaluation, sound, persistence
lib/
├── types.ts                # Candle, Trade, OrderBookEntry, WatchlistItem
├── symbols.ts              # Label <-> exchange symbol mapping (GOLD/USDT -> PAXGUSDT)
├── indicators.ts           # SMA, EMA, RSI, MACD, Bollinger Bands, Stoch RSI
├── dayLines.ts             # UTC day separators via a lightweight-charts series primitive
├── bands.ts                # Shaded price band (RSI/Stoch RSI neutral zone), series primitive
└── drawings.ts             # Level / trend / box drawings + live draft, series primitive
```

## Notable Constraints

- **`symbols.ts` is the only symbol map.** Binance lists no spot `GOLD/USDT`; it
  maps to `PAXGUSDT`. Never re-derive symbols with a regex — that previously
  produced a nonexistent `GOLDUSDT` and the chart silently 502'd.
- **Day separators must be a series primitive.** `setData` de-duplicates by
  timestamp, so a line series cannot draw a vertical segment. `lib/dayLines.ts`
  implements `ISeriesPrimitive` and paints straight to the canvas.
- **UI scale is CSS, not zoom.** `transform: scale()` in `globals.css`. Chromium
  accepts `zoom` without painting it, which underfilled the right edge by 4.8%.
- **The chart pane counter-scales the app's CSS transform.** `transform` is
  invisible to `getBoundingClientRect`, but not to lightweight-charts: it reads
  its size from the transformed rect (so `pixelRatio` became 1.05) and then maps
  pointer coords as `clientX - rect.left` — treating a visual delta as its own
  space. The result was the crosshair, user drawings, and hit-testing all landing
  ~5% away from the cursor (drawings below it, selection above it). `PriceChart`
  wraps the canvas + overlay in a `scale(1 / var(--ui-scale))` box grown by
  `var(--ui-scale)`, so the net transform on the chart is identity and the
  library's coordinates match the cursor again. Do **not** put the chart inside
  the scaled area without this wrapper.
- **Tailwind v4 is CSS-first.** Theme tokens live in `app/globals.css` under
  `@theme`; there is no `tailwind.config.js`.

## External APIs (all free, no keys)
| Provider | Used For | Endpoint |
|----------|----------|----------|
| Binance WebSocket | Trades, order book, klines | `wss://stream.binance.com:9443/ws` |
| Coinbase WebSocket | Trades (price aggregate) | `wss://ws-feed.exchange.coinbase.com` |
| OKX WebSocket | Trades (price aggregate) | `wss://ws.okx.com:8443/ws/v5/public` |
| Bybit WebSocket | Trades (price aggregate) | `wss://stream.bybit.com/v5/public/spot` |
| Binance REST | Klines (fill/live), 24hr ticker, funding, OI | `api.binance.com/api/v3/`, `fapi.binance.com/fapi/v1/` |
| alternative.me | Fear & Greed Index | `api.alternative.me/fng/` |
| CoinDesk RSS | News headlines | `coindesk.com/arc/outboundfeeds/rss/` |
| static-klines | Historical OHLCV to 2010 | `finom.github.io/static-klines/api/klines/` |

## Key Conventions
- **Timeframes are lowercase Binance codes** (`1m 5m 15m 1h 4h 1d`). The API route normalizes, but keep the UI consistent or the selected-button check breaks.
- All colors come from `useTheme()`. Never hardcode hex or Tailwind color classes in components.
- Side panels are wrapped in `<Panel>`; only its grip strip is draggable. Do not put `draggable` on a panel body — it breaks text selection and scrolling.
- One WebSocket authority per data type: Binance drives the order book, all four feeds the price aggregate. Unsubscribed streams are explicitly `false` in `EXCHANGES`.
- **Every venue names instruments differently.** Binance `BTCUSDT` (lowercase),
  Coinbase `BTC-USD`, OKX `BTC-USDT`, Bybit spot `BTCUSDT`. Read the `EXCHANGES`
  table rather than composing a symbol from `baseAsset()` by hand — that
  produced `BTC-USDT` for Bybit and was silently rejected.
- **Never swallow a failed subscribe ack.** Bybit answers a bad topic with
  `{ success: false, ret_msg: "Invalid symbol" }` and then sends nothing at all.
  A filter that drops acks unconditionally hides the only error you will get.
- Bybit requires a `{ op: "pong" }` reply to its periodic ping or it drops the
  socket after ~20s.
- Never invent fallback data. If a feed is down, show the last real value plus a disconnected indicator.
- Hydration safety: no `Math.random()`/`Date.now()` in `useState` initializers. Initialize empty, populate in `useEffect`. Same for `localStorage` reads.
- Chart is created once per theme; data updates go through `setData()`, and the chart ref is nulled in cleanup to avoid "Object is disposed".
- **Refit the view on symbol/timeframe change.** `fitContent()` ran only at creation, so switching to a symbol whose timestamps differ could leave the viewport over a stretch with no data — a blank-looking chart. `PriceChart` flags a one-shot refit when `symbol`/`timeframe` change and applies it after the new candles land. The refit also re-arms the right price scale (`applyOptions({ autoScale: true })`): dragging the price axis switches it to manual mode, and `setData` alone won't re-fit it, so switching from BTC (~80k) to GOLD (~4k) left the axis parked on the old range.
- **Observe the chart container, not just the window.** A `ResizeObserver` on the container catches layout changes the `resize` event misses (narrow/wide breakpoint, panel reorder, CSS scale).
- **User drawings are a series primitive, not line series.** `lib/drawings.ts`
  paints levels / trendlines / boxes straight to the canvas. A box has no line
  series representation, `setData` can't draw a full-width level, and the
  in-progress draft must update on every pointer move without a React render.
  `PriceChart` drives it through a transparent overlay that is only mounted while
  a tool is active, so it never intercepts panning or the crosshair.
- **Selecting / deleting a drawing uses the chart's own events, not the overlay.**
  When no tool is active the overlay is unmounted, so hit-testing and clicks go
  through `chart.subscribeCrosshairMove` (hover highlight) and
  `chart.subscribeClick` (select, or delete when the click lands on the selected
  drawing's ✕ handle). `hitTestDrawing` / `deleteHandlePoint` in `lib/drawings.ts`
  convert between price/time and pane pixels with the same `timeToCoordinate` /
  `priceToCoordinate` calls the renderer uses, so `MouseEventParams.point` and the
  drawn handle agree. Selection lives in a ref (for the handlers) mirrored into
  `selectedId` state (for the toolbar's ✕ Delete button); hover stays ref-only to
  avoid a render per mouse move. Separate whole-second synthetic clicks are
  suppressed by the library's click detection — real users clicking then pausing
  are unaffected.
- **Magnet mode snaps to OHLC, and drives the crosshair via `setCrosshairPosition`.**
  The toolbar's 🧲 toggle (in-memory, like VOL/DAY) makes `snapPriceToOhlc` +
  `candleAt` pull both the crosshair and drawing anchors onto the hovered
  candle's nearest Open/High/Low/Close. `setCrosshairPosition` re-fires
  `subscribeCrosshairMove`, so `lastSnapRef` (time **and** price) suppresses the
  re-entrant event and stops the loop — comparing price alone leaves the vertical
  line stuck when moving between candles that share a snap price. While a draw
  tool is active the overlay swallows chart events, so `onPointerMove` re-drives
  the crosshair itself for continuous feedback.
- **RSI/MACD live in native v5 sub-panes, not overlay price scales.** `PriceChart`
  creates them with `chart.addPane(true)` (preserve-empty, so a pane survives series
  teardown and keeps a user-resized height) and adds series via `pane.addSeries(...)`.
  RSI (14) and Stoch RSI (14,14,3,3) each pin their own right scale to 0–100 via the
  series `autoscaleInfoProvider`; MACD autoscales. RSI adds 70 / 50 / 30 and Stoch RSI
  adds 80 / 20 reference lines as thin dashed `createPriceLine` overlays, and each
  shades its neutral zone (between 70–30 / 80–20) with a translucent `PriceBandPrimitive`
  (`lib/bands.ts`, a series primitive — lightweight-charts has no fill-between-prices). <br>The work is split across two effects: a *structural* one (deps
  `[activeIndicators, theme, chartEpoch]`) creates/destroys series + panes, and a
  *data* one (deps `[computed, theme]`) pushes values. Rebuilding series inside the
  data effect instead would reset a user-resized pane on every tick. Panes are split
  with `setStretchFactor` (main 4 : sub 1) and the divider is draggable for free
  (`layout.panes.enableResize`, themed with `separatorColor` / `separatorHoverColor`).
  `chartEpoch` is bumped when the chart is (re)created so the structural effect
  rebuilds against the fresh instance; `paneRefs` is cleared in the chart teardown.
- **Drawings and magnet are gated to pane 0.** In v5 a crosshair move over a
  sub-pane still fires `subscribeCrosshairMove` with chart-relative coordinates, so
  `onCrosshairMove` / `onClick` check `(param.paneIndex ?? 0) === 0` before
  hit-testing or snapping.
- **Skip exactly one save when persisting to localStorage.** The save effect also
  runs on mount with the empty/default initial state and would clobber storage
  before the load effect's state lands (StrictMode double-invokes the mount, so
  the second load reads the clobbered value). Applied in three places: the
  `skipNextSaveRef` guard in `PriceChart`'s drawings persistence,
  `skipThemeSaveRef` / `skipSavedThemesSaveRef` in `ThemeContext`, and
  `skipNextSaveRef` in `useAlerts` (theme was silently resetting to Default, and
  alerts + their prefs were wiped, on every reload before this).
- localStorage keys: `btc-terminal:theme`, `btc-terminal:themes`, `btc-terminal:alerts`, `btc-terminal:alert-prefs`, `btc-terminal:panel-order`, `btc-terminal:drawings`.

## Known Limitations
- BTC/SPX/DXY/Gold correlation are placeholders (needs a premium TradFi feed)
- static-klines refreshes daily at 00:00 UTC; the tail is backfilled from Binance REST
- 1m/5m have no static archive, so history is Binance-only (~2–14 days)
- RSI pane is pinned to a 0–100 scale; MACD autoscales

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
