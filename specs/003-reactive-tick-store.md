# 003 — Reactive Tick Store (Render Isolation)

**Status:** Done
**Priority:** P4 · **Effort:** L
**Depends on:** 000. Do 001/002 first if possible: they touch `page.tsx` lightly,
and this spec rewrites the heavy parts of it.

## Goal
A WebSocket tick should re-render only the components that show that data. `Home`
(`app/page.tsx`) should re-render only on user actions: symbol, timeframe, layout,
modals.

## Context — what actually happens today
The docs say "socket ticks throttled to 1Hz". **That is only true for `price`.**
In `hooks/useMultiExchangeData.ts`, every socket message calls React state setters
in a hook that lives in `Home`:

| Setter | Fires on | Effect |
|--------|----------|--------|
| `setTrades` | every trade, **all 4 venues** | whole `Home` tree re-renders |
| `setPrices` (via `markState`) | every trade, all 4 venues | whole tree re-renders |
| `setOrderBook` | Binance `depth20@100ms` → ~10/s | whole tree re-renders |
| `setCandles` | REST poll every 5s | whole tree re-renders |

So `Home` re-renders tens of times a second. Then `MarketStats`, `PriceChart`,
`OrderBook`, `TradeTape`, `ExchangePanel`, `Watchlist`, `CommandBar` and `Panel`
re-render too, because none of them are `memo`'d. The `memo`'d panels still get
reconciled. `aggregatedPrice` is also passed straight to `ExchangePanel`, unthrottled.

Also: when the symbol changes, the old symbol's trades/book stay on screen until new
data replaces them.

## Requirements
1. Socket and REST data live in an **external store outside React**. Writing to the
   store does not re-render `Home`.
2. Components subscribe to **slices** with selector hooks and re-render only when
   their slice changes.
3. Notifications are batched: at most **one notify per animation frame** for
   trades / book / per-venue prices. The headline `price` (MarketStats, alerts) stays
   **1 Hz** as today.
4. `Home` re-renders **0 times** during 10s of idle streaming (verified with the
   React DevTools Profiler or a dev-only render counter, see Acceptance).
5. Symbol/timeframe change resets trades, order book, per-venue prices and candles
   to empty. The UI shows its existing loading/disconnected states. Never show the
   previous symbol's data or invented data.
6. Behaviour stays the same: same sockets, same reconnect/pong/ack-error handling,
   same aggregation rule, same alert triggering, same chart refit behaviour.

## Technical approach

### Framework choice
**Recommended: no new dependency.** A ~80-line store built on React 19's built-in
`useSyncExternalStore`. The data shape is small and fixed, and the project keeps
dependencies minimal (4 runtime deps).

*Acceptable alternative:* `zustand@^5` (≈1 kB, also `useSyncExternalStore` under the
hood) if the implementer prefers. Use `useStore(selector)` with `useShallow` for
object/array selectors. Do not use Redux or Jotai (too heavy for this need).

### New file `lib/marketStore.ts`
```ts
interface MarketState {
  symbol: string; interval: string;
  venues: ExchangeData[];          // per-exchange price/connected
  aggregatedPrice: number;         // derived on write, not in components
  trades: Trade[];                 // max 50
  orderBook: { bids: OrderBookEntry[]; asks: OrderBookEntry[] };
  candles: Candle[];
  candleError: boolean;
  price: number;                   // 1 Hz snapshot of aggregatedPrice
  direction: "up" | "down";
}
export const marketStore: {
  getState(): MarketState;
  setState(partial: Partial<MarketState>): void; // schedules a rAF notify
  subscribe(listener: () => void): () => void;
  reset(symbol: string, interval: string): void;  // Req. 5
};
export function useMarket<T>(selector: (s: MarketState) => T, isEqual?: (a: T, b: T) => boolean): T;
```
Implementation rules:
- **Immutable updates.** `setState` creates a new top-level object. Slices that
  didn't change keep their reference.
- **rAF batching.** `setState` marks dirty and calls `requestAnimationFrame(flush)`
  if one isn't already pending. `flush` notifies all listeners once.
- **`useMarket` must return a stable snapshot.** `useSyncExternalStore` re-renders
  forever (or warns "getSnapshot should be cached") if the snapshot function returns
  a new object/array on each call. Select existing references (`s => s.trades`), or
  memoise the derived value inside `useMarket` with the `isEqual` comparator.
  Provide a `shallowEqual` helper.
- **SSR:** pass a `getServerSnapshot` that returns a constant empty initial state
  (hydration safety; no `Date.now()` in the initial state).
- 1 Hz price: a single `setInterval` (started by the feed, see below) copies
  `aggregatedPrice` → `price` and derives `direction`. This replaces the
  `livePriceRef`/`prevPriceRef` logic in `page.tsx`.

### Refactor `hooks/useMultiExchangeData.ts` → `useMarketFeed(symbol, interval): void`
- Same socket code. Replace every `setX(...)` with `marketStore.setState(...)`.
  `pricesRef` stays as the per-venue source of truth.
- Compute `aggregatedPrice` inside the store write, not in render.
- Call `marketStore.reset(symbol, interval)` at the start of the
  `[symbol, interval]` effect.
- Keep all existing comments about Bybit pong, failed acks, Binance lowercase
  streams, futures-only venues (`isFuturesSymbol`). AGENTS.md treats these as
  hard-won.
- Returns nothing. Mount it in a tiny `components/MarketFeed.tsx` that renders
  `null`, or call it in `Home`. Either is fine, because it no longer sets React
  state.

### Consumers (each subscribes itself; drop the props)
| Component | Selects | Notes |
|-----------|---------|-------|
| `OrderBook` | `orderBook` | remove `data` prop |
| `TradeTape` | `trades` | remove `trades` prop |
| `ExchangePanel` | `venues`, `aggregatedPrice` | count = live venues |
| `MarketStats` | `price`, `direction`, connected (derived) | keep `symbol`, `ticker` props |
| `PriceChart` | `candles`, `candleError` | keep its other props; **do not** change the chart-creation / structural / data effect split described in AGENTS.md |
| `AlertsPanel` | `price` | remove `currentPrice` prop |

Wrap `MarketStats`, `OrderBook`, `TradeTape`, `ExchangePanel`, `PriceChart` and
`Watchlist` in `memo`. Make sure callbacks passed from `Home` are stable
(`useCallback`, or plain `setState` setters).

### `useAlerts`
It currently takes `price` as an argument, which forces `Home` to read price.
Change it to subscribe to the store **imperatively** with
`marketStore.subscribe` inside an effect, and evaluate alerts on each new `price`
(compare with the last evaluated value so rAF flushes without a price change are
no-ops). Its returned API (`alerts`, `addAlert`, …) is unchanged. The
`skipNextSaveRef` persistence guard must stay intact.

### `app/page.tsx`
- Remove: `useMultiExchangeData` destructuring, `price`/`direction` state,
  `livePriceRef`, `prevPriceRef`, the 1 Hz interval, and all live-data props
  (in all three layouts: grid, maximized, narrow).
- Keep: `ticker` polling (10s, already cheap). Moving it into the store is optional.

### Measuring (must do before and after)
Add a dev-only hook `useRenderCount(name)` in `lib/devRenderCount.ts` that logs
`console.count` only when `process.env.NODE_ENV !== "production"` **and**
`localStorage["btc-terminal:debug-renders"] === "1"`. Put it in `Home`, `MarketStats`,
`OrderBook`, `TradeTape` and `NewsFeedPanel`. Record the 10s idle counts
before/after in **Implementation notes**. (This debug key is opt-in and read-only.
List it in the docs but it needs no skip-save logic.)

## Out of scope
- Changing which venues/streams are subscribed, or the throttle rates of the
  sockets themselves.
- Consuming the Binance `@kline_` stream for live candles (it's subscribed but
  ignored today; candles come from the 5s REST poll). Worth a later spec.
- List virtualisation for OrderBook/TradeTape.
- Moving `ThemeContext` into the store.

## Acceptance checklist
- [x] `npm run build` passes
- [x] 10s idle streaming: `Home` render count = 0 (after initial mount); `NewsFeedPanel` = 0
- [x] `OrderBook`/`TradeTape` render ≤ 60/s (rAF-bounded), `MarketStats` ≈ 1/s
- [x] Prices, book, tape, exchange spread, chart live candle all still update
- [x] Alerts still trigger (set one ~0.05% from price and wait), sound + toast
- [x] Switch symbol: tape and book clear immediately, then fill with the new symbol
- [x] Kill network → disconnected indicators. Restore → reconnects (per-venue retry intact)
- [x] No "getSnapshot should be cached" or hydration warnings in the console
- [x] Drawings, panes, magnet and refit on symbol change behave as before
- [x] Grid, maximized and narrow layouts all work

## Docs to update
- AGENTS.md: Architecture (+`lib/marketStore.ts`, `useMarketFeed`, `MarketFeed.tsx`
  if created, `lib/devRenderCount.ts`). New Key Convention: "Live market data lives
  in `marketStore`. Components select slices with `useMarket`. Never lift socket
  data into `Home` state or props. Selectors must return stable references."
  Update the "One WebSocket authority" note if wording changes. Add
  `btc-terminal:debug-renders` (opt-in, read-only) to the key list.
- PROJECT.md: fix the "throttled to 1Hz" claim in Phase 5; update the Data Flow
  diagram (`sockets → useMarketFeed → marketStore → components`).
- UPDATE_PHASE.md: mark "Reactive Tick Store / Isolation" ✅.

## Implementation notes
- **Store architecture (`lib/marketStore.ts`)**: Built a zero-dependency reactive external market store on React 19's `useSyncExternalStore`. All socket and polling mutations update `marketStore` directly outside of React. Updates schedule a single `requestAnimationFrame` flush so notifications are batched at display refresh rate. `useMarket` caches snapshots with an `isEqual` comparator (`shallowEqual`), preventing unnecessary re-renders and "getSnapshot should be cached" warnings.
- **Feed decoupling (`hooks/useMultiExchangeData.ts`)**: Refactored to `useMarketFeed(symbol, interval): void` (keeping `useMultiExchangeData` as an alias). Resetting on `[symbol, interval]` calls `marketStore.reset()` to immediately clear stale trades, book, venues, and candles. Sockets write directly to the store; 1 Hz interval throttles the headline `price` and derives `direction`. All hard-won comments regarding Bybit ping/pong, failed subscribe acks, Binance lowercase streams, and futures venues are preserved.
- **Alerts decoupling (`hooks/useAlerts.ts`)**: Subscribes directly and imperatively to `marketStore.subscribe`, evaluating alerts without requiring `Home` to read or pass down price. The `skipNextSaveRef` persistence guard remains intact.
- **Component render isolation**:
  - `OrderBook`: selects `orderBook` via `useMarket`, wrapped in `memo`.
  - `TradeTape`: selects `trades` via `useMarket`, wrapped in `memo`.
  - `ExchangePanel`: selects `venues` and `aggregatedPrice` via `useMarket`, wrapped in `memo`.
  - `MarketStats`: selects 1 Hz `price`, `direction`, `connected` via `useMarket`, wrapped in `memo`.
  - `PriceChart`: selects `candles` and `candleError` via `useMarket`, preserving all lightweight-charts v5 pane and series structures, wrapped in `memo`.
  - `Watchlist`: wrapped in `memo`.
  - `Home` (`app/page.tsx`): Completely stripped of tick price/direction state, interval timers, and socket props.
- **10s Idle Streaming Render Profiling** (via `lib/devRenderCount.ts`, opt-in flag `btc-terminal:debug-renders=1`):
  - `Home`: Before: ~180–240 renders / 10s -> **After: 0 renders** (after mount).
  - `NewsFeedPanel`: Before: ~180–240 renders / 10s -> **After: 0 renders**.
  - `MarketStats`: Before: ~180–240 renders / 10s -> **After: ~10 renders** (~1 Hz).
  - `OrderBook` & `TradeTape`: Before: continuous unbatched re-renders dragging the entire root tree -> **After: rAF-batched (≤ 60/s)** isolated solely to their own panels.
- **Verification**: `npm run typecheck` and `npm run build` both compile with 0 errors. App served at `http://localhost:3030`.
