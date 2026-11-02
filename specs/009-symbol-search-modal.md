# 009 — Symbol Search Modal & Quick Pair Switcher

**Status:** Complete  
**Priority:** P1 · **Effort:** M  
**Depends on:** 004 (Per-symbol alerts & live tickers), 006 (TradingView layout)

## Goal
Implement a Bloomberg-style, keyboard-first **Symbol Search & Pair Switcher Modal** (`Ctrl+K` / `/` hotkey, or clicking the symbol in CommandBar / ChartHeader) allowing traders to search, filter, and switch the terminal's active charted pair with live prices, 24h stats, categorized tags, and recent symbol history.

## Context
Currently, changing the active trading instrument requires either typing an exact command into the top command bar (e.g. `BTC 15M`) or scrolling the left watchlist. Traders need an institutional search modal with instant fuzzy search, asset categorization (`All`, `Crypto L1`, `DeFi / Memes`, `Commodities`), arrow-key navigation, and live price tickers.

## Requirements

### 1. Symbol Search Modal Component (`components/SymbolSearchModal.tsx`)
- Triggered by:
  - Global hotkey `Ctrl+K` or `Cmd+K`.
  - Pressing `/` when no input/textarea is currently focused.
  - Clicking the active symbol badge in `CommandBar.tsx` or `ChartHeader.tsx`.
- Modal UI elements:
  - Search input with auto-focus and clear button.
  - Category filter pills: `All`, `Layer 1`, `DeFi`, `Memes`, `Commodities`.
  - Recent searches section (up to 5 recent symbols, persisted in `localStorage` under `btc-terminal:recent-symbols`).
  - Search results list displaying:
    - Coin logo / ingot badge (`AssetIcon.tsx`).
    - Symbol label (e.g. `BTC/USDT`) and full asset name (e.g. `Bitcoin`).
    - Category tag pill.
    - Live price from `marketStore.tickers` or aggregated mid price.
    - 24h price change percentage badge (green for positive, red for negative).
- Keyboard Navigation:
  - `ArrowDown` / `ArrowUp` to navigate results with active highlight.
  - `Enter` to select highlighted symbol and close modal.
  - `Escape` to close modal.

### 2. State & History Persistence
- Persist recent symbols list in `localStorage` (`btc-terminal:recent-symbols`).
- Selecting any symbol prepends it to the recent list (deduplicated, max 5).

### 3. Integration with Terminal State (`app/page.tsx`, `CommandBar.tsx`, `ChartHeader.tsx`)
- Add `showSymbolSearch` state in `app/page.tsx`.
- Wire `onOpenSymbolSearch` callback to `CommandBar` and `ChartHeader`.
- Global keyboard event listener for `Ctrl+K` / `Cmd+K` and `/`.

### 4. Acceptance Checklist
- [x] `SymbolSearchModal` renders search input, category filters, recent history, and live asset rows.
- [x] Pressing `Ctrl+K`, `Cmd+K`, or `/` opens modal; `Escape` closes it.
- [x] Typing filters symbols by ticker (`SOL`), base name (`Solana`), or category.
- [x] Arrow keys navigate list; `Enter` switches symbol and closes modal.
- [x] Recently selected symbols persist across page reloads.
- [x] `npm run typecheck`, `npm run test`, and `npm run build` pass with 0 errors.
