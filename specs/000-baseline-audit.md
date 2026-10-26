# 000 — Baseline Audit & Doc Drift

**Status:** Done
**Priority:** P1 · **Effort:** S
**Depends on:** —

## Goal
Bring the docs and tooling back in sync with the code as of `e1757f7` (v0.1.5), so
every future spec starts from an accurate `AGENTS.md`.

## Context
The advisor's first read found the code has moved ahead of the docs:

| Area | Docs say | Code has |
|------|----------|----------|
| `components/` | 16 files | also `AssetIcon.tsx`, `HotkeysModal.tsx`, `LiquidationsTape.tsx`, `MarketHeatmapPanel.tsx` |
| `lib/` | no Heikin Ashi | `lib/heikenAshi.ts` |
| Pairs | README: "Six pairs" | 12-pair universe incl. XAU/XAG/OIL (UPDATE_PHASE) |
| Timeframes | README/PROJECT: `1m 5m 15m 1h 4h 1d` | `30m` and `2h` added in `9d31f82` (AGENTS already lists them) |
| `ComparisonPanel` | listed as live panel | merged into Watchlist sparklines in v0.1.5 — possibly dead code |
| Hotkeys / command bar | README: only `/` and `Esc` | full hotkey set + command syntax (P0/P1) |
| Data sources | AGENTS: CoinDesk RSS only | 6 RSS feeds, biquote.io calendar, `fstream` liquidations, L/S ratio endpoint |
| `package.json` | — | `name: btc-terminal`; `lint: next lint` (command removed in Next 16) |

## Requirements
1. Update the **Architecture** tree in `AGENTS.md` and `PROJECT.md` to match the
   actual files in `app/`, `components/`, `hooks/`, `lib/`.
2. Update the **External APIs** table in `AGENTS.md` (add biquote.io, Binance
   `fstream` `!forceOrder@arr`, `globalLongShortAccountRatio`, `premiumIndex`, the
   extra RSS feeds).
3. README: fix pair count, timeframe list, and the "Using it" section (hotkeys `?`,
   command bar syntax, chart type dropdown, ruler, PNG/CSV export, maximize).
4. Determine whether `ComparisonPanel.tsx` and `app/api/comparison` are still
   referenced. If unused → delete them and remove from docs. If used → document where.
5. Add any localStorage keys introduced since the docs were written (grep
   `btc-terminal:`) to all three lists (AGENTS, PROJECT, README).
6. `package.json`: replace the dead `lint` script with
   `"typecheck": "tsc --noEmit"` and point the docs at it (keep `build` as the
   final gate). Do **not** rename the package (would change nothing user-facing
   and risks Vercel project confusion) — just note it.

## Technical approach
- Use `git grep` for imports of `ComparisonPanel` and `/api/comparison`.
- Use `git grep "btc-terminal:"` for the storage key inventory.
- Docs-only plus at most the two dead files and one script line. No behaviour change.

## Out of scope
- Adding ESLint/Prettier/tests (that will be a separate spec).
- Any UI or feature change.

## Acceptance checklist
- [x] `npm run build` passes
- [x] `npm run typecheck` passes
- [x] Architecture trees match `Get-ChildItem` output for app/components/hooks/lib
- [x] No doc references a removed file
- [x] localStorage key lists identical across AGENTS/PROJECT/README

## Docs to update
AGENTS.md, PROJECT.md, README.md (UPDATE_PHASE.md unchanged).

## Implementation notes
- **ComparisonPanel audit**: Determined that `components/ComparisonPanel.tsx` was dead code (supplanted in v0.1.5 by inline Watchlist sparklines and `MarketHeatmapPanel.tsx`). Removed `components/ComparisonPanel.tsx` and its unused import from `app/page.tsx`. Kept `app/api/comparison/route.ts` as it actively powers both `Watchlist` and `MarketHeatmapPanel`.
- **Architecture trees synced**: Updated file trees in `AGENTS.md` and `PROJECT.md` to reflect actual files on disk (`app/`, `components/`, `hooks/`, `lib/`), adding `icon.svg`, `AssetIcon.tsx`, `HotkeysModal.tsx`, `LiquidationsTape.tsx`, `MarketHeatmapPanel.tsx`, `heikenAshi.ts`, and removing `ComparisonPanel.tsx`.
- **External APIs synced**: Added Binance `fstream` (`!forceOrder@arr`), `globalLongShortAccountRatio`, `premiumIndex`, biquote.io macro calendar, and multi-source RSS feeds to `AGENTS.md` and `PROJECT.md`.
- **Tooling updated**: Replaced dead Next 16 `next lint` in `package.json` with `"typecheck": "tsc --noEmit"`. Updated `AGENTS.md` commands section accordingly (`npm run typecheck`, `npm run build`).
- **README aligned**: Updated pair universe (12 pairs), timeframes (8 timeframes incl. 30m and 2h), features list, data sources, and the "Using it" section (cheatsheet hotkey `?`, command syntax, visual type dropdown, ruler, snap/csv export, maximize).
- **Storage keys synced**: Verified all 8 `btc-terminal:*` localStorage keys across `AGENTS.md`, `PROJECT.md`, and `README.md`.
- **Verification**: Ran `npm run typecheck` and `npm run build`; both compiled cleanly with 0 errors.
