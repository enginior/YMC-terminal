# 010 — Configurable Technical Indicators

**Status:** Complete  
**Priority:** P1 · **Effort:** M  
**Depends on:** 005 (Chart modularization), 006 (TradingView layout), 012 (OI/Funding/CVD panes)

## Goal
Make all technical indicator parameters (lengths, smoothing, standard deviations, and oscillator threshold bands) fully customizable through a settings gear `⚙` in the Indicators Modal (`IndicatorsModal.tsx`), dynamically recomputing the charts and persisting user configurations to `localStorage`.

## Context
Previously, indicator calculations used hardcoded default parameters: SMA (20/50), EMA (20/50), Bollinger (20, 2), RSI (14, 70/30 bands), MACD (12, 26, 9), and Stoch RSI (14, 14, 3, 3, 80/20 bands). Professional traders require custom periods (such as 9/21 EMA for scalp trading, 200 SMA for macro trend following, and custom RSI lengths/thresholds).

## Requirements

### 1. Indicator Settings Types & Defaults (`components/chart/types.ts`)
- Define `IndicatorSettings` interface covering:
  - `sma`: `{ fast: number; slow: number }` (default `20`, `50`)
  - `ema`: `{ fast: number; slow: number }` (default `20`, `50`)
  - `bollinger`: `{ period: number; stdDev: number }` (default `20`, `2`)
  - `rsi`: `{ period: number; overbought: number; oversold: number }` (default `14`, `70`, `30`)
  - `macd`: `{ fast: number; slow: number; signal: number }` (default `12`, `26`, `9`)
  - `stochrsi`: `{ lengthRSI: number; lengthStoch: number; smoothK: number; smoothD: number; overbought: number; oversold: number }` (default `14`, `14`, `3`, `3`, `80`, `20`)
- `DEFAULT_INDICATOR_SETTINGS` constant.
- Storage key: `btc-terminal:indicator-settings` with skip-one-save hydration guard.

### 2. Indicator Calculation Functions (`lib/indicators.ts`)
- Update `macd(data: Candle[], fastPeriod?: number, slowPeriod?: number, signalPeriod?: number)` to accept custom periods.
- Ensure all other functions (`sma`, `ema`, `bollingerBands`, `rsi`, `stochRsi`) cleanly apply the configurable params.

### 3. Reactive Indicator Engine (`components/chart/useIndicatorPanes.ts`)
- Accept `indicatorSettings` and `onUpdateSettings` in `useIndicatorPanes`.
- Memoize `computed` based on `[candles, indicatorSettings]`.
- Update overlay specs and series data rendering.
- Dynamically render RSI bands/lines with `overbought` / `oversold` from settings.
- Dynamically render Stoch RSI bands/lines with `overbought` / `oversold` from settings.

### 4. Interactive Configuration UI (`components/chart/IndicatorsModal.tsx`)
- Add a configuration gear button `⚙` on configurable indicator rows.
- Clicking `⚙` expands an inline accordion/drawer for that indicator:
  - Form inputs with clear labels (e.g. "Fast Length", "Slow Length", "StdDev", "Overbought", "Oversold").
  - Min/max numeric clamping and validation.
  - "Reset" button to restore that specific indicator's default values.
- Dynamic indicator badges reflecting active parameters (e.g., `SMA 9 / 21`, `EMA 20 / 50`).

### 5. Acceptance Checklist
- [x] `IndicatorSettings` schema and defaults defined with strict TypeScript types.
- [x] `macd` in `lib/indicators.ts` accepts custom parameters with backward-compatible defaults.
- [x] Indicator calculations reactively recompute when parameters change.
- [x] RSI and Stoch RSI bands dynamically adapt to custom overbought/oversold levels.
- [x] Users can edit parameters in `IndicatorsModal.tsx` via inline gear toggle.
- [x] Settings persist to `localStorage` under `btc-terminal:indicator-settings`.
- [x] Reset to default restores original parameters.
- [x] `npm run typecheck`, `npm run test`, and `npm run build` pass with 0 errors.
