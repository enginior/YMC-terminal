# 005 — Chart Modularization Refactor

**Status:** Done
**Priority:** P1 · **Effort:** M
**Depends on:** 004, 014

## Goal
Refactor the monolithic 1,644-line `PriceChart.tsx` into modular submodules under `components/chart/` without altering user-facing behavior, visual styling, or breaking AGENTS.md architectural constraints. Every future chart update (TradingView toolbars, new drawing tools, indicator configs, live klines) depends on this refactor.

## Context
`components/PriceChart.tsx` currently combines chart canvas lifecycle, ResizeObserver counter-scaling, Heikin-Ashi/Line styling, technical indicators, v5 sub-panes, user drawings primitives, pointer draft events, magnet snapping, hotkeys, session High/Low lines, PNG/CSV export, and the full header toolbar in a single file. Extending it with grouped toolbars (Spec 006) and new drawing tools (Spec 007) is error-prone without modular separation.

## Requirements
1. **Directory Structure (`components/chart/`)**:
   - `types.ts`: ChartType, IndicatorType, DrawMode, ComputedValues, constant labels, and math helpers (`snapPriceToOhlc`, `candleAt`).
   - `ChartTypeIcon.tsx`: SVG icon renderer for Candles, Heikin Ashi, and Line visuals.
   - `useChartInstance.ts`: Chart canvas creation, ResizeObserver, counter-scale sizing, theme updates, candle/volume/line series data syncing, refit on symbol switch, and session H/L price lines.
   - `useIndicatorPanes.ts`: Indicator computations (SMA, EMA, BB, RSI, MACD, Stoch RSI), native v5 sub-panes lifecycle, structural and data effects.
   - `useDrawings.ts`: Drawings primitive integration, magnet crosshair snapping, hit-testing, selection/deletion, overlay pointer drag events, keyboard shortcuts (`Esc`, `Del`, `v`, `d`, `m`), and per-symbol localStorage persistence.
   - `ChartHeader.tsx`: Top controls toolbar (symbol, timeframes, chart visual dropdown, VOL/DAY/HL toggles, indicators dropdown, draw tools, ruler, PNG/CSV export, maximize toggle).
2. **Preserve Architecture & AGENTS.md Constraints**:
   - Counter-scale CSS transform `scale(1 / var(--ui-scale))` wrapper must remain identical.
   - Chart created once per theme; data pushed via `setData()`; chart ref nulled on disposal.
   - One-shot viewport refit + price axis re-arm (`applyOptions({ autoScale: true })`) on symbol/timeframe change.
   - Container `ResizeObserver` must be retained.
   - Drawings must remain a series primitive (`lib/drawings.ts`) with pointer overlay mounted only during active tool.
   - Drawings selection and hover must use chart crosshair and click subscriptions gated to `paneIndex === 0`.
   - Magnet mode must snap to OHLC and prevent re-entrant loops via `lastSnapRef` (time + price).
   - RSI/MACD sub-panes must use native v5 `addPane(true)` with structural/data effect split.
   - Skip-exactly-one-save localStorage guards preserved for drawings, chart type, and session H/L.
3. **Verification**:
   - `PriceChart.tsx` export interface and props unchanged.
   - `npm run typecheck` passes with 0 errors.
   - `npm run test` passes 100% of test suites.
   - `npm run build` succeeds.

## Acceptance Checklist
- [x] Submodules created in `components/chart/`: `types.ts`, `ChartTypeIcon.tsx`, `useChartInstance.ts`, `useIndicatorPanes.ts`, `useDrawings.ts`, `ChartHeader.tsx`.
- [x] `components/PriceChart.tsx` streamlined from 1,644 lines down to ~270 lines as a clean orchestrating component.
- [x] All 10 AGENTS.md chart constraints verified and intact.
- [x] `npm run typecheck` passes with 0 errors.
- [x] `npm run test` passes with 43/43 tests passing.
- [x] `npm run build` succeeds with 0 errors.

## Implementation Notes
- **Modular Directory Layout**:
  - `components/chart/types.ts`: Centralized chart visual types (`ChartType`), indicator keys, overlay configs, timeframes, and math utilities (`snapPriceToOhlc`, `candleAt`).
  - `components/chart/ChartTypeIcon.tsx`: Standalone SVG icon renderer for Candles, Heikin Ashi, and Line modes.
  - `components/chart/useChartInstance.ts`: Encapsulated chart canvas lifecycle, container ResizeObserver, series data synchronization, line-mode styling, viewport refit logic (`applyOptions({ autoScale: true })` + `fitContent()`), and session High/Low lines.
  - `components/chart/useIndicatorPanes.ts`: Encapsulated SMA/EMA/BB/RSI/MACD/Stoch RSI calculations, native v5 sub-panes management (`chart.addPane(true)`), PriceBandPrimitives, and the separation of structural vs. data update effects.
  - `components/chart/useDrawings.ts`: Encapsulated user drawing primitive, magnet mode crosshair snapping, hit-testing, drawing selection/deletion, overlay drag-to-draw pointer events, keyboard shortcuts (`Esc`, `Del`, `v`, `d`, `m`), and per-symbol localStorage persistence with `skipNextSaveRef`.
  - `components/chart/ChartHeader.tsx`: Extracted top toolbar controls (symbol, timeframes, chart visual dropdown, VOL/DAY/HL toggles, indicators menu, draw tools, ruler, PNG/CSV export, and maximize toggle).
  - `components/PriceChart.tsx`: Main export orchestrating the above modules while retaining the exact same props and public contract.
- **Verification**:
  - `tsc --noEmit` passed with 0 errors.
  - `vitest run` passed all 43 tests in 334ms.
  - `next build --webpack` compiled 12/12 routes successfully.
