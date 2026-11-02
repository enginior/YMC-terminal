# 016 — Market Sessions: Time-Math Fix, Wrap-Around Bars & Widget Layout

**Status:** Complete  
**Priority:** P0 (correctness) + P1 (layout) · **Effort:** M  
**Depends on:** 015

## Goal
Make the Market Sessions panel **correct**: right OPEN/CLOSED status and countdowns
for every session, in every DST period. Make it **fit**: no overflowing text or
cut-off bars in its 1-column widget slot, while still using the extra space when
maximized or on mobile.

## Context — advisor review of 015 (`c3629ec`)
The DST engine is the right approach: IANA zones with `Intl` and no hard-coded
offsets. The hour conversions are correct. But review and a reproduction script
found these defects:

### Bug 1 — Asian sessions close 24h late (P0)
`getSessionUtcTime()` corrects the UTC guess by `diffMinutes` **without
normalising across midnight**. When the target hour is later in the day than the
zone's UTC offset allows (Tokyo ≥ 15:00, Sydney ≥ 13:00), the formatted hour wraps
to the next day. The diff then comes out +24h too large.

Reproduced on Mon 2026-11-02 11:00 PHT:

| Session | Computed open (PHT) | Computed close (PHT) | Length |
|---------|---------------------|----------------------|--------|
| Sydney FX | Mon 04:00 | **Tue** 13:00 | **33h** ✗ |
| Tokyo FX | Mon 08:00 | **Tue** 17:00 | **33h** ✗ |
| ASX | Mon 07:00 | **Tue** 13:00 | **30h** ✗ |
| TSE | Mon 08:00 | **Tue** 14:30 | **30.5h** ✗ |
| London / LSE / NY / NYSE | correct | correct | ✓ |

**Visible effect:** Sydney and Tokyo show **OPEN** from their open until local
midnight, with countdowns like `Closes in 29h 50m`. The existing tests only assert
`getUTCHours()` on opens, so they miss it.

### Bug 2 — Bars that cross the timeline edge get cut off
The timeline starts at 07:00 local. Any session that crosses that point
(`endPct <= startPct`) is clamped to `100 - startPct`, and the part after 07:00 is
**dropped**. For UTC+8 that is Sydney FX every day of the year
(04:00–13:00 / 05:00–14:00 PHT): only the 04:00–07:00 sliver shows at the far right.

### Bug 3 — Ruler labels don't line up with the bars
The 12 hour labels use `flex justify-between`, which places label *i* at
`i/11` instead of `i/12`. The last label (`5am`) sits at 100% when it belongs at
91.7%. The drift grows left → right, so the NOW cursor and bars don't line up with
the scale.

### Layout — overflow in widget form
The widget slot is ~230–320 px wide (one column of the `col-span-3` 2-column grid)
and 200 px tall (192 px after the grip). The current layout needs ~480 × 380 px:
- Header: badge + title + tz pill + `9:24:40 PM` + `Equities|Forex` all on one
  `justify-between` row with no `min-w-0` → overflows horizontally.
- 12 ruler labels × ~26 px ≈ 310 px → labels overlap.
- Bar labels (`New York 7:07am local`) don't fit in narrow bars.
- 2-column cards with `Local Hours: 10:30 PM – 5:00 AM` overflow each card.

### Minor
- `#000000` / `rgba(0,0,0,0.85)` hard-coded text colours. AGENTS.md: all colours from `useTheme()`.
- `py-0.2` isn't a Tailwind class (no-op).
- About 30 `Intl.DateTimeFormat` instances are constructed per second (1 Hz tick × 4 sessions × several formatters).
- Mode (Equities/Forex) isn't persisted.
- Asia/Manila's `timeZoneName: "short"` renders `GMT+8`, not `PHT`.

## Reference — correct session times in UTC+8 (test oracle)

Session definitions are unchanged (city-local hours from `MARKET_SESSIONS`):
FX: Sydney 07–16, Tokyo 09–18, London 08–17, New York 08–17.
Equities: ASX 10:00–16:00, TSE 09:00–15:30, LSE 08:00–16:30, NYSE 09:30–16:00.

### DST transitions (verified with `Intl` / tzdata)
| Zone | 2026 | 2027 |
|------|------|------|
| New York EST↔EDT | EDT from **Mar 8**, EST from **Nov 1** | EDT **Mar 14**, EST **Nov 7** |
| London GMT↔BST | BST from **Mar 29**, GMT from **Oct 25** | BST **Mar 28**, GMT **Oct 31** |
| Sydney AEST↔AEDT | AEST from **Apr 5**, AEDT from **Oct 4** | AEST **Apr 4**, AEDT **Oct 3** |
| Tokyo JST | no DST (UTC+9) | no DST |

### Forex sessions in PHT (UTC+8)
| Period (Nov 2026 → Nov 2027) | NY | London | Sydney | Sydney FX | Tokyo FX | London FX | NY FX |
|------------------|----|--------|--------|-----------|----------|-----------|-------|
| **Nov 1 → Mar 13** (now) | EST | GMT | AEDT | 04:00–13:00 | 08:00–17:00 | 16:00–01:00 | 21:00–06:00 |
| Mar 14 → Mar 27 (US shifted first) | EDT | GMT | AEDT | 04:00–13:00 | 08:00–17:00 | 16:00–01:00 | **20:00–05:00** |
| Mar 28 → Apr 3 | EDT | BST | AEDT | 04:00–13:00 | 08:00–17:00 | 15:00–00:00 | 20:00–05:00 |
| Apr 4 → Oct 2 | EDT | BST | AEST | 05:00–14:00 | 08:00–17:00 | 15:00–00:00 | 20:00–05:00 |
| Oct 3 → Oct 30 | EDT | BST | AEDT | 04:00–13:00 | 08:00–17:00 | 15:00–00:00 | 20:00–05:00 |
| Oct 31 → Nov 6 (UK shifted first) | EDT | GMT | AEDT | 04:00–13:00 | 08:00–17:00 | **16:00–01:00** | 20:00–05:00 |

### Equities in PHT
| Exchange | Northern winter / AEDT | Northern summer / AEST |
|----------|------------------------|------------------------|
| ASX | 07:00–13:00 (AEDT) | 08:00–14:00 (AEST) |
| TSE | 08:00–14:30 (lunch 10:30–11:30) | same, no DST |
| LSE | 16:00–00:30 (GMT) | 15:00–23:30 (BST) |
| NYSE | **22:30–05:00** (EST) | **21:30–04:00** (EDT) |

Key PHT overlaps (FX, winter → summer): London+NY **21:00–01:00 → 20:00–00:00**.
Tokyo+London 16:00–17:00 → 15:00–17:00. Sydney+Tokyo 08:00–13:00 → 08:00–14:00.

## Requirements

### R1 — Correct zoned-time → UTC conversion (`lib/sessions.ts`)
Replace the single-pass guess with an offset-based two-pass conversion:
```ts
/** Offset of `tz` from UTC at instant `t`, in minutes (e.g. Asia/Manila → +480). */
function tzOffsetMinutes(t: number, tz: string): number; // formatToParts y/m/d/h/m/s → Date.UTC(...) − t
/** Wall-clock y-m-d h:m in `tz` → UTC instant. Two passes to settle DST edges. */
export function zonedTimeToUtc(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  const wall = Date.UTC(y, m - 1, d, h, min);
  const first = wall - tzOffsetMinutes(wall, tz) * 60_000;
  return new Date(wall - tzOffsetMinutes(first, tz) * 60_000);
}
```
- `getSessionUtcTime(date, tz, h, m)` keeps its signature. It derives the
  exchange-local y/m/d of `date`, then calls `zonedTimeToUtc`.
- Note: `hour: "numeric", hour12: false` can return `"24"` at midnight in some
  engines. Use `hourCycle: "h23"`.
- Invariant (assert in tests): for every session on every date,
  `close − open === defined session length` (e.g. 9h FX, 6.5h NYSE).

### R2 — Status semantics
- `isOpen = weekday(open, exchangeTz) ∈ Mon–Fri && open ≤ now < close`, using
  the corrected times.
- After today's close, the countdown must target the **next trading day's** open
  (skipping Sat/Sun in the exchange zone). `getNextOpenUtc` already does this; keep
  it on top of R1.
- TSE lunch (11:30–12:30 JST) in **Equities** mode: status `LUNCH` (use
  `theme.yellow`) with `Resumes in Xm`. On the bar, draw the lunch gap as a
  hatched or dimmed segment. No other exchange gets a lunch break.
- Holidays: **out of scope** (needs a data source). Add a `// TODO(holidays)` in
  `calculateSessionStates`.

### R3 — Wrap-around segments
- `SessionState` replaces `startPct/widthPct` with
  `segments: { startPct: number; widthPct: number }[]` (1 or 2 items).
  A session crossing the timeline edge renders as **two** bars: tail at the right,
  head at the left, both labelled (or the larger one labelled, see R6).
- Keep `TIMELINE_START_HOUR = 7` (Forex Factory convention). The split makes the
  choice of anchor cosmetic.
- Use the **actual open instant's** position, so a 25h/23h DST-transition day
  still draws correctly.

### R4 — Ruler alignment
- Position each tick absolutely at `left: (offsetHours / 24) * 100%` with
  `translateX(-50%)`. The first label is left-aligned, and there's no label at 100%
  (it would duplicate 0%).
- Label density follows container width (R6): every **6h** (compact), **3h**
  (medium), **2h** (wide).
- NOW cursor: thin `theme.green` line plus a small `NOW 21:24` pill at the top.
  Clamp the pill inside the track at the edges (≤ 4% / ≥ 96%).

### R5 — Viewer timezone (UTC+8 and others)
- Keep auto-detection (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
- Show the zone as **`UTC+8`** (computed from `tzOffsetMinutes`), with the IANA
  name (`Asia/Manila`) in the tooltip. Don't rely on `timeZoneName: "short"`, which
  gives `GMT+8` for Manila.
- Add a small tz selector in the expanded layout only: `Auto` | `UTC` | `UTC+8 (Manila)` |
  `UTC+8 (Singapore)` | `UTC+9 (Tokyo)` | `UTC−5/−4 (New York)` | `UTC+0/+1 (London)`.
  Store IANA ids, never fixed offsets, so DST keeps working.
- Persist `{ mode, tz }` to **`btc-terminal:sessions-prefs`** using the
  **skip-exactly-one-save** pattern. Load in `useEffect` (hydration safety).

### R6 — Responsive widget layout (container queries)
Tailwind v4 has container queries built in: put `@container` on the panel root and
use `@sm:` / `@lg:` variants. Breakpoints are **panel width**, not viewport:

| Container width | Mode | Header | Timeline | Below timeline |
|-----------------|------|--------|----------|----------------|
| **< 360 px** (grid widget) | Compact | `SESSIONS` · `21:24 UTC+8` (no seconds) · `EQ`/`FX` segmented toggle | ruler every 6h, bars 12px tall, labels = short code (`SYD` `TYO` `LDN` `NY`) | **4 single-line rows**: dot · code · `OPEN`/`CLOSED`/`LUNCH` · `closes 2h10m` (right-aligned). No local hours (they go in the row's `title`). |
| **360–560 px** | Medium | + tz label, `Equities`/`Forex` words | ruler every 3h, bars 16px, label = city name | rows add local hours `16:00–01:00` |
| **≥ 560 px** (maximized, mobile full width) | Expanded | + seconds, + tz selector | ruler every 2h, bars 20px, name + city clock | current 2×2 / 4×1 detail cards |

Budget for the compact mode must fit **192 px height** without scrolling:
header 22 + ruler 14 + 4 × (12 bar + 3 gap) + 6 pad + 4 × 18 rows ≈ **174 px**.

Overflow rules (apply everywhere):
- Every flex child holding text: `min-w-0` + `truncate` (`overflow-hidden
  text-ellipsis whitespace-nowrap`). Controls (`toggle`, clock) are `shrink-0`.
- All times use `tabular-nums` (no jitter on the 1 Hz tick; AGENTS/Bloomberg rule).
- Bar labels depend on **measured bar width**, not the container breakpoint. A
  `ResizeObserver` on the track gives `trackPx`. For each segment,
  `px = widthPct/100 * trackPx`: ≥ 96 px → name + clock, ≥ 30 px → short code,
  otherwise no label (the tooltip still works).
- Text on an active (green) bar uses `theme.bg`. No hard-coded `#000`.

### R7 — Grid placement
- Change the sessions widget to **`span: 2`** in `renderPanel` (full width of the
  right column, like `news`), with `height: 200`. A timeline needs width more than
  height.
- To avoid a hole in the 2-column grid when a span-2 panel follows an odd number
  of span-1 panels, add `gridAutoFlow: "row dense"` to the right-column grid
  container in `app/page.tsx`.
- The compact layout (R6) is still required: the right column is only ~320 px wide
  at 1280 px screens even with span 2.

### R8 — Performance
- Cache `Intl.DateTimeFormat` instances in a module-level `Map` keyed by
  `tz + JSON(options)`.
- Split the work: `calculateSessionStates` (segments, hours, status) runs when
  the **minute** changes, mode/tz changes, or a countdown crosses zero. The 1 Hz
  tick only updates the clock text and NOW position.
- The 1 Hz interval stops while `document.hidden` and re-syncs on
  `visibilitychange`.

## Out of scope
- Exchange holidays / half-days.
- Adding exchanges (HKEX, SGX, PSE…). Keep `MARKET_SESSIONS` extensible, though,
  since a UTC+8 user may want PSE/HKEX later.
- Chart-side session shading.

## Acceptance checklist
- [x] `npm run typecheck`, `npm run test`, `npm run build` pass
- [x] New tests in `__tests__/sessions.test.ts`:
  - [x] `close − open` equals the defined length for all 8 sessions on: 2026-01-15, 2026-03-20, 2026-04-01, 2026-07-15, 2026-10-28, 2026-11-16, and each DST transition day in the table
  - [x] Every cell of the **Forex in PHT** and **Equities in PHT** tables (`Asia/Manila`)
  - [x] Tokyo FX at Mon 23:30 JST → `CLOSED`, countdown targets Tue 09:00 JST
  - [x] Sydney FX at Fri 17:00 AEDT → `CLOSED`, next open Mon 07:00 AEDT
  - [x] TSE at 12:00 JST weekday (equities) → `LUNCH`
  - [x] Wrap: Sydney FX in `Asia/Manila` → 2 segments whose widths sum to 9/24 × 100
  - [x] Ruler tick *i* (2h) at `i × 8.333%`
- [x] Widget at 240×192 px and 320×192 px: no horizontal scrollbar, no overlapping
  text, no vertical scroll. Check in DevTools by resizing the right column / zooming.
- [x] Maximized and mobile (<900 px) show the expanded layout
- [x] Reload keeps mode + tz (dev StrictMode too)
- [x] No hard-coded colours remain in `MarketSessionsPanel.tsx`

## Docs to update
- AGENTS.md: architecture line for `lib/sessions.ts` ("two-pass zoned→UTC, wrap
  segments"); add `btc-terminal:sessions-prefs` to localStorage keys and the
  skip-one-save list; note "Sessions panel uses Tailwind container queries; widget
  breakpoints are panel width, not viewport."
- PROJECT.md / README.md: localStorage key list; mention UTC offset display and
  TSE lunch.
- `specs/015-market-sessions-panel.md`: add a "Revision → see 016" line.

## Implementation notes
- Replaced the single-pass approximate UTC guess in `lib/sessions.ts` with two-pass `zonedTimeToUtc` using `tzOffsetMinutes` with `hourCycle: "h23"`. Invariant test confirms exact defined session lengths across all seasons and DST transition dates.
- Implemented wrap-around segment generator `rangeToSegments` converting cross-midnight intervals into tail and head segments whose widths strictly sum to the session duration.
- Handled Tokyo Stock Exchange (TSE) lunch break (11:30–12:30 JST) with `LUNCH` status and countdown to 12:30 JST resumption.
- Added `@container` query responsiveness with `ResizeObserver` on container and track: compact (<360px), medium (360–560px), and expanded (≥560px) layouts.
- Updated grid layout in `app/page.tsx`: sessions panel set to `span: 2` with `gridAutoFlow: "row dense"` on the right-hand panel grid container.
- Added preferences persistence under `btc-terminal:sessions-prefs` protected by `skipNextSaveRef`.
