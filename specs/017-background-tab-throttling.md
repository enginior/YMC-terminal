# 017 — Background-Tab Polling Throttling & Power Optimization

**Status:** Complete  
**Priority:** P1 · **Effort:** S  
**Depends on:** 003 (Reactive tick store), 004 (Per-symbol alerts)

## Goal
Conserve client CPU, battery life, and API requests by pausing periodic REST polling across the terminal when the browser tab is hidden (`document.visibilityState === "hidden"`), while immediately refreshing data on tab focus and ensuring WebSocket-driven price alerts continue firing in the background.

## Context
Traders often keep the terminal open in a background tab or secondary desktop while working elsewhere. Currently, multiple components run unconditional `setInterval` timers fetching REST endpoints (`/api/ticker`, `/api/comparison`, `/api/sentiment`, `/api/derivatives`, `/api/news`, `/api/calendar`) every 10–60 seconds even when the tab is completely invisible. This consumes unnecessary client energy and Vercel serverless executions. Furthermore, browser throttling of `requestAnimationFrame` while backgrounded can delay store listener execution unless explicitly accounted for.

## Requirements

### 1. Reusable Visibility Polling Hook (`hooks/useVisibilityPolling.ts`)
- Custom React hook `useVisibilityPolling`:
  - Signature: `useVisibilityPolling(callback: () => void | Promise<void>, intervalMs: number, options?: { immediate?: boolean; immediateOnVisible?: boolean })`
  - Active only when `document.visibilityState === "visible"`.
  - On `visibilitychange` transitioning to `hidden`: clears the active interval.
  - On `visibilitychange` transitioning to `visible`: immediately invokes the callback (if `immediateOnVisible !== false`) and restarts the interval.
  - Cleans up timers and event listeners on unmount.

### 2. Integrate Across Terminal Polling Endpoints
Replace raw `setInterval` timers with `useVisibilityPolling` in:
- `app/page.tsx`: `/api/ticker` 24hr stats poll (10s)
- `components/Watchlist.tsx`: `/api/comparison` universe 24h stats & sparklines (15s)
- `components/MarketHeatmapPanel.tsx`: `/api/comparison` heatmap treemap stats (15s)
- `components/MarketSentimentPanel.tsx`: `/api/sentiment` F&G / funding / OI / L-S ratio (30s)
- `components/NewsFeedPanel.tsx`: `/api/news` RSS headlines (60s)
- `components/EconomicCalendarPanel.tsx`: `/api/calendar` macroeconomic events (300s)
- `components/chart/useIndicatorPanes.ts`: `/api/derivatives` historical OI and funding rates (30s)

### 3. Background Alert Continuity in `lib/marketStore.ts`
- In `scheduleNotify()`:
  - If `document.visibilityState === "hidden"`, dispatch via `setTimeout(notify, 500)` rather than waiting for `requestAnimationFrame` (which browsers suspend when hidden).
  - Ensures price alerts and desktop notifications continue firing reliably when price thresholds are hit while tab is in background.

### 4. Acceptance Checklist
- [x] `useVisibilityPolling` hook created and handles hidden/visible lifecycle transitions cleanly.
- [x] REST polling across all panels stops when tab is hidden and refreshes immediately when tab becomes visible.
- [x] `marketStore` dispatches notifications in background mode so alerts remain active.
- [x] `npm run typecheck`, `npm run test`, and `npm run build` pass with 0 errors.
