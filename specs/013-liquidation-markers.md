# 013 — Real-Time Liquidation Markers on Chart

**Status:** Complete  
**Priority:** P1 · **Effort:** S  
**Depends on:** 005 (Chart Refactor), 006 (TradingView Layout), 011 (Live Kline Stream)

## Goal
Connect Binance Futures live liquidation bursts (`!forceOrder@arr`) directly to the candlestick chart by plotting real-time, size-scaled liquidation markers (`createSeriesMarkers`) on the active symbol's candles, with customizable USD threshold filtering and a top toolbar toggle (`LIQ`).

## Context
The terminal currently has a dedicated `LiquidationsTape.tsx` displaying market-wide liquidations, but there is no visual connection between liquidation cascades and price action on the candlestick chart. Traders on perpetual terminals rely heavily on seeing where long cascades or short squeezes happen on the price ladder to identify liquidity sweeps and support/resistance absorption.

## Requirements

### 1. Unified WebSocket Feed & MarketStore Slice
1. Store liquidation events in `marketStore`:
   ```ts
   export interface LiquidationOrder {
     id: string;
     symbol: string; // e.g. "BTC"
     rawSymbol: string; // e.g. "BTCUSDT"
     side: "BUY" | "SELL"; // BUY = short liquidated (forced buy), SELL = long liquidated (forced sell)
     price: number;
     qty: number;
     usdValue: number;
     time: string;
     timestamp: number; // millisecond timestamp (o.T)
     isLarge: boolean;
   }
   ```
2. Single WebSocket authority:
   - Connect to `wss://fstream.binance.com/ws/!forceOrder@arr` in `useMarketFeed` (or a dedicated `useLiquidationsFeed`).
   - Push parsed orders to `marketStore.addLiquidation(order)` (buffer latest 200 orders across symbols).
   - Update `LiquidationsTape.tsx` to read from `marketStore` instead of running a separate redundant WebSocket.

### 2. Chart Markers Plugin Integration (`components/chart/useLiquidationMarkers.ts`)
1. Filter liquidations matching the active chart symbol (e.g. `toBinanceSymbol(symbol)` matches `rawSymbol` or base asset matches).
2. Align liquidation timestamps to the enclosing candle bar timestamp on the current timeframe.
3. Map liquidations to lightweight-charts v5 `SeriesMarker`:
   - **Long Liquidation (`side === "SELL"`)**:
     - Forced sell / Long wrecked
     - `color`: `theme.red` (or `#ef4444`)
     - `shape`: `"circle"` or `"arrowDown"`
     - `position`: `"atPriceMiddle"` with `price: order.price` (or `"aboveBar"`)
     - `size`: 1 (<$50k), 2 ($50k–$250k), 3 (≥$250k)
     - `text`: formatted USD badge (e.g. `"$150K"`, `"$1.2M"`) for large liquidations
   - **Short Liquidation (`side === "BUY"`)**:
     - Forced buy / Short squeezed
     - `color`: `theme.green` (or `#00d09c`)
     - `shape`: `"circle"` or `"arrowUp"`
     - `position`: `"atPriceMiddle"` with `price: order.price` (or `"belowBar"`)
     - `size`: 1 (<$50k), 2 ($50k–$250k), 3 (≥$250k)
     - `text`: formatted USD badge for large liquidations
4. Attach to candle series via `createSeriesMarkers(candleSeries, markers)`. Update dynamically on incoming liquidations or threshold change.

### 3. Toolbar Controls & Persistence
1. Add `LIQ` toggle button in `ChartHeader.tsx` (next to `VOL` and `DAY`).
2. Add threshold filter dropdown:
   - Options: `$10k`, `$50k` (default), `$100k`, `$250k`, `All`.
3. Persist `showLiquidations` and `liquidationThreshold` in `localStorage` under `btc-terminal:liq-markers` with skip-one-save guard.

### 4. Acceptance Checklist
- [x] `npm run typecheck` passes with zero errors.
- [x] `npm run test` passes 100% of Vitest tests (64/64 passing across 8 suites).
- [x] `npm run build` compiles all routes cleanly (12/12 static & dynamic routes).
- [x] Single WebSocket connection for `!forceOrder@arr` in `hooks/useMultiExchangeData.ts` powers both `LiquidationsTape` and chart markers.
- [x] Liquidation markers appear on the candlestick chart in real time matching the active symbol.
- [x] Red circular beacons represent Long liquidations (forced sell); Green circular beacons represent Short liquidations (forced buy).
- [x] Marker size scales with USD liquidation amount (1 for <$50k, 2 for $50k–$250k, 3 for ≥$250k) with badges on ≥$100k bursts.
- [x] `LIQ` button in `ChartHeader.tsx` toggles markers on/off; threshold dropdown filters out smaller orders (`All`, `$10k`, `$50k`, `$100k`, `$250k`).
- [x] Persistence preserves preferences across reloads under `btc-terminal:liq-markers` with skip-one-save protection.
- [x] Documentation updated (`AGENTS.md`, `PROJECT.md`, `specs/README.md`).

## Implementation Notes
- Centralized `!forceOrder@arr` WebSocket in `hooks/useMultiExchangeData.ts` via `useLiquidationsFeed()`, pushing parsed `LiquidationOrder` objects to `marketStore.addLiquidation()`.
- Refactored `components/LiquidationsTape.tsx` to select `state.liquidations` directly from `marketStore`, eliminating redundant duplicate WebSocket connections.
- Created `components/chart/useLiquidationMarkers.ts`:
  - `findEnclosingCandleTime()`: binary search mapping liquidation timestamps to the enclosing candle bar.
  - `buildLiquidationMarkers()`: filters matching symbol liquidations, scales sizes 1–3, positions markers at execution price (`atPriceMiddle`), and sorts chronologically for lightweight-charts.
  - Integrates `createSeriesMarkers(candleSeries)` plugin lifecycle with clean detachment and reactive updates.
- Added `LIQ` toggle and threshold selector flyout to `components/chart/ChartHeader.tsx`.
- Persisted settings under `btc-terminal:liq-markers` with `skipLiqSaveRef` skip-one-save guard.
- Added comprehensive unit test suite in `__tests__/liquidations.test.ts` (9 tests passing).
