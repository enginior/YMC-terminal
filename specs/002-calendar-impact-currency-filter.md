# 002 — Economic Calendar Impact & Currency Filter

**Status:** Ready
**Priority:** P4 · **Effort:** S
**Depends on:** —

## Goal
Let the user filter the economic calendar by currency (USD, EUR, …) and by minimum
importance (High only vs. High + Medium). Save the choice across reloads.

## Context
- `app/api/calendar/route.ts` fetches
  `biquote.io/api/calendar?importance=high&countries=US,EU,GB,JP,CN,AU,CA,CH,NZ`,
  normalises it, and **drops the importance field**.
- `components/EconomicCalendarPanel.tsx` takes no props, polls every 5 min, header
  is hard-coded `Economic Calendar · High Impact`.
- localStorage persistence must follow the **skip-exactly-one-save** pattern in
  AGENTS.md (see `useAlerts` `skipNextSaveRef`).

## Requirements
1. The route returns both high and medium events. Each event has
   `importance: "high" | "medium"`.
2. Panel header gets two compact controls (same style as the News sentiment pills):
   - **Impact:** `HIGH` | `HIGH+MED` (single choice). Default `HIGH`.
   - **Currency:** `ALL` plus one pill per currency **present in the loaded data**,
     in this fixed order where present: USD, EUR, GBP, JPY, CNY, AUD, CAD, CHF, NZD.
     Multi-select. Selecting `ALL` clears the others. Deselecting the last one
     falls back to `ALL`.
3. Header title reflects the impact choice: `Economic Calendar · High` /
   `Economic Calendar · High + Med`.
4. Each row gets a 6px importance dot: high = `theme.red`, medium = `theme.yellow`.
5. Filters persist to localStorage key `btc-terminal:calendar-filters` as
   `{ impact: "high" | "medium", currencies: string[] }` (empty array = ALL).
   - Load in `useEffect` (hydration safety), skip exactly one save.
   - Ignore unknown/corrupt values and fall back to the defaults.
6. Empty state when filters match nothing:
   `No events for USD · High in this window`. If the feed failed, keep the existing
   `Calendar feed unavailable` message. Never invent events.
7. With default filters, the panel looks exactly like today plus the dots.

## Technical approach

### Route — verify the upstream first
biquote.io's importance parameter format is **unverified**. Before coding:
1. Fetch `…?importance=high,medium&countries=…` and inspect the raw JSON:
   does it return medium events, and what is the per-event importance field called
   (`importance`, `impact`, a number)?
2. If a comma list is not supported, make **two parallel requests**
   (`importance=high`, `importance=medium`) with `Promise.allSettled`. Merge them and
   dedupe on `time + name + currency`. If only one succeeds, return that one (partial
   data is real data). Return 502 only if both fail.
3. Map whatever upstream field exists to `"high" | "medium"`. If an event has no
   importance field, use the request it came from.

Record what you found in **Implementation notes**.

Keep `cache: "no-store"` upstream + `s-maxage=300` on the response, and
`AbortSignal.timeout(8000)` per request.

### Panel `components/EconomicCalendarPanel.tsx`
- Extend `EconEvent` with `importance`.
- Filter state + persistence inside the component (it's self-contained, no need
  to lift to `page.tsx`).
- Derive the currency pill list with `useMemo` from `events`.
- Filtering is client-side only; the poll interval and fetch URL stay the same.
- All colours from `useTheme()`; the header must still fit in the narrow left rail
  (col-span-2). If the pills overflow, let the currency row scroll horizontally
  (`overflow-x-auto`, no wrap) rather than growing the header.

## Out of scope
- Low-importance events.
- Country selection beyond the existing 9 in the upstream URL.
- Calendar → chart markers, countdowns, or notifications.

## Acceptance checklist
- [ ] `npm run build` passes
- [ ] `/api/calendar` returns events with `importance`, both levels present (when upstream has them)
- [ ] Default view = today's high-impact list + dots
- [ ] HIGH+MED shows more rows; USD-only hides non-USD rows
- [ ] Reload keeps the filter choice (also in dev StrictMode)
- [ ] Corrupt localStorage value → defaults, no crash
- [ ] Header stays one line high in the left rail at 1280px wide

## Docs to update
- AGENTS.md / PROJECT.md / README.md: add `btc-terminal:calendar-filters` to the
  localStorage key lists, and to the skip-one-save list in AGENTS.md.
- README.md "Analysis panels → Economic Calendar": mention the filters.
- UPDATE_PHASE.md: mark "Symbol-Specific News Filtering & Calendar Impact Filter"
  ✅ once 001 is also done.

## Implementation notes
_(implementer fills in — include the biquote importance param/field findings)_
