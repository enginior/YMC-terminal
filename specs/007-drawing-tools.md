# 007 — New Drawing Tools

**Status:** Done  
**Priority:** P1 · **Effort:** L  
**Depends on:** 005 (Chart Modularization), 006 (TradingView Layout)

## Goal
Expand the terminal's charting capability by introducing standard professional drawing tools into `lib/drawings.ts`: Extended Rays, Horizontal Rays, Directed Arrows, Fibonacci Retracements, Parallel Channels, and Long/Short Position Risk-Reward tools with perpetual liquidation metrics.

## Context
Spec 006 introduced the TradingView-style left drawing rail with grouped flyout categories. Currently, only basic Horizontal Levels (`level`), Trendlines (`trend`), Boxes (`rect`), and Rulers (`ruler`) exist. 

Perps traders require:
1. **Rays and Horizontal Rays** for key support/resistance boundaries that extend forward in time.
2. **Arrows** for trade direction and liquidity targets.
3. **Fibonacci Retracement** for golden pocket (0.618 / 0.5 / 0.382) swing analysis.
4. **Parallel Channels** for ascending/descending channel trading.
5. **Long & Short Position Tools** with live entry, take-profit, stop-loss, risk-to-reward (R:R) ratio, and perpetual liquidation distance calculation.

## Requirements

### 1. New Tool Types in `lib/drawings.ts`
Extend `DrawingTool` type:
```ts
export type DrawingTool =
  | "level"
  | "trend"
  | "rect"
  | "ruler"
  | "ray"
  | "hray"
  | "arrow"
  | "fib"
  | "channel"
  | "long"
  | "short";
```

### 2. Geometry & Rendering Specifications
1. **Extended Ray (`ray`)**:
   - Originates at anchor 1 `(time1, price1)`, passes through anchor 2 `(time2, price2)`, and projects to the right pane edge.
   - Live drag preview and endpoint selection handles.
2. **Horizontal Ray (`hray`)**:
   - Originates at anchor 1 `(time1, price1)` and projects horizontally to the right edge at `price1`.
   - Displays price chip on the right scale.
3. **Arrow (`arrow`)**:
   - Segment from anchor 1 to anchor 2 with a geometric arrowhead at anchor 2.
4. **Fibonacci Retracement (`fib`)**:
   - Anchored at swing extreme 1 `(time1, price1)` and extreme 2 `(time2, price2)`.
   - Calculates standard ratios: `0.0`, `0.236`, `0.382`, `0.5`, `0.618`, `0.786`, `1.0`.
   - Renders horizontal level lines with ratio and price tags (e.g., `0.618 ($82,450.00)`).
   - Renders shaded golden pocket zone between `0.382` and `0.618`.
5. **Parallel Channel (`channel`)**:
   - Base trendline connecting anchor 1 and anchor 2.
   - Parallel boundary channel with symmetrical offset and translucent channel fill.
6. **Long & Short Position Tools (`long` / `short`)**:
   - Anchor 1 sets Entry Price.
   - Anchor 2 sets Target Price (Take Profit).
   - Auto-computes Stop Loss at 1:2 default R:R ratio (or user drag).
   - Renders green Take Profit region and red Stop Loss region.
   - Shows badge with:
     - Target Gain: `+$... (+...%)`
     - Stop Loss: `-$... (-...%)`
     - Risk / Reward: `R:R 2.00`
     - Estimated 20x Liquidation distance: `-4.5%`

### 3. Hit-Testing & Selection
- All new tools support accurate pixel hit-testing (`hitTestDrawing`), hover highlighting, selection handles, and deletion (via ✕ handle, Delete button, or `Del`/`Backspace` key).

### 4. Left Drawing Rail Integration (`components/chart/DrawingRail.tsx`)
- **Lines Group**: Trendline, Ray, Horizontal Ray, Horizontal Level, Arrow (with tool memory).
- **Fib Group**: Fibonacci Retracement.
- **Shapes Group**: Rectangle, Parallel Channel (with tool memory).
- **Positions Group**: Long Position, Short Position (with tool memory).
- **Measure Group**: Delta Ruler.

## Acceptance Checklist
- [x] `npm run typecheck` passes with 0 errors.
- [x] `npm run test` passes 100% of Vitest unit tests (49/49 across 7 suites).
- [x] `npm run build` compiles all 12 routes cleanly.
- [x] All 7 new drawing tools render correctly on the canvas.
- [x] Hit testing, hover highlight, selection, and deletion work for all tools.
- [x] Grouped flyouts in `DrawingRail` remember last selected tool per category.
- [x] Long/Short position tool accurately displays R:R and perpetual liquidation metrics.
- [x] All AGENTS.md chart constraints preserved.
- [x] Documentation updated (`AGENTS.md`, `PROJECT.md`, `specs/README.md`).

## Docs to Update
- `AGENTS.md`: Update drawing tools documentation.
- `PROJECT.md`: Document new drawing tools.
- `specs/README.md`: Mark Spec 007 as Done.

## Implementation Notes
- Extended `DrawingTool` in `lib/drawings.ts` to include 7 new tools: Extended Ray (`ray`), Horizontal Ray (`hray`), Arrow (`arrow`), Fibonacci Retracement (`fib`), Parallel Channel (`channel`), Long Position (`long`), and Short Position (`short`).
- All tools use the backward/forward-compatible 2-anchor schema `(time1, price1, time2, price2)`, ensuring full persistence without schema migration.
- Implemented high-DPI canvas rendering for:
  - Fibonacci Retracement: 7 standard ratio levels (`0.0`, `0.236`, `0.382`, `0.5`, `0.618`, `0.786`, `1.0`), golden pocket shading between 0.382 and 0.618, and ratio/price badges.
  - Parallel Channel: Centerline, upper and lower parallel lines with customizable offset, and translucent channel fill.
  - Long & Short Position: Green Target zone, Red Stop zone, auto 1:2 R:R calculation, entry line, target gain %, stop loss %, and 20x liquidation warning distance.
  - Arrow: Triangular vector arrowhead.
  - Extended Ray & Horizontal Ray: Extrapolated pane-edge lines and price chips.
- Added comprehensive unit test suite in `__tests__/drawings.test.ts` (6 tests covering geometry, hit testing, and delete handles).
- Updated `DrawingRail.tsx` with categorized flyouts for Lines, Fibonacci, Shapes, and Positions with tool memory per group.
