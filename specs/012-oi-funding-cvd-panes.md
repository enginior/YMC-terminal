# 012 — Open Interest, Funding Rate & CVD Sub-Panes

**Status:** Complete  
**Priority:** P1 · **Effort:** M  
**Depends on:** 005 (Chart Refactor), 006 (TradingView Layout), 011 (Live Kline Stream)

## Goal
Implement native lightweight-charts v5 sub-panes for Open Interest (OI), Funding Rate History, and Cumulative Volume Delta (CVD) directly beneath the candlestick chart, delivering core institutional perpetuals and order flow analytics synchronized with price action.

## Context
Perpetual crypto traders depend heavily on three critical derivative metrics:
1. **Open Interest (OI)**: Shows capital entering or leaving the market, identifying whether price moves are driven by fresh expansion or short squeezes / long liquidations.
2. **Funding Rate**: Reveals market bias and leverage asymmetry (extreme positive = overleveraged longs, extreme negative = crowded shorts).
3. **Cumulative Volume Delta (CVD)**: Measures net market order aggression (taker buy volume minus taker sell volume), uncovering absorption and divergence before price reversals.

Previously, the terminal showed single-point snapshots of OI and funding in `MarketSentimentPanel.tsx`, but could not plot them historically on the chart canvas.

## Requirements

### 1. Derivatives REST API (`app/api/derivatives/route.ts`)
- Proxy free, keyless Binance Futures endpoints:
  - `openInterestHist`: `https://fapi.binance.com/futures/data/openInterestHist?symbol=${sym}&period=${period}&limit=500`
  - `fundingRate`: `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=500`
- Response payload:
  ```ts
  export interface DerivativesDataResponse {
    symbol: string;
    openInterest: Array<{
      time: number; // epoch seconds
      value: number; // USD value
      amount: number; // coin amount
    }>;
    fundingRates: Array<{
      time: number; // epoch seconds
      rate: number; // percentage (e.g. 0.01 for 0.01%)
      markPrice: number;
    }>;
  }
  ```

### 2. Cumulative Volume Delta (CVD) Engine (`lib/indicators.ts`)
- Calculate candle-by-candle volume delta $\Delta = \frac{close - open}{high - low} \cdot volume$.
- Accumulate across the candle series: $CVD_t = CVD_{t-1} + \Delta_t$.
- Export `cvd(data: Candle[]): (number | null)[]`.

### 3. Indicator Types & Categories (`components/chart/types.ts`, `IndicatorsModal.tsx`)
- Extend `PaneIndicator`:
  ```ts
  export type PaneIndicator = "rsi" | "macd" | "stochrsi" | "oi" | "funding" | "cvd";
  ```
- Add metadata to `INDICATOR_METAS`:
  - `oi`: "Open Interest (OI)" (Category: "Perpetual")
  - `funding`: "Funding Rate History" (Category: "Perpetual")
  - `cvd`: "Cumulative Volume Delta (CVD)" (Category: "Order Flow")
- Update `IndicatorsModal.tsx` with dedicated "Perpetuals & Order Flow (Sub-Panes)" section.

### 4. Sub-Pane Lifecycles (`components/chart/useIndicatorPanes.ts`)
1. **Open Interest (OI) Pane**:
   - Native v5 sub-pane via `ensurePane("oi")`.
   - `AreaSeries` with gradient fill and theme line.
   - Custom price scale formatter displaying USD values in `$B` or `$M` (e.g. `$7.52B`).
2. **Funding Rate Pane**:
   - Native v5 sub-pane via `ensurePane("funding")`.
   - `HistogramSeries` colored green for positive rates ($\ge 0$) and red for negative rates ($< 0$).
   - Dashed zero reference line at `0.00%`.
   - Custom percentage axis formatter (e.g. `+0.0100%`).
3. **CVD Pane**:
   - Native v5 sub-pane via `ensurePane("cvd")`.
   - `LineSeries` colored `#38bdf8` with zero reference dashed line.
   - Formatted `$B`, `$M`, `$k` axis.
4. Auto-rebuild on indicator toggle or theme change, maintaining user-adjusted pane heights via `addPane(true)`.

### 5. Acceptance Checklist
- [x] `npm run typecheck` passes with zero errors.
- [x] `npm run test` passes 100% of Vitest tests (67/67).
- [x] `npm run build` compiles all routes cleanly.
- [x] `app/api/derivatives/route.ts` successfully serves OI and Funding history for any UNIVERSE instrument.
- [x] `IndicatorsModal` lists OI, Funding, and CVD under Perpetuals & Order Flow.
- [x] Toggling OI creates an area sub-pane with formatted billions/millions.
- [x] Toggling Funding creates a histogram sub-pane with green/red bars and zero reference line.
- [x] Toggling CVD creates a continuous volume delta curve.
- [x] Panes survive theme and interval changes smoothly.
- [x] Documentation updated (`AGENTS.md`, `PROJECT.md`, `specs/README.md`).
