# 004 — Per-Symbol Alert Evaluation & Live Universe Tickers

**Status:** Done
**Priority:** P0 · **Effort:** M
**Depends on:** 003

## Goal
Evaluate each price alert against **its own** symbol's live price rather than the chart's currently selected pair. Users can set an alert on BTC, switch to SOL or XAU, and have the alert fire accurately when BTC reaches target. Enable opt-in browser desktop notifications (`Notification` API) for background alert delivery.

## Context
1. **Critical Pre-Existing Bug:** In `hooks/useAlerts.ts`, `evaluate` evaluates all active alerts against `marketStore.getState().price` (which is the active chart pair's price). If a user sets an alert for "BTC below 70,000" and switches the active chart to SOL (~$180), `evaluate` tests `180 <= 70000` and immediately fires the BTC alert erroneously. Alerts on non-selected symbols can never evaluate correctly.
2. **Global Price Feeds:** Binance provides keyless multi-ticker WebSocket streams:
   - Spot: `wss://stream.binance.com:9443/ws/!miniTicker@arr`
   - Futures: `wss://fstream.binance.com/ws/!miniTicker@arr` (for commodities like XAUUSDT, XAGUSDT, CLUSDT)
   Each stream broadcasts a mini-ticker array every ~1000ms containing `s` (symbol) and `c` (close price).
3. **Advisory Part A Store Follow-ups:**
   - `lib/marketStore.ts` `scheduleNotify`: Delete dead SSR branch (`else if (typeof window === "undefined" && !dirty)`).
   - `lib/marketStore.ts` `useMarket`: Track `lastSelectorRef` so changing inline selector closures re-evaluate correctly.
   - `marketStore.tickers: Record<string, number>`: Store latest prices for all symbols in `UNIVERSE`.

## Requirements
1. **Store Extension (`lib/marketStore.ts`)**:
   - Add `tickers: Record<string, number>` to `MarketState` (default `{}`).
   - Retain `tickers` across active chart symbol resets (symbol switch resets active orderbook/trades/candles, but universe tickers should persist).
   - Delete dead SSR branch in `scheduleNotify`.
   - Track `lastSelectorRef` in `useMarket` so changes to selector functions bust the snapshot memoization.
2. **Universe Tickers Feed**:
   - Connect to Binance Spot `wss://stream.binance.com:9443/ws/!miniTicker@arr` and Binance Futures `wss://fstream.binance.com/ws/!miniTicker@arr`.
   - Filter updates to symbols in `UNIVERSE` (or symbols with active alerts) to keep memory footprint minimal.
   - Update `marketStore.tickers` with current prices.
   - Resilient auto-reconnect on disconnect or error.
3. **Per-Symbol Alert Evaluation (`hooks/useAlerts.ts`)**:
   - Subscribe to `marketStore` and evaluate active alerts against `tickers`:
     - Look up each alert's symbol using `toBinanceSymbol(alert.symbol) ?? alert.symbol`.
     - Read the symbol's current price from `tickers`. If not yet in `tickers` and the alert symbol matches the active chart symbol, fallback to `marketStore.price`.
     - If price is found and > 0, check `condition === "above" ? price >= target : price <= target`.
   - When an alert triggers:
     - Play two-tone alert chime (if `prefs.sound` is enabled).
     - Display `AlertNotification` toast.
     - If `prefs.desktop` is enabled and `Notification.permission === "granted"`, spawn a native desktop `Notification`.
     - Update alert status to `triggered: true, active: false`.
4. **Desktop Notification Preferences (`hooks/useAlerts.ts` & `components/AlertsPanel.tsx`)**:
   - Extend `AlertPrefs` to `{ sound: boolean; volume: number; desktop: boolean }`. Default `desktop: false`.
   - Add a desktop notification toggle button in `AlertsPanel.tsx`.
   - If user enables desktop notifications and `Notification.permission === "default"`, call `Notification.requestPermission()`. If granted, enable `prefs.desktop`.
5. **Live Prices in Watchlist & Heatmap**:
   - In `components/Watchlist.tsx` and `components/MarketHeatmapPanel.tsx`, display real-time live prices from `marketStore.tickers[symbol]` overlaid on top of comparison data between 15s REST polls.

## Acceptance Checklist
- [x] `lib/marketStore.ts` stores `tickers: Record<string, number>`, dead SSR code removed, `useMarket` tracks `lastSelectorRef`.
- [x] Spot and Futures `!miniTicker@arr` streams deliver live prices for universe symbols into `marketStore.tickers`.
- [x] Setting an alert for BTC below 70,000 and switching to SOL (~$180) does NOT fire the alert.
- [x] An alert fires only when its matching symbol crosses the target price.
- [x] Desktop notifications can be toggled on/off in `AlertsPanel`, requesting browser permission gracefully.
- [x] `npm run typecheck` passes with 0 errors.
- [x] `npm run build` succeeds.
- [x] All AGENTS.md rules preserved (skip-exactly-one-save in localStorage, theme colors only from `useTheme()`, etc.).

## Implementation Notes
- **Store Extensions**: Added `tickers: Record<string, number>` to `MarketState` in `lib/marketStore.ts`. Removed dead SSR branch in `scheduleNotify` (`else if (typeof window === "undefined" && !dirty)`). Added `lastSelectorRef` memoization cache busting in `useMarket` for dynamic/inline selectors.
- **Global Tickers Feed**: Added `useUniverseTickersFeed` in `hooks/useMultiExchangeData.ts` subscribing to `wss://stream.binance.com:9443/ws/!miniTicker@arr` (Spot) and `wss://fstream.binance.com/ws/!miniTicker@arr` (Futures). Tickers are keyed by both Binance symbol (`BTCUSDT`, `XAUUSDT`, `CLUSDT`) and canonical UI label (`BTC/USDT`, `XAU/USDT`, `OIL/USDT`).
- **Per-Symbol Alert Evaluation**: Updated `hooks/useAlerts.ts` so `evaluate()` inspects each alert's designated symbol price in `tickers` (`toBinanceSymbol(alert.symbol)`). An alert set on BTC will never evaluate against active chart symbols like SOL or ETH.
- **Desktop Notification API**: Extended `AlertPrefs` with `desktop: boolean` (persisted under `btc-terminal:alert-prefs`), added `DESK ON / OFF` toggle in `AlertsPanel.tsx`, and wired `Notification.requestPermission()` and native `Notification` dispatch on trigger.
- **Live Watchlist & Heatmap**: Overlaid real-time `tickers` prices in `components/Watchlist.tsx` and `components/MarketHeatmapPanel.tsx` so users see tick updates without waiting 15s for comparison REST polls.
