# 006 — TradingView-Style Layout

**Status:** Done  
**Priority:** P1 · **Effort:** M  
**Depends on:** 005 (Chart Modularization Refactor)

## Goal
Transform the chart workstation layout into a TradingView-style interface by introducing a vertical left-hand drawing rail with grouped flyout tools (Lines, Shapes, Measure), quick-access drawing actions (Magnet, Lock, Hide, Clear), and a decluttered top header featuring favorite timeframes, visual chart-type picker, and an `ƒx Indicators` search and toggle dialog.

## Context
With Spec 005 complete, `PriceChart.tsx` was modularized into clean submodules under `components/chart/`. However, the chart toolbar currently stretches horizontally across the top with all 8 timeframe buttons, 4 separate drawing buttons, and raw checkboxes. 

Standard professional charting stations (TradingView, Bloomberg) place drawing tools vertically along the left canvas edge, grouped by category (Trend/Level lines, geometric shapes, measurement tools), and house technical indicators in an interactive modal dialog with instant search.

## Requirements

### 1. Left Vertical Drawing Rail (`components/chart/DrawingRail.tsx`)
1. Fixed-width vertical toolbar (`~38px` wide) positioned along the left edge of the chart container, outside the canvas counter-scale wrapper.
2. **Grouped Tool Buttons**:
   - **Lines Group**: Remembers last active tool (`trend` or `level`, default `trend`). Includes a flyout arrow trigger to open a submenu with Trendline (`╱`) and Horizontal Level (`─`).
   - **Shapes Group**: Rectangle / Box (`rect` ▭). Extensible for future shapes.
   - **Measure Group**: Delta Ruler (`ruler` 📐).
   - Clicking a group icon toggles that tool on/off. Clicking the flyout trigger opens the popover to switch tools and activates the selection.
3. **Bottom Utilities**:
   - **Magnet Mode (🧲)**: Toggles OHLC snapping on/off with clear active styling.
   - **Lock Drawings (🔒 / 🔓)**: When locked, drawings cannot be hovered, selected, dragged, or deleted by accidental clicks.
   - **Hide / Show All Drawings (👁 / 👁‍🗨)**: Toggles rendering visibility of all drawings on the canvas without clearing them.
   - **Clear All Drawings (🗑️)**: Clears all drawings for the current symbol with a clean confirmation or action.
   - **Delete Selected (✕)**: Appears or activates when an individual drawing is selected (in addition to `Del`/`Backspace` hotkeys).
4. Full theme integration: all icons, borders, backgrounds, and hover states use `theme` from `useTheme()`.
5. Accessible tooltips describing each tool and hotkeys.

### 2. Top Header Upgrade (`components/chart/ChartHeader.tsx`)
1. **Favorite Timeframes**:
   - Primary quick strip displaying standard favorites: `1m`, `5m`, `15m`, `1h`, `4h`, `1d`.
   - Secondary "More" dropdown (`···` or `▾`) revealing remaining intervals (`30m`, `2h`, etc.) with active state indication when selected.
2. **Chart Visuals Dropdown**:
   - Retain and polish the Candlestick / Heikin Ashi / Line visual selector dropdown.
3. **`ƒx Indicators` Search Dialog (`components/chart/IndicatorsModal.tsx`)**:
   - Replace the cluttered inline dropdown with a dedicated modal dialog triggered by `ƒx Indicators`.
   - Displays active indicator count badge (e.g., `ƒx Indicators (2)`).
   - Real-time search filter input to quickly find indicators by name or tag.
   - Grouped sections:
     - **Price Overlays**: SMA 20, SMA 50, EMA 20, EMA 50, Bollinger Bands (20, 2).
     - **Oscillators (Sub-Panes)**: RSI (14), MACD (12, 26, 9), Stochastic RSI (14, 14, 3, 3).
   - Clean toggle switches/checkboxes with instant real-time chart update.
   - "Clear All" or "Default" action to reset indicators quickly.
   - Keyboard accessible: closes on `Esc` or click outside.
4. **Header Utilities**:
   - Retain `VOL`, `DAY`, `H/L` toggles.
   - Retain `📷 Snap`, `📥 CSV`, and `⤢ Max` / `✕ Restore`.

### 3. Drawing Primitive & Hook Enhancements
1. Extend `DrawingsPrimitive` in `lib/drawings.ts`:
   - Support `hidden` state (`setHidden(hidden: boolean)`): suppress rendering of saved drawings when hidden is true.
2. Extend `useDrawings.ts`:
   - Support `locked` state (`isLocked: boolean`): suppress hover, selection, and deletion when locked.
   - Support `hidden` state (`isHidden: boolean`): propagate to `DrawingsPrimitive`.
   - Provide `lastLineTool` memory (`"trend" | "level"`).

## Technical Approach
- Create `components/chart/DrawingRail.tsx` for the vertical drawing toolbar.
- Create `components/chart/IndicatorsModal.tsx` for the `ƒx Indicators` dialog.
- Update `components/chart/ChartHeader.tsx` to streamline timeframes and hook into `IndicatorsModal`.
- Update `lib/drawings.ts` to support visibility toggle (`hidden`).
- Update `components/chart/useDrawings.ts` to support lock and hide states.
- Update `components/PriceChart.tsx` to layout `DrawingRail` side-by-side with the chart canvas.

## Out of Scope
- Adding new drawing geometry types like Fibonacci or Parallel Channel (reserved for Spec 007).
- Changing indicator parameter calculation algorithms (reserved for Spec 010).

## Acceptance Checklist
- [x] `npm run typecheck` passes with zero errors.
- [x] `npm run test` passes 100% of Vitest unit tests.
- [x] `npm run build` compiles all routes cleanly.
- [x] Drawing rail renders vertically on the left with grouped tool flyouts (Lines, Shapes, Measure).
- [x] Tool groups remember the last selected tool.
- [x] Magnet, Lock, Hide, and Delete utilities on the rail function properly.
- [x] Top header displays favorite timeframes + "More" dropdown.
- [x] `ƒx Indicators` modal opens with live search and categorized toggles for overlays and oscillators.
- [x] Counter-scale transform and canvas coordinate precision remain 100% intact.
- [x] AGENTS.md, PROJECT.md, and specs/README.md updated.

## Docs to Update
- `AGENTS.md`: Update chart architecture and conventions.
- `PROJECT.md`: Document TradingView layout, DrawingRail, and IndicatorsModal.
- `specs/README.md`: Mark Spec 006 as Done.

## Implementation Notes
- Created `components/chart/DrawingRail.tsx` featuring vertical left toolbar (~40px) with flyout tool selection (Lines, Shapes, Measure), tool memory (`lastLineTool`), and bottom utilities (Magnet snap, Lock drawings, Hide drawings, Delete selected, and Clear all).
- Created `components/chart/IndicatorsModal.tsx` modal dialog triggered by `ƒx Indicators` with instant search filter, categorized sections (Overlays vs Oscillators), status badges, and active count.
- Upgraded `components/chart/ChartHeader.tsx` to streamline timeframes into favorite quick strip (`1m`, `5m`, `15m`, `1h`, `4h`, `1d`) plus a "···" / "▾" dropdown for secondary intervals (`30m`, `2h`), and removed cluttered drawing buttons from the top bar.
- Extended `lib/drawings.ts` `DrawingsPrimitive` with `setHidden(hidden: boolean)` to toggle canvas rendering of drawings.
- Extended `components/chart/useDrawings.ts` to support lock mode (disables hover/selection/deletion) and hide mode.
- Verified all 10 AGENTS.md chart constraints remain strictly enforced. Zero regressions on unit tests (43/43 pass) and type checks.
