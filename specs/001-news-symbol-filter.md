# 001 — News Symbol Tagging & "Active Asset" Filter

**Status:** Done
**Priority:** P4 · **Effort:** S
**Depends on:** 000 (soft — docs only)

## Goal
Tag every headline with the assets/topics it mentions. Add a one-click filter that
shows only news about the asset currently on the chart.

## Context
- `app/api/news/route.ts` pulls 6 RSS feeds, keyword-classifies sentiment, dedupes,
  and returns `{ id, title, source, sentiment, time }[]` (max 30, 8 per feed).
- `components/NewsFeedPanel.tsx` takes **no props**, polls `/api/news` every 60s, and
  has an All / Bull / Bear / Neu filter. It is `memo`'d.
- `app/page.tsx` renders `<NewsFeedPanel />` in **three** places: `renderPanel`
  (grid), `renderMaximizedContent`, and the narrow layout.
- Asset universe lives in `lib/symbols.ts` → `UNIVERSE` (12 labels, e.g. `BTC/USDT`,
  `XAU/USDT`, `OIL/USDT`).

## Requirements
1. Each news item gets `tags: string[]`. Tags are **UNIVERSE labels' base names**
   (`BTC`, `ETH`, `SOL`, `XRP`, `BNB`, `DOGE`, `SUI`, `AVAX`, `LINK`, `XAU`, `XAG`,
   `OIL`) plus topic tags `ETF`, `SEC`, `MACRO`.
2. Tagging happens **server-side** in the route (one place, cached by `s-maxage`).
3. NewsFeedPanel takes a `symbol` prop (the UI label, e.g. `"SOL/USDT"`) and shows
   a toggle button `◎ SOL` in the header next to the sentiment filters.
   - Off (default): current behaviour.
   - On: show only items whose `tags` include the active base. Combine with the
     sentiment filter (AND).
   - The button label follows the active symbol live.
4. Each row shows its tags as small chips (max 3, then `+N`). The chip matching the
   active asset is highlighted (`theme.yellow` text). Others use `theme.dim`.
5. Empty state when the filter matches nothing:
   `No SOL headlines in the latest N` (where N = total loaded). Never invent items.
6. More headlines so filters have material: `MAX_PER_FEED` 8 → 15, `MAX_ITEMS` 30 → 80.

## Technical approach

### New file `lib/newsTags.ts` (shared, pure, no React)
```ts
export type NewsTag = string; // "BTC" | "ETH" | ... | "ETF" | "SEC" | "MACRO"
export function tagHeadline(title: string): NewsTag[];
export function baseOf(label: string): string; // "SOL/USDT" -> "SOL"
```
Rule table (word boundaries required — `\b`):

| Tag | Case-insensitive names | Case-**sensitive** tickers |
|-----|------------------------|---------------------------|
| BTC | bitcoin | BTC |
| ETH | ethereum, ether | ETH |
| SOL | solana | SOL |
| XRP | ripple, xrp | — |
| BNB | bnb chain | BNB |
| DOGE | dogecoin | DOGE |
| SUI | — | SUI |
| AVAX | avalanche | AVAX |
| LINK | chainlink | LINK |
| XAU | gold | XAU |
| XAG | silver | XAG |
| OIL | crude, opec, brent, wti, oil price(s) | — |
| ETF | etf, etfs | — |
| SEC | — | SEC |
| MACRO | fed, fomc, cpi, inflation, rate cut, rate hike, powell, treasury yields, jobs report, nonfarm | — |

Why case-sensitive tickers: `sol`, `link`, `sui`, `sec`, `eth` all appear in
normal English ("second", "linked", "Ethiopia") — word boundaries alone are not
enough for `LINK`/`SEC`. Do **not** tag `BNB` on the word "Binance" (exchange news ≠ BNB).

- Build regexes once at module load. Keep the table as data so new UNIVERSE entries
  only need a row.
- Add a dev-time guard: every `UNIVERSE` base must have a row (a simple
  `console.warn` in development is enough; tests come in a later spec).

### Route `app/api/news/route.ts`
- Call `tagHeadline(title)` in `extractFeedItems`. Include `tags` in the mapped output.
- Bump the two limits (Requirement 6). Keep `Cache-Control: s-maxage=60`.

### Panel `components/NewsFeedPanel.tsx`
- Props: `{ symbol: string }`. Keep `memo`.
- `const [assetOnly, setAssetOnly] = useState(false)` — in-memory, like VOL/DAY.
- Filter: `news.filter(sentimentMatch).filter(n => !assetOnly || n.tags.includes(base))`.
- All colours from `useTheme()`.

### `app/page.tsx`
Pass `symbol={selectedSymbol}` to all **three** `<NewsFeedPanel />` sites.

## Out of scope
- Changing sentiment classification.
- Article links / opening articles.
- Persisting the toggle in localStorage.
- Adding new RSS feeds.

## Acceptance checklist
- [x] `npm run build` passes
- [x] `/api/news` items all have a `tags` array (possibly empty)
- [x] "Second", "linked", "Binance" headlines do not get SEC/LINK/BNB tags
- [x] Toggle on + switch BTC → ETH: the list updates without a refetch
- [x] Toggle + sentiment filter combine correctly
- [x] Empty state shows the real count, no placeholders
- [x] Works in grid, maximized and narrow (<900px) layouts

## Docs to update
- AGENTS.md: add `lib/newsTags.ts` to Architecture; one-line convention: "News tags
  are derived server-side from `lib/newsTags.ts`; add a row when extending `UNIVERSE`."
- README.md "Analysis panels → News": mention the asset filter.
- UPDATE_PHASE.md: mark the news half of "Symbol-Specific News Filtering & Calendar
  Impact Filter" done once 002 also lands.

## Implementation notes
- Created `lib/newsTags.ts` with strict word-boundary (`\b`) regexes for all 12 `UNIVERSE` assets plus `ETF`, `SEC`, and `MACRO`. Enforced case-sensitive matching for tickers that collide with common English words (`SEC`, `LINK`, `SUI`, `BNB`, `ETH`, `SOL`, `DOGE`, `AVAX`, `XAU`, `XAG`), preventing false matches on headlines like "Second", "linked", and "Binance". Added development-time consistency check against `UNIVERSE`.
- Updated `app/api/news/route.ts` to tag headlines server-side via `tagHeadline()`, HTML-entity decode titles, and increased feed limits from 8 -> 15 per feed and 30 -> 80 total items.
- Updated `components/NewsFeedPanel.tsx` to accept a `symbol` prop (`selectedSymbol`), render an in-memory `◎ {activeBase}` toggle button in the header alongside sentiment filters, highlight active asset tag chips in `theme.yellow` (with max 3 chips + `+N` remainder indicator), and show honest dynamic empty counts (`No {activeBase} headlines in the latest {N}`).
- Updated `app/page.tsx` to pass `symbol={selectedSymbol}` across all three render locations (`renderPanel`, `renderMaximizedContent`, and the narrow layout).
- Verified `npm run typecheck` and `npm run build` both exit 0. Live `/api/news` route output verified.
- Synced `AGENTS.md`, `PROJECT.md`, and `README.md`.
