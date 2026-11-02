# 008 — Drawing Properties & History (Undo/Redo)

**Status:** Complete  
**Priority:** P1 · **Effort:** M  
**Depends on:** 005 (Chart Refactor), 006 (TradingView Layout), 007 (New Drawing Tools)

## Goal
Transform terminal drawings from static shapes into fully editable objects with an undo/redo history engine (`Ctrl+Z` / `Ctrl+Y`), per-drawing customization popover (color, stroke width, dashed/dotted line style, lock), draggable anchor handles, and a versioned `localStorage` schema migration.

## Context
With Specs 005, 006, and 007 complete, the terminal has 11 drawing tools accessible from a TradingView-style left rail. However, drawings currently cannot be modified after being drawn: changing a line's color or adjusting an endpoint requires deleting it and redrawing from scratch. Additionally, accidental deletions or misplacements cannot be undone.

## Requirements

### 1. Undo / Redo History Engine
1. Maintain an undo stack and redo stack for drawings state per symbol.
2. Pushing actions:
   - Creating a new drawing.
   - Deleting a drawing (or clear all).
   - Modifying a drawing (color, line width, line style, or anchor drag).
3. Hotkeys:
   - `Ctrl+Z` (or `Cmd+Z`): Undo the last drawing action.
   - `Ctrl+Y` or `Ctrl+Shift+Z` (or `Cmd+Shift+Z`): Redo the last undone action.
4. UI Action buttons:
   - Provide Undo (`↩`) and Redo (`↪`) buttons on the DrawingRail bottom utilities strip with disabled state when empty.

### 2. Draggable Anchor Handles (Edit Anchors)
1. When a drawing is selected, anchor points display interactive resize handles.
2. Clicking and dragging an anchor handle (`a1` or `a2`) moves the endpoint in real time with OHLC magnet snapping.
3. Releasing pointer commits the edit and records a history snapshot for undo/redo.

### 3. Floating Drawing Properties Toolbar (`components/chart/DrawingPropertiesBar.tsx`)
1. Mounts when a drawing is selected (`selectedId !== null`).
2. Sits cleanly above the selected drawing or docked at the top-center of the chart canvas.
3. Controls:
   - **Color Palette**: Quick color swatches (Yellow, Blue, Green, Red, Purple, Cyan, White).
   - **Line Width**: `1px`, `2px`, `3px`.
   - **Line Style**: Solid (`solid`), Dashed (`dashed`), Dotted (`dotted`).
   - **Individual Lock**: Toggle lock on this drawing (prevents dragging).
   - **Delete Button**: Instant delete handle (`✕`).
   - **Close Button**: Deselect.

### 4. Schema Migration & Versioning
1. Extend `Drawing` type in `lib/drawings.ts`:
   ```ts
   export type LineStylePattern = "solid" | "dashed" | "dotted";
   export interface Drawing {
     id: string;
     tool: DrawingTool;
     time1: number;
     price1: number;
     time2: number;
     price2: number;
     color: string;
     lineWidth?: number;
     lineStyle?: LineStylePattern;
     locked?: boolean;
   }
   ```
2. Persisted storage schema versioning:
   - If `localStorage.getItem("btc-terminal:drawings")` is in legacy format `Record<string, Drawing[]>`, seamlessly migrate to `{ version: 1, symbols: Record<string, Drawing[]> }`.
   - Never lose or corrupt existing saved drawings.

## Technical Approach
- Extend `lib/drawings.ts` with `drawingAnchorPoints`, `hitTestAnchor`, and support for `lineWidth` and `lineStyle`.
- Create `components/chart/DrawingPropertiesBar.tsx`.
- Update `components/chart/useDrawings.ts` with undo/redo stacks, anchor drag handling, and property updates.
- Update `components/chart/DrawingRail.tsx` to include Undo and Redo buttons.
- Update `components/PriceChart.tsx` to render `DrawingPropertiesBar`.
- Add unit tests in `__tests__/drawings.test.ts` for schema migration, anchor hit-testing, and property updates.

## Out of Scope
- Global object tree panel sidebar (reserved for future).
- Multi-selection of multiple drawings simultaneously.

## Acceptance Checklist
- [x] `npm run typecheck` passes with zero errors.
- [x] `npm run test` passes 100% of Vitest tests (55/55 passing).
- [x] `npm run build` compiles all routes cleanly (12/12 static & dynamic routes).
- [x] Selecting a drawing displays the floating properties toolbar (`components/chart/DrawingPropertiesBar.tsx`).
- [x] Color, line width (`1px`, `2px`, `3px`), and dashed/dotted style updates render immediately on canvas.
- [x] Dragging anchor handles (`a1` / `a2`) updates drawing geometry in real time with OHLC magnet snapping.
- [x] Undo (`Ctrl+Z` / `↩`) and Redo (`Ctrl+Y` / `Cmd+Shift+Z` / `↪`) work accurately across creations, edits, anchor moves, and deletions.
- [x] Schema versioning (`{ version: 1, symbols: ... }`) migrates legacy localStorage data cleanly without data loss.
- [x] Documentation updated (`AGENTS.md`, `PROJECT.md`, `specs/README.md`).

## Docs to Update
- `AGENTS.md`: Update drawing architecture and schema conventions.
- `PROJECT.md`: Document drawing properties, undo/redo, and anchor editing.
- `specs/README.md`: Mark Spec 008 as Done.

## Implementation Notes
- Created `components/chart/DrawingPropertiesBar.tsx` mounted above selected drawings inside the counter-scaled chart wrapper. Features 7 color swatches, 3 stroke widths (`1px`, `2px`, `3px`), 3 line patterns (solid, dashed, dotted), an individual lock toggle, delete button, and deselect button.
- Extended `lib/drawings.ts`:
  - `LineStylePattern`: `"solid" | "dashed" | "dotted"`.
  - `Drawing` schema extended with optional `lineWidth?: number`, `lineStyle?: LineStylePattern`, and `locked?: boolean`.
  - Added `drawingAnchorPoints(d, chart, series, candles)` and `hitTestAnchor(d, p, chart, series, tolerance, candles)`.
  - Added `parsePersistedDrawings(raw)` for transparent v1 migration.
  - Enhanced canvas rendering to apply dynamic `lineWidth` and `resolveDash` across all 11 drawing tools.
- Enhanced `components/chart/useDrawings.ts`:
  - Per-symbol history engine maintaining `past` (up to 50 states) and `future` stacks.
  - Interactive anchor dragging using container `pointerdown` capture listener to prevent lightweight-charts pan collisions, live magnet snapping, and history recording on release.
  - Hotkey listeners for `Ctrl+Z` / `Cmd+Z` (Undo) and `Ctrl+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` (Redo).
- Enhanced `components/chart/DrawingRail.tsx`:
  - Added vector Undo (`↩`) and Redo (`↪`) buttons at bottom utility toolbar with responsive disabled opacity.
- Unit tests added in `__tests__/drawings.test.ts` for schema migration, anchor hit-testing, and property updates.
