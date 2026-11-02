# 011 — Real-Time Candles from Kline Stream

**Status:** Done  
**Priority:** P1 · **Effort:** S  
**Depends on:** 003 (Reactive Tick Store), 005 (Chart Refactor)

## Goal
Stream real-time candlestick price updates directly into `marketStore.candles` on every WebSocket tick from the Binance `@kline_<interval>` stream, eliminating the up to 5-second REST lag on active candles while keeping the REST polling loop as a resilient fallback.

## Context
Currently, Binance WebSocket subscribes to `${s}@kline_${interval}` alongside trades and depth in `hooks/useMultiExchangeData.ts`. However, incoming kline events (`msg.e === "kline"`) are dropped because only `msg.e === "trade"` and depth messages are parsed. As a result, the active in-progress chart candle is only updated by a 5-second REST polling interval (`/api/klines?live=1`), causing visible lag between the live trade tape and the candlestick chart.

## Requirements
1. **Live Kline Parsing (`hooks/useMultiExchangeData.ts`)**:
   - Intercept Binance WebSocket `kline` events (`msg.e === "kline"` and `msg.k`).
   - Validate that `msg.k.s` matches the active symbol and `msg.k.i` matches the active interval.
   - Parse open time (in seconds: `Math.floor(k.t / 1000)`), open, high, low, close, and volume.
   - Dispatch to `marketStore.updateLiveCandle(candle)`.
2. **Store Method (`lib/marketStore.ts`)**:
   - Implement `marketStore.updateLiveCandle(candle: Candle)`:
     - If `candles` is empty, initialize with `[candle]`.
     - If the incoming candle has the same `time` as the latest candle:
       - If `open`, `high`, `low`, `close`, and `volume` are unchanged, do nothing (no re-renders).
       - Otherwise, replace the latest candle with the updated candle and notify listeners.
     - If the incoming candle has `time > last.time`, append the new candle.
3. **Resilient REST Fallback (`hooks/useMultiExchangeData.ts`)**:
   - Keep the `/api/klines?live=1` poll as a fallback for connection recovery or gap fill.
   - Relax the REST polling interval from 5s to 10s to reduce unnecessary bandwidth and API calls.
   - Route the REST update through `marketStore.updateLiveCandle(latest)`.
4. **Zero Regressions on Chart Behavior**:
   - Viewport zoom, scroll, and sub-panes (RSI/MACD/Stoch) must remain intact without layout jumps or resetting user-resized panes.

## Technical Approach
- Add `updateLiveCandle(candle: Candle): void` to `marketStore` in `lib/marketStore.ts`.
- In `hooks/useMultiExchangeData.ts`, catch `msg.e === "kline"` events in `ws.onmessage` and forward them to `marketStore.updateLiveCandle`.
- Add unit tests for `updateLiveCandle` in `__tests__/marketStore.test.ts`.

## Out of Scope
- Changing historical candle retrieval from static-klines.
- Changing multi-exchange trade aggregation.

## Acceptance Checklist
- [x] `npm run typecheck` passes with zero errors.
- [x] `npm run test` passes 100% of Vitest tests (53/53 tests across 7 suites).
- [x] `npm run build` compiles all routes cleanly.
- [x] Real-time kline events from Binance WebSocket update the active candle immediately.
- [x] Active candle updates preserve chart zoom, panning, and sub-pane sizing.
- [x] REST fallback continues to function at 10s intervals.
- [x] Unit tests for `updateLiveCandle` in `marketStore.test.ts` pass.
- [x] Documentation updated (`AGENTS.md`, `PROJECT.md`, `specs/README.md`).

## Docs to Update
- `AGENTS.md`: Note real-time kline stream processing.
- `PROJECT.md`: Document real-time WebSocket candle updates.
- `specs/README.md`: Mark Spec 011 as Done.

## Implementation Notes
- Added `marketStore.updateLiveCandle(candle: Candle)` in `lib/marketStore.ts`. Safely validates candle input, updates the active bar in-place when timestamps match, skips redundant state mutations when values are unchanged, and appends when a new candle timestamp opens.
- Updated `hooks/useMultiExchangeData.ts` to intercept Binance WebSocket `e === "kline"` messages, validate symbol and interval matching, and dispatch updates via `marketStore.updateLiveCandle`.
- Relaxed the REST polling loop from 5s to 10s and routed it through `updateLiveCandle` as a resilient fallback.
- Added comprehensive unit tests in `__tests__/marketStore.test.ts` covering candle initialization, in-place updates, append behavior, and reference stability.
