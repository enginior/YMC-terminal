# 015 — Market Sessions & Global Trading Hours Panel

**Status:** Complete  
**Priority:** P1 · **Effort:** M  
**Depends on:** 000 (Baseline audit), 003 (Tick store render isolation)

## Goal
Replace the redundant BTC/ETH correlation widget with a high-density, real-time **Market Sessions & Trading Hours Panel** modeled after the Forex Factory Sessions visualizer. The panel plots global trading sessions (Sydney, Tokyo, London, New York) along a 24-hour horizontal timeline anchored to the user's local timezone (e.g. PHT, UTC+8) and automatically accounts for Daylight Saving Time (DST) shifts year-round.

## Context
Perpetual crypto traders and macro market participants rely on traditional equity bell opens and interbank forex sessions to anticipate market volatility, liquidity injections, and institutional trading flows:
- **Sydney**: Australian open / early Asian Pacific liquidity.
- **Tokyo**: Asian liquidity hub / Bank of Japan session.
- **London**: European open / highest volume interbank forex overlaps.
- **New York**: US cash equities open (9:30 AM ET bell) where Bitcoin ETF flows, CME futures volume, and TradFi market participants enter.

Previously, the terminal featured a `CorrelationPanel` displaying rolling 30-day BTC/ETH correlation with placeholder cards for TradFi assets. Users noted this was insignificant compared to knowing exactly when global market sessions open, overlap, and close in their local time.

## Requirements

### 1. Automatic Timezone & Daylight Saving Time (DST) Engine (`lib/sessions.ts`)
- Use native IANA timezone identifiers (`America/New_York`, `Europe/London`, `Asia/Tokyo`, `Australia/Sydney`) via `Intl.DateTimeFormat`.
- Compute exact UTC session start and end times for any date, automatically accounting for summer/winter clock changes (e.g., US EDT $\leftrightarrow$ EST, UK BST $\leftrightarrow$ GMT, Australia AEDT $\leftrightarrow$ AEST).
- Convert session schedules into the user's detected local timezone (e.g., New York 9:30 AM ET $\to$ 10:30 PM PHT in winter EST, 9:30 PM PHT in summer EDT).
- Provide session modes:
  - **Equities (Cash Bell)**: NYSE/NASDAQ (9:30 AM - 4:00 PM ET), LSE (8:00 AM - 4:30 PM GMT/BST), TSE (9:00 AM - 3:30 PM JST), ASX (10:00 AM - 4:00 PM AEST/AEDT).
  - **Forex (Interbank Cascade)**: Sydney (7:00 AM - 4:00 PM), Tokyo (9:00 AM - 6:00 PM), London (8:00 AM - 5:00 PM), New York (8:00 AM - 5:00 PM).

### 2. Interactive Sessions Visualizer (`components/MarketSessionsPanel.tsx`)
- **24-Hour Horizontal Timeline Canvas**:
  - Horizontal axis calibrated to the user's local day with tick marks every 2 hours.
  - 4 stacked horizontal session track bars for Sydney, Tokyo, London, and New York.
  - Active/open sessions rendered in vibrant green (`theme.green`) with high contrast text.
  - Inactive/closed sessions rendered in dark translucent panel tones (`${theme.dim}20`).
  - City name and live city local time inside each bar (e.g. `London 12:07pm local`, `New York 7:07am local`).
  - Vertical glowing cursor line spanning across the tracks indicating current time `NOW`.
- **Session Details Cards**:
  - Pulse status indicator (`OPEN` in green, `CLOSED` in gray).
  - Remaining time countdown: `Closes in Xh Ym` / `Opens in Xh Ym`.
  - Converted local session hours with timezone label (e.g. `10:30 PM - 05:00 AM PHT`).
  - City current time with zone abbreviation (e.g. `07:15 AM EST`).
- **Live 1-second Tick**:
  - Updates cursor position and countdown timers continuously without external network calls.

### 3. Terminal Integration & Layout Migration
- Update `app/page.tsx`:
  - Replace `"correlation"` with `"sessions"` in `DEFAULT_ORDER`.
  - In `loadOrder()`, gracefully map legacy `"correlation"` entries in `localStorage` to `"sessions"`.
  - Render `<MarketSessionsPanel />` inside grid panels, maximized view, and mobile layout.
- Remove redundant files: `components/CorrelationPanel.tsx` and `app/api/correlation/route.ts`.
- Update `app/about/page.tsx`, `AGENTS.md`, `PROJECT.md`, and `README.md`.

### 4. Acceptance Checklist
- [x] `lib/sessions.ts` correctly computes open/close times and DST shifts across all 4 sessions.
- [x] `MarketSessionsPanel` renders 24-hour visual tracks, glowing NOW cursor line, and active session highlights.
- [x] Converted local times match user expectations (e.g. NY 9:30 AM ET = 10:30 PM PHT in winter EST).
- [x] Toggling between Equities and Forex adjusts session start and end times dynamically.
- [x] Unit tests pass in `__tests__/sessions.test.ts` (8/8 tests).
- [x] `npm run typecheck`, `npm run test`, and `npm run build` succeed with 0 errors.
