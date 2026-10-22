# YMC Terminal — Update Phase & Improvement Blueprint

> **Status:** Live in Production on Vercel | **Repo:** [github.com/enginior/YMC-terminal](https://github.com/enginior/YMC-terminal)  
> **Target:** Bloomberg Terminal–style Workstation for BTC/USDT & Perpetual Crypto Derivatives

---

## 1. Executive Summary & Vision

**YMC Terminal** is a high-density, real-time financial trading workstation inspired by the Bloomberg Terminal, purpose-built for Bitcoin (`BTC/USDT`) and perpetual crypto derivative pairs. Operating with 100% free, public, keyless market feeds (Binance, Coinbase, OKX, Bybit, alternative.me, biquote.io), the terminal bridges institutional-grade market visualization with low-latency execution telemetry.

This document outlines the **Update Phase**: a structured catalog of UX/UI enhancements, perpetual derivatives analytics, charting utilities, and performance optimizations designed for upcoming development sprints.

---

## 2. Priority Matrix (Impact vs. Effort)

| Category | Initiative | Impact | Effort | Priority | Status |
|---|---|---|---|---|---|
| **Perpetuals** | Dynamic Symbol Funding & Open Interest | High | Low | **P0** | ✅ Completed (`9a66b15`) |
| **UI/UX** | Keyboard Hotkeys & Cheat Sheet Modal (`?`, `1`-`6`, `[`, `]`) | High | Low | **P0** | ✅ Completed (`9a66b15`) |
| **Charting** | Chart PNG Snapshot & OHLCV CSV Export | Medium | Low | **P0** | ✅ Completed (`9a66b15`) |
| **Perpetuals** | Next Funding Countdown & Annualized APR | High | Medium | **P1** | ✅ Completed (`cfc0fd1`) |
| **UI/UX** | Bloomberg Command Bar Action Syntax (`BTC 15M`, `THEME`, etc.) | High | Medium | **P1** | ✅ Completed (`cfc0fd1`) |
| **Perpetuals** | Live Perpetual Liquidation Feed (`!forceOrder@arr`) | High | Medium | **P1** | ✅ Completed (`cfc0fd1`) |
| **Charting** | Price & Percentage Delta Measurement Tool (Ruler) | High | Medium | **P1** | ✅ Completed (`cfc0fd1`) |
| **UI/UX** | Panel Maximize / Fullscreen Focus Mode (`f` / `⤢`) | High | Medium | **P1** | ✅ Completed (`cfc0fd1`) |
| **Derivatives**| Global Long/Short Account Ratio Widget | Medium | Low | **P2** | ✅ Completed |
| **Watchlist** | Expand Universe (12 pairs: Cryptos + XAU, XAG, OIL) + Sort | Medium | Medium | **P2** | ✅ Completed |
| **Asset Logos** | Vector Coin & Metallic Bullion / Commodity Badges | Medium | Low | **P2** | ✅ Completed |
| **Derivatives**| Basis Spread (Mark vs. Spot Spread) in MarketStats | Medium | Low | **P2** | ✅ Completed |
| **Charting** | Broker-style Broken Day Lines (between candles) | Medium | Low | **P2** | ✅ Completed |
| **Charting** | 24H & Previous Day High / Low Watermarks (`H/L`) | Medium | Low | **P3** | ✅ Completed |
| **Charting** | Chart Visuals Dropdown (Candles, Heikin Ashi, Line) | High | Medium | **P3** | ✅ Completed (`c43dfdb`) |
| **UI/UX** | Reset Default Bloomberg Layout in Settings | Low | Low | **P2** | ✅ Completed |
| **Watchlist** | Consolidate Watchlist + Sparklines (Merge Comparison) | High | Medium | **P4** | ✅ Completed |
| **Heatmap** | Crypto Market Treemap / Heatmap Widget (below News) | High | Medium | **P4** | ✅ Completed |
| **Architecture**| Reactive Tick Store / Isolation (Prevent Root Re-renders) | High | High | **P4** | Planned |
| **News/Macro** | Symbol-Specific News Filtering & Calendar Impact Filter | Medium | Low | **P4** | Planned |

---

## 3. Detailed Specifications by Domain

### 3.1 Perpetual Crypto Derivatives Analytics

As a perpetual derivatives workstation, YMC Terminal requires specialized derivatives data alongside spot pricing:

1. **Dynamic Per-Symbol Funding Rate & Open Interest**
   - *Current limitation:* `/api/sentiment/route.ts` hardcodes `BTCUSDT` for funding rate and open interest regardless of the actively selected symbol.
   - *Improvement:* Make `/api/sentiment/route.ts` accept `?symbol=ETHUSDT`. Fetch real-time funding rate and OI for the active chart pair (`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, etc.).
   - *Binance API:*
     - Funding & Mark Price: `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`
     - Open Interest: `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`

2. **Funding Countdown & Annualized APR**
   - Perpetual contracts settle funding every 8 hours (00:00, 08:00, 16:00 UTC).
   - Display a live countdown timer (`Next Funding: 02h 45m 10s`).
   - Display annualized funding APR:
     $$\text{Annualized APR} = \text{Funding Rate} \times 3 \times 365 \times 100\%$$
   - Color code: Red for negative funding (shorts pay longs), Green for positive funding (longs pay shorts).

3. **Real-Time Perpetual Liquidation Feed (Rekt Tape)**
   - Connect to Binance Futures Public WebSocket stream:
     `wss://fstream.binance.com/ws/!forceOrder@arr`
   - Stream real-time liquidation bursts across USDT-margined perpetuals:
     - Side: `BUY` (Short Liquidated) in Green / `SELL` (Long Liquidated) in Red
     - Price, Notional Size in USD, and timestamp
     - Flash visual notification or sound chime for mega liquidations (> $250k).

4. **Global Long/Short Account Ratio**
   - Query Binance Futures public sentiment endpoint:
     `https://fapi.binance.com/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1`
   - Displays ratio of net long accounts vs net short accounts among top traders, rendered as a two-tone sentiment gauge bar.

5. **Mark Price vs. Spot Price (Basis Spread) in MarketStats**
   - Add a compact pill in `MarketStats` showing:
     - Mark Price
     - Basis Spread: $\text{Basis} = \text{Perp Price} - \text{Index Price}$
     - Critical metric for arbitrage and liquidation distance.

---

### 3.2 Bloomberg Terminal UI/UX Enhancements

1. **Keyboard-First Hotkeys & Cheat Sheet Modal (`?`)**
   - Bloomberg terminals are operator-driven. Implement global key handlers (active when not typing in an input):
     - `?` or `h`: Open Bloomberg keyboard shortcut cheat sheet.
     - `1`–`6`: Instant switch watchlist symbols (`1` for BTC, `2` for ETH, `3` for SOL, etc.).
     - `[` / `]`: Cycle timeframes down/up (`1m` → `5m` → `15m` → `1h` → `4h` → `1d`).
     - `v`: Toggle volume bars.
     - `d`: Toggle UTC day boundary lines.
     - `m`: Toggle OHLC magnet mode.
     - `f`: Maximize/restore the active or hovered panel.
     - `Esc`: Clear selection, close modals, exit draw mode.

2. **Command Bar Bloomberg Quick-Actions**
   - Extend `CommandBar` beyond ticker search to parse terminal command syntax:
     - `BTC 15M` → Switches pair to BTC/USDT and sets timeframe to 15m.
     - `ALERT 75000` → Opens alert dialog pre-filled at $75,000.
     - `THEME AMBER` / `THEME MATRIX` → Direct palette switch.
     - `CLEAR` → Wipes drawings from current chart.
     - `FULL` → Toggles chart fullscreen.

3. **Panel Maximize / Solo Focus Mode**
   - Add a subtle maximize button (`⤢` / `✕`) to every panel header.
   - When clicked (or via hotkey `f`), the target panel expands to occupy 100% of the viewport under the CommandBar.
   - Pressing `Esc` or clicking `✕` smoothly returns to the 12-column grid.

4. **Running Market Ticker / Marquee Bar**
   - Optional 24px slim horizontal ticker bar across the top or bottom of the terminal.
   - Shows streaming prices and 24h % deltas for tracked pairs (BTC, ETH, SOL, XRP, BNB, GOLD).

5. **Audio Feedback & Permissions UX**
   - Modern browsers block AudioContext autoplay until the first user click.
   - Add an alert audio status indicator in `AlertsPanel` with a "Test Sound" button and auto-unlock on first document interaction.

---

### 3.3 Advanced Charting Utilities

1. **Price & Percentage Delta Measurement Tool (Ruler)**
   - Allow traders to measure price difference, percentage change, and bar count between two points.
   - Activation: Holding `Shift` + clicking two chart points, or a ruler icon in the toolbar.
   - Rendered using a lightweight-charts series primitive drawing a measurement box with `Δ$`, `Δ%`, and `Bars`.

2. **Chart Snapshot & OHLCV CSV Export**
   - **Camera Icon:** Uses canvas `toBlob()` / `takeScreenshot()` to download high-resolution PNG or copy to clipboard.
   - **CSV Download:** Export loaded candles as standard CSV format:
     `Timestamp,Date,Open,High,Low,Close,Volume`

3. **Session & Previous Day High / Low Watermarks**
   - Display horizontal watermark key levels representing 24H High (Green dashed), 24H Low (Red dashed), Previous Day High (Cyan dotted), and Previous Day Low (Amber dotted) with right-scale price badges and auto-fit scaling.

---

### 3.4 Watchlist & Market Feed Upgrades

1. **Expanded Perpetual Universe**
   - Add high-liquidity perpetual pairs to `lib/symbols.ts`:
     - `DOGE/USDT` (`DOGEUSDT`)
     - `AVAX/USDT` (`AVAXUSDT`)
     - `SUI/USDT` (`SUIUSDT`)
     - `NEAR/USDT` (`NEARUSDT`)
     - `LINK/USDT` (`LINKUSDT`)
     - `PEPE/USDT` (`1000PEPEUSDT`)
   - Allow filtering and sorting the watchlist:
     - Sort by: `24h % Change` (Top Gainers / Losers), `24h Volume`, `Alphabetical`.

2. **News Feed Symbol Tagging & Relevance Filter**
   - Automatically detect coin tickers in news titles (`BTC`, `ETH`, `SOL`, `SEC`, `ETF`).
   - Add a quick filter button to show only news mentioning the currently selected asset.

3. **Economic Calendar Impact & Currency Filtering**
   - Add pill toggles to filter economic events by currency (`USD`, `EUR`, `GBP`, `JPY`) or minimum importance (`High`, `Medium`).

---

### 3.5 Architecture & Performance Hardening

1. **Render Isolation for High-Frequency Socket Ticks**
   - *Problem:* WebSocket trades arrive dozens of times per second. Flushed ticks currently flow through `page.tsx` state, causing React to reconcile non-price panels.
   - *Solution:* Transition live tick distribution to an external store (or lightweight listener pattern). Panels that display real-time price (`MarketStats`, `PriceChart`, `OrderBook`, `TradeTape`) subscribe directly to the tick store, eliminating re-renders in static panels (`Correlation`, `Calendar`, `NewsFeed`).

2. **Virtualization for Order Book & Trade Tape**
   - If order book depth is increased beyond 15 levels or trade tape buffer expands to 100+ items, use CSS containment or lightweight row virtualization to guarantee zero dropped frames on lower-end devices.

3. **Layout Reset & Multi-Layout Profiles**
   - Add a "Reset Default Layout" button in Settings to clear corrupted or overcrowded `localStorage` grid states.
   - Allow saving custom layouts (e.g., "Charting Heavy", "Order Flow Heavy", "Macro Overview").

---

### 3.6 Consolidated Watchlist with Inline Sparklines

1. **Rationale & Information Density**
   - Currently, `Watchlist` displays asset rows with live prices, 24h change %, and notional volume, while `ComparisonPanel` displays a separate list of 24h sparklines.
   - Consolidating sparklines directly into each row of `Watchlist` avoids redundant polling, enhances Bloomberg-style density, and frees up a major grid panel slot.

2. **UI & Data Specification**
   - **Inline Mini-Curve:** Embed a lightweight SVG sparkline (64px–80px wide × 18px–20px high) between the symbol badge and the price / % change column in each row.
   - **Color Coding:** Inherit theme-driven semantic colors (`theme.green` for positive 24h trajectory, `theme.red` for negative trajectory).
   - **Preserved Capabilities:** Retain all existing Watchlist features:
     - Vector asset logos (SVG coins, 3D metallic ingots, oil drum)
     - Live streaming prices and 24h % deltas
     - 24h Quote volume in compact notation ($B, $M, $K)
     - 1-click sorting (Gainers, Losers, Volume, Alphabetical)
     - Keyboard navigation (`1`–`9`, `0`) and quick selection

---

### 3.7 Crypto Market Treemap / Heatmap Status Widget (Coin360 / Finviz Style)

1. **Rationale & Placement**
   - Visual market map inspired by the Bloomberg/Finviz S&P 500 and Coin360 market heatmaps.
   - Positioned directly below the High Impact News / Macro section (or occupying the retired Comparison panel slot in the multi-panel grid).

2. **Treemap & Visual Hierarchy**
   - **Proportional Area Sizing:** Tiles sized dynamically by 24h notional volume (or relative market weight) using a squarified treemap layout.
     - Dominant mega-cap blocks (BTC, ETH, SOL) anchor the primary quadrant.
     - Mid-caps and commodities (BNB, DOGE, XRP, SUI, AVAX, LINK, XAU, XAG, OIL) scale responsively.
   - **Tile Anatomy:**
     - High-definition vector asset logo badge
     - Bold uppercase symbol name (e.g., `BTC`, `ETH`, `SOL`, `NVDA`-style layout)
     - 24h % change formatted as `+X.XX%` / `-X.XX%`
   - **Color Heatmap Gradient:**
     - Bullish: Deep green (`#16A34A` / `#22C55E`) for `> +3%`, muted green for `0% to +3%`.
     - Neutral: Subdued panel slate for flat movements (`~0%`).
     - Bearish: High-contrast red (`#DC2626` / `#EF4444`) scaling with downside intensity (`-3%` to `-10%+`).

3. **Interactivity & Integration**
   - **1-Click Terminal Sync:** Clicking any tile immediately switches the active symbol across the entire terminal (Chart, Order Book, Trade Tape, Market Stats, Sentiment).
   - **Hover Inspection:** Tooltip displaying 24h high, 24h low, notional volume, and funding rate on pointer hover.

---

## 4. Implementation Phasing Roadmap

```mermaid
flowchart TD
    subgraph Phase 1: Immediate Wins
        A1["Dynamic Per-Symbol Funding & OI"] --> A2["Keyboard Hotkeys & Help Modal"]
        A2 --> A3["Chart Snapshot & CSV Export"]
    end

    subgraph Phase 2: Perps & Derivatives Focus
        B1["Next Funding Countdown & APR"] --> B2["Live Liquidation Tape (!forceOrder)"]
        B2 --> B3["Long/Short Ratio & Basis Spread"]
    end

    subgraph Phase 3: Terminal UI/UX Polish
        C1["Panel Maximize / Fullscreen"] --> C2["CommandBar Action Parser"]
        C2 --> C3["Chart Delta Ruler Tool"]
        C3 --> C4["Expanded Universe & Asset Badges"]
        C4 --> C5["Chart Visuals & Session H/L Lines"]
    end

    subgraph Phase 4: Market Heatmap & Watchlist Consolidation
        D1["Consolidate Watchlist + Sparklines"] --> D2["Crypto Market Treemap Widget"]
        D2 --> D3["Price Store Render Isolation"]
        D3 --> D4["News & Calendar Tag Filtering"]
    end

    Phase 1 --> Phase 2 --> Phase 3 --> Phase 4
```

---

## 5. Notes on Bloomberg Terminal Conventions

- **Typography & Grid:** Maintain strict monospace tabular numbers (`tabular-nums`) with zero layout shift during real-time digit fluctuations.
- **Color Discipline:** Semantic colors (Green/Red/Yellow/Blue/Dim) must strictly inherit from `ThemeContext`. Avoid arbitrary Tailwind color utilities.
- **Safety & Keyless Design:** Maintain the 100% free, keyless, zero-wallet requirement so YMC Terminal remains instant-to-deploy and universally accessible.
