# 014 — Test Suite & GitHub Actions CI

**Status:** Done
**Priority:** P2 · **Effort:** M
**Depends on:** 004

## Goal
Add a fast, robust test suite using Vitest covering all core terminal math, indicators, Heikin-Ashi smoothing, news tagging, symbol mapping, reactive marketStore, and per-symbol alert evaluation. Add a GitHub Actions CI workflow to enforce type-checking, tests, and production build on every push and PR.

## Context
Today, regressions are only caught manually or via `npm run typecheck` and `npm run build`. With upcoming complex features like the 1,600-line `PriceChart.tsx` refactor (Spec 005), TradingView-style toolbars (Spec 006), and new drawing tools (Spec 007), having automated unit tests for math and business logic prevents silent regressions.

## Requirements
1. **Vitest Setup**:
   - Install `vitest` as a dev dependency.
   - Configure `vitest.config.ts` with TypeScript path mapping (`@/*` -> `./*`).
   - Add scripts in `package.json`:
     - `"test": "vitest run"`
     - `"test:watch": "vitest"`
2. **Unit Test Coverage**:
   - `__tests__/indicators.test.ts`:
     - SMA: correct sliding window average, handling arrays shorter than period.
     - EMA: exponential weighting, seeding from SMA or first point, smoothing factor $2 / (N + 1)$.
     - RSI: 14-period gains/losses smoothing, bound between 0 and 100.
     - MACD: 12-EMA, 26-EMA, MACD line, 9-EMA signal line, histogram delta.
     - Bollinger Bands: 20-period SMA middle band, standard deviation, upper/lower bounds.
     - Stoch RSI: RSI calculation fed into Stochastic %K and %D lines.
   - `__tests__/heikenAshi.test.ts`:
     - Initial bar calculation: `haClose = (O+H+L+C)/4`, `haOpen = (O+C)/2`, `haHigh`, `haLow`.
     - Recursive smoothing: `haOpen = (prevHaOpen + prevHaClose) / 2`.
     - Bounds clamping: `haHigh = max(H, haOpen, haClose)`, `haLow = min(L, haOpen, haClose)`.
   - `__tests__/symbols.test.ts`:
     - `UNIVERSE`: contains all 12 assets with valid symbols and labels.
     - `toBinanceSymbol`: handles exact labels, lowercase, aliases (`GOLD/USDT` -> `XAUUSDT`, `OIL/USDT` -> `CLUSDT`, `PAXGUSDT` -> `XAUUSDT`).
     - `toLabel`: reverses symbol to UI display label (`XAUUSDT` -> `XAU/USDT`, `CLUSDT` -> `OIL/USDT`).
     - `isFuturesSymbol`: correctly distinguishes commodities (`XAU`, `XAG`, `CL`) from crypto spot pairs.
     - `resolvePrefix`: matches typed ticker shortcuts ("sol" -> `SOL/USDT`, "gold" -> `XAU/USDT`, "oil" -> `OIL/USDT`).
   - `__tests__/newsTags.test.ts`:
     - Asset tagging for all 12 universe assets.
     - Macro tagging (`ETF`, `SEC`, `MACRO`).
     - Strict word-boundary checks and case-sensitive collisions (e.g., "second" must not trigger `SEC`, "linked" must not trigger `LINK`).
   - `__tests__/marketStore.test.ts`:
     - Initial state shape.
     - `shallowEqual` utility (primitives, arrays, objects).
     - Store state update, notification listeners, and symbol reset preserving `tickers`.
   - `__tests__/alerts.test.ts`:
     - Per-symbol alert evaluation against `tickers`.
     - Above/below condition triggers.
     - Proof of active chart switch immunity (BTC alert does not fire when switching to SOL).
3. **GitHub Actions Workflow**:
   - `.github/workflows/ci.yml` running on `push: [main]` and `pull_request: [main]`.
   - Matrix/Job executing:
     1. Checkout repo
     2. Setup Node.js 20 with npm cache
     3. `npm ci`
     4. `npm run typecheck`
     5. `npm run test`
     6. `npm run build`

## Acceptance Checklist
- [x] `vitest` installed and configured with path aliases (`vitest.config.mts`).
- [x] Comprehensive unit test suites created under `__tests__/` (6 test files, 43 tests).
- [x] `npm run test` passes 100% of tests in ~400ms.
- [x] `.github/workflows/ci.yml` configured and valid.
- [x] `npm run typecheck` passes with 0 errors.
- [x] `npm run build` passes with 0 errors.

## Implementation Notes
- **Vitest Setup**: Installed `vitest` and `vite` as devDependencies. Created `vitest.config.mts` using `import.meta.dirname` to resolve `@/*` aliases without CommonJS/ESM warnings. Added `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`.
- **Test Suites (43 tests total)**:
  - `__tests__/symbols.test.ts` (11 tests): Tested UNIVERSE mapping, `toBinanceSymbol`, aliases (`GOLD/USDT` -> `XAUUSDT`, `OIL/USDT` -> `CLUSDT`), `toLabel`, `isFuturesSymbol`, `isChartable`, `resolvePrefix`.
  - `__tests__/indicators.test.ts` (8 tests): Tested SMA sliding window averages, EMA exponential weighting and seeding, RSI gain/loss boundary limits, MACD 12/26/9 line and histogram calculations, Bollinger Bands upper/middle/lower standard deviation spans, and Stochastic RSI %K/%D bounds.
  - `__tests__/heikenAshi.test.ts` (3 tests): Tested initial candle calculations, recursive open/close smoothing, and high/low envelope clamping.
  - `__tests__/newsTags.test.ts` (10 tests): Tested base symbol extraction, crypto and commodity tags, macro topics (ETF, SEC, MACRO), and collision protection against common English words ("second", "linked", "solid").
  - `__tests__/marketStore.test.ts` (7 tests): Tested `shallowEqual` primitives/arrays/objects, partial updates via `setState`, subscriber notifications, and universe `tickers` retention across symbol/interval resets.
  - `__tests__/alerts.test.ts` (4 tests): Verified per-symbol alert evaluation immunity against active chart switches (setting BTC alert and charting SOL does not misfire), crossing triggers, commodity alerts, and inactive/triggered state filtering.
- **Bug Caught by Tests**:
  - `lib/symbols.ts` `toBinanceSymbol`: Previously contained a bug where passing an already-resolved Binance symbol like `"BTCUSDT"` returned `BY_SYMBOL.get(upper)` which mapped to `"BTC/USDT"` (the label) instead of `"BTCUSDT"`. Fixed by checking `if (BY_SYMBOL.has(upper)) return upper;`.
- **GitHub Actions Workflow**:
  - Created `.github/workflows/ci.yml` to automatically run `typecheck`, `test`, and `build` on Node 20 on all pushes and PRs to `main`.
