"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Watchlist from "@/components/Watchlist";
import PriceChart from "@/components/PriceChart";
import OrderBook from "@/components/OrderBook";
import TradeTape from "@/components/TradeTape";
import CommandBar from "@/components/CommandBar";
import MarketStats, { TickerStats } from "@/components/MarketStats";
import SettingsPanel from "@/components/SettingsPanel";
import AlertsPanel from "@/components/AlertsPanel";
import AlertNotification from "@/components/AlertNotification";
import MarketHeatmapPanel from "@/components/MarketHeatmapPanel";
import EconomicCalendarPanel from "@/components/EconomicCalendarPanel";
import MarketSessionsPanel from "@/components/MarketSessionsPanel";
import NewsFeedPanel from "@/components/NewsFeedPanel";
import MarketSentimentPanel from "@/components/MarketSentimentPanel";
import DayTraderPanel from "@/components/DayTraderPanel";
import HotkeysModal from "@/components/HotkeysModal";
import SymbolSearchModal from "@/components/SymbolSearchModal";
import Panel from "@/components/Panel";
import { useTheme, THEME_PRESETS } from "@/context/ThemeContext";
import { useMarketFeed } from "@/hooks/useMultiExchangeData";
import { ExchangeSource } from "@/lib/marketStore";
import { useAlerts } from "@/hooks/useAlerts";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useRenderCount } from "@/lib/devRenderCount";
import { toBinanceSymbol, resolvePrefix, UNIVERSE } from "@/lib/symbols";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"] as const;

const DEFAULT_ORDER = [
  "trader",
  "sessions",
  "news",
  "orderbook",
  "tradetape",
  "sentiment",
  "alerts",
] as const;

type PanelId = (typeof DEFAULT_ORDER)[number];

const SECONDARY_PANELS: readonly PanelId[] = [
  "orderbook",
  "tradetape",
  "sentiment",
  "alerts",
];

const PANEL_TITLES: Record<PanelId, string> = {
  trader: "Day Trader Scanner",
  sessions: "Market Sessions",
  news: "News Feed",
  orderbook: "Order Book",
  tradetape: "Trade Tape",
  sentiment: "Market Sentiment",
  alerts: "Price Alerts",
};

const DEFAULT_COLLAPSED: Record<string, boolean> = {
  orderbook: true,
  tradetape: true,
  sentiment: true,
  alerts: true,
};

const ORDER_KEY = "btc-terminal:panel-order-v3";
const COLLAPSED_PANELS_KEY = "btc-terminal:collapsed-panels";
const LEFT_RAIL_KEY = "btc-terminal:left-rail";
const EXCHANGE_SOURCE_KEY = "btc-terminal:exchange-source";

/** Which chart symbol each watchlist row maps to. */
function toChartSymbol(label: string): string | null {
  return toBinanceSymbol(label);
}

function loadOrder(): PanelId[] {
  if (typeof window === "undefined") return [...DEFAULT_ORDER];
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    if (!raw) return [...DEFAULT_ORDER];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_ORDER];
    // Map legacy "correlation" to "sessions"
    const migrated = parsed.map((id) => (id === "correlation" ? "sessions" : id));
    // Drop unknown ids and append missing ones so the grid can never tear
    const known = migrated.filter((id): id is PanelId => DEFAULT_ORDER.includes(id));
    const missing = DEFAULT_ORDER.filter((id) => !known.includes(id));
    return [...known, ...missing];
  } catch {
    return [...DEFAULT_ORDER];
  }
}

export default function Home() {
  useRenderCount("Home");
  const { theme, applyPreset } = useTheme();
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  const [maximizedPanel, setMaximizedPanel] = useState<string | null>(null);
  const [showLeftRail, setShowLeftRail] = useState(true);
  const skipLeftRailSaveRef = useRef(true);
  const [exchangeSource, setExchangeSource] = useState<ExchangeSource>("binance");
  const skipExchangeSourceSaveRef = useRef(true);
  const [ticker, setTicker] = useState<TickerStats | null>(null);
  const [panelOrder, setPanelOrder] = useState<PanelId[]>([...DEFAULT_ORDER]);
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({
    ...DEFAULT_COLLAPSED,
  });
  const skipCollapsedSaveRef = useRef(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Global Bloomberg-style keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isInput) return;

      if (e.key === "?" || e.key === "h" || e.key === "H") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Ctrl+K / Cmd+K or / opens institutional symbol search modal
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSymbolSearch((prev) => !prev);
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        setShowSymbolSearch(true);
        return;
      }

      // f key toggles maximize on chart or restores grid
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setMaximizedPanel((prev) => (prev ? null : "chart"));
        return;
      }

      // b key toggles left panel rail (Watchlist + Calendar + Heatmap)
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setShowLeftRail((prev) => !prev);
        return;
      }

      // 1-9 and 0 switches pair
      if (e.key === "0" && UNIVERSE.length >= 10) {
        e.preventDefault();
        setSelectedSymbol(UNIVERSE[9].label);
        return;
      }
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= UNIVERSE.length) {
        e.preventDefault();
        setSelectedSymbol(UNIVERSE[num - 1].label);
        return;
      }

      // [ and ] cycles timeframe
      if (e.key === "[") {
        e.preventDefault();
        setTimeframe((current) => {
          const idx = TIMEFRAMES.indexOf(current as any);
          return idx > 0 ? TIMEFRAMES[idx - 1] : TIMEFRAMES[0];
        });
        return;
      }

      if (e.key === "]") {
        e.preventDefault();
        setTimeframe((current) => {
          const idx = TIMEFRAMES.indexOf(current as any);
          return idx >= 0 && idx < TIMEFRAMES.length - 1 ? TIMEFRAMES[idx + 1] : TIMEFRAMES[TIMEFRAMES.length - 1];
        });
        return;
      }

      if (e.key === "Escape") {
        setShowShortcuts(false);
        setShowSettings(false);
        setShowSymbolSearch(false);
        setMaximizedPanel(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const orderHydrated = useRef(false);

  // Restore saved layout after mount to avoid a hydration mismatch
  useEffect(() => {
    setPanelOrder(loadOrder());
    orderHydrated.current = true;
    try {
      const savedLeft = window.localStorage.getItem(LEFT_RAIL_KEY);
      if (savedLeft !== null) {
        setShowLeftRail(savedLeft === "true");
      }
      const savedSource = window.localStorage.getItem(EXCHANGE_SOURCE_KEY);
      if (savedSource === "binance" || savedSource === "bybit" || savedSource === "okx") {
        setExchangeSource(savedSource);
      }
      const savedCollapsed = window.localStorage.getItem(COLLAPSED_PANELS_KEY);
      if (savedCollapsed) {
        const parsed = JSON.parse(savedCollapsed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setCollapsedPanels(parsed);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (skipCollapsedSaveRef.current) {
      skipCollapsedSaveRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(COLLAPSED_PANELS_KEY, JSON.stringify(collapsedPanels));
    } catch {}
  }, [collapsedPanels]);

  useEffect(() => {
    if (skipLeftRailSaveRef.current) {
      skipLeftRailSaveRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(LEFT_RAIL_KEY, String(showLeftRail));
    } catch {}
  }, [showLeftRail]);

  useEffect(() => {
    if (skipExchangeSourceSaveRef.current) {
      skipExchangeSourceSaveRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(EXCHANGE_SOURCE_KEY, exchangeSource);
    } catch {}
  }, [exchangeSource]);

  useEffect(() => {
    if (!orderHydrated.current) return;
    try {
      window.localStorage.setItem(ORDER_KEY, JSON.stringify(panelOrder));
    } catch {
      /* private mode or quota — layout just won't persist */
    }
  }, [panelOrder]);

  const binanceSymbol = toChartSymbol(selectedSymbol) ?? "BTCUSDT";

  // Stream data into marketStore outside React state (render isolation)
  useMarketFeed(binanceSymbol, timeframe, exchangeSource);

  const {
    alerts,
    addAlert,
    toggleAlertArmed,
    removeAlert,
    showNotification,
    dismissNotification,
    prefs,
    updatePrefs,
    primeAudio,
    testSound,
    requestDesktopNotification,
  } = useAlerts();

  // Real 24hr stats from the unified exchange source (throttled when tab is backgrounded)
  const fetchTicker = useCallback(async () => {
    try {
      const res = await fetch(`/api/ticker?symbol=${binanceSymbol}&source=${exchangeSource}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      if (json.lastPrice) setTicker(json);
    } catch {
      /* keep previous values rather than blanking the strip */
    }
  }, [binanceSymbol, exchangeSource]);

  useVisibilityPolling(fetchTicker, 10000);

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDrop = (index: number) => {
    setDragIndex(null);
    if (dragIndex === null || dragIndex === index) return;
    setPanelOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
  };

  const noDragOver = (e: React.DragEvent) => e.preventDefault();

  const togglePanelCollapsed = useCallback((id: PanelId) => {
    setCollapsedPanels((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const renderPanel = (id: PanelId) => {
    const index = panelOrder.indexOf(id);
    const isCollapsed = Boolean(collapsedPanels[id]);
    const bothBookAndTapeOpen =
      !collapsedPanels.orderbook && !collapsedPanels.tradetape;
    const span: 1 | 2 = isCollapsed
      ? 2
      : (id === "orderbook" || id === "tradetape") && bothBookAndTapeOpen
        ? 1
        : 2;

    // `key` is passed explicitly by the caller — spreading it triggers a React warning
    const props = {
      title: PANEL_TITLES[id],
      height: id === "trader" ? 310 : id === "news" ? 300 : id === "sessions" ? 210 : 210,
      span,
      onDragStart: () => handleDragStart(index),
      onDragOver: noDragOver,
      onDrop: () => handleDrop(index),
      isDragging: dragIndex === index,
      onToggleMaximize: () => setMaximizedPanel(maximizedPanel === id ? null : id),
      isMaximized: maximizedPanel === id,
      collapsed: isCollapsed,
      onToggleCollapse: () => togglePanelCollapsed(id),
    };

    let body: React.ReactNode;
    switch (id) {
      case "trader":
        body = (
          <DayTraderPanel
            symbol={selectedSymbol}
            timeframe={timeframe}
            onSelectSymbol={setSelectedSymbol}
            onSelectTimeframe={setTimeframe}
            onAddAlert={addAlert}
          />
        );
        break;
      case "orderbook":
        body = <OrderBook />;
        break;
      case "tradetape":
        body = <TradeTape />;
        break;
      case "alerts":
        body = (
          <AlertsPanel
            alerts={alerts}
            symbol={selectedSymbol}
            onAddAlert={addAlert}
            onToggleArmed={toggleAlertArmed}
            onRemoveAlert={removeAlert}
            prefs={prefs}
            onPrefsChange={updatePrefs}
            onEnableSound={primeAudio}
            onTestSound={testSound}
            onRequestDesktopNotification={requestDesktopNotification}
          />
        );
        break;
      case "sentiment":
        body = <MarketSentimentPanel symbol={selectedSymbol} />;
        break;
      case "sessions":
        body = <MarketSessionsPanel />;
        break;
      case "news":
        body = <NewsFeedPanel symbol={selectedSymbol} />;
        break;
      default:
        return null;
    }

    return (
      <Panel key={id} {...props}>
        {body}
      </Panel>
    );
  };

  const renderMaximizedContent = (id: string) => {
    switch (id) {
      case "chart":
        return (
          <PriceChart
            symbol={selectedSymbol}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            onToggleMaximize={() => setMaximizedPanel(null)}
            isMaximized={true}
            ticker={ticker}
            onOpenSymbolSearch={() => setShowSymbolSearch(true)}
          />
        );
      case "trader":
        return (
          <DayTraderPanel
            symbol={selectedSymbol}
            timeframe={timeframe}
            onSelectSymbol={setSelectedSymbol}
            onSelectTimeframe={setTimeframe}
            onAddAlert={addAlert}
          />
        );
      case "orderbook":
        return <OrderBook />;
      case "tradetape":
        return <TradeTape />;
      case "alerts":
        return (
          <AlertsPanel
            alerts={alerts}
            symbol={selectedSymbol}
            onAddAlert={addAlert}
            onToggleArmed={toggleAlertArmed}
            onRemoveAlert={removeAlert}
            prefs={prefs}
            onPrefsChange={updatePrefs}
            onEnableSound={primeAudio}
            onTestSound={testSound}
            onRequestDesktopNotification={requestDesktopNotification}
          />
        );
      case "sentiment":
        return <MarketSentimentPanel symbol={selectedSymbol} />;
      case "sessions":
        return <MarketSessionsPanel />;
      case "news":
        return <NewsFeedPanel symbol={selectedSymbol} />;
      case "calendar":
        return <EconomicCalendarPanel />;
      case "heatmap":
      case "comparison":
        return <MarketHeatmapPanel onSelect={setSelectedSymbol} selected={selectedSymbol} />;
      case "watchlist":
        return <Watchlist selected={selectedSymbol} onSelect={setSelectedSymbol} />;
      default:
        return null;
    }
  };

  const handleCommand = useCallback((cmd: string) => {
    const raw = cmd.trim();
    if (!raw) return;
    const upper = raw.toUpperCase();

    if (upper === "HELP" || upper === "?") {
      setShowShortcuts(true);
      return;
    }

    if (upper === "FULL" || upper === "MAX" || upper === "MAX CHART") {
      setMaximizedPanel("chart");
      return;
    }

    if (upper === "TRADER" || upper === "MAX TRADER" || upper === "SCANNER" || upper === "TIMEMACHINE") {
      setMaximizedPanel("trader");
      return;
    }

    if (upper === "LEFT" || upper === "SIDEBAR" || upper === "TOGGLE LEFT") {
      setShowLeftRail((prev) => !prev);
      return;
    }

    if (upper === "BINANCE" || upper === "SOURCE BINANCE") {
      setExchangeSource("binance");
      return;
    }

    if (upper === "BYBIT" || upper === "SOURCE BYBIT") {
      setExchangeSource("bybit");
      return;
    }

    if (upper === "OKX" || upper === "SOURCE OKX") {
      setExchangeSource("okx");
      return;
    }

    if (upper === "GRID" || upper === "RESTORE" || upper === "ESC") {
      setMaximizedPanel(null);
      return;
    }

    if (upper.startsWith("THEME ")) {
      const themeQuery = upper.slice(6).trim().toLowerCase();
      const match = THEME_PRESETS.find((p) => p.name.toLowerCase().includes(themeQuery));
      if (match) {
        applyPreset(match.name);
        return;
      }
    }

    // Check for "SYMBOL TIMEFRAME" pattern, e.g. "BTC 15M" or "SOL 1D"
    const parts = raw.split(/[\s,]+/);
    if (parts.length >= 2) {
      const symCandidate = resolvePrefix(parts[0]);
      const tfCandidate = parts[1].toLowerCase();
      if (symCandidate && TIMEFRAMES.includes(tfCandidate as any)) {
        setSelectedSymbol(symCandidate);
        setTimeframe(tfCandidate);
        return;
      }
    }

    const resolved = resolvePrefix(raw);
    if (resolved) {
      setSelectedSymbol(resolved);
    }
  }, [applyPreset]);

  // Below this width the fixed 12-column desktop grid stops working, so the
  // whole layout collapses to a single scrollable column.
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (narrow) {
    return (
      <div
        className="app-scale flex flex-col overflow-y-auto overflow-x-hidden"
        style={{ background: theme.bg }}
      >
        <CommandBar
          onCommand={handleCommand}
          onSelectSymbol={setSelectedSymbol}
          selectedSymbol={selectedSymbol}
          onOpenSettings={() => setShowSettings(true)}
          onOpenShortcuts={() => setShowShortcuts(true)}
          onOpenSymbolSearch={() => setShowSymbolSearch(true)}
        />

        <div className="flex flex-col gap-px p-px" style={{ background: theme.border }}>
          <div style={{ background: theme.panel }}>
            <MarketStats
              symbol={selectedSymbol}
              ticker={ticker}
              exchangeSource={exchangeSource}
              onChangeExchangeSource={setExchangeSource}
            />
          </div>

          <div style={{ background: theme.panel, height: 420 }}>
            <PriceChart
              symbol={selectedSymbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              ticker={ticker}
              onOpenSymbolSearch={() => setShowSymbolSearch(true)}
            />
          </div>

          <div style={{ background: theme.panel, height: 360 }}>
            <DayTraderPanel
              symbol={selectedSymbol}
              timeframe={timeframe}
              onSelectSymbol={setSelectedSymbol}
              onSelectTimeframe={setTimeframe}
              onAddAlert={addAlert}
            />
          </div>

          <div style={{ background: theme.panel, height: 260 }}>
            <Watchlist selected={selectedSymbol} onSelect={setSelectedSymbol} />
          </div>

          <div style={{ background: theme.panel, height: 320 }}>
            <OrderBook />
          </div>

          <div style={{ background: theme.panel, height: 320 }}>
            <TradeTape />
          </div>

          <div style={{ background: theme.panel, height: 260 }}>
            <MarketSentimentPanel symbol={selectedSymbol} />
          </div>

          <div style={{ background: theme.panel, height: 320 }}>
            <EconomicCalendarPanel />
          </div>

          <div style={{ background: theme.panel, height: 320 }}>
            <MarketHeatmapPanel onSelect={setSelectedSymbol} selected={selectedSymbol} />
          </div>

          <div style={{ background: theme.panel, height: 320 }}>
            <MarketSessionsPanel />
          </div>

          <div style={{ background: theme.panel, height: 360 }}>
            <AlertsPanel
              alerts={alerts}
              symbol={selectedSymbol}
              onAddAlert={addAlert}
              onToggleArmed={toggleAlertArmed}
              onRemoveAlert={removeAlert}
              prefs={prefs}
              onPrefsChange={updatePrefs}
              onEnableSound={primeAudio}
              onTestSound={testSound}
              onRequestDesktopNotification={requestDesktopNotification}
            />
          </div>

          <div style={{ background: theme.panel, height: 420 }}>
            <NewsFeedPanel symbol={selectedSymbol} />
          </div>
        </div>

        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
        {showShortcuts && <HotkeysModal onClose={() => setShowShortcuts(false)} />}
        {showSymbolSearch && (
          <SymbolSearchModal
            isOpen={showSymbolSearch}
            onClose={() => setShowSymbolSearch(false)}
            onSelectSymbol={setSelectedSymbol}
            selectedSymbol={selectedSymbol}
          />
        )}
        {showNotification && <AlertNotification alert={showNotification} onDismiss={dismissNotification} />}
      </div>
    );
  }

  const isRightWidgetExpanded =
    maximizedPanel !== null && DEFAULT_ORDER.includes(maximizedPanel as PanelId);
  const isFullScreenMaximized = maximizedPanel !== null && !isRightWidgetExpanded;

  const marketStatsSpan = showLeftRail ? "col-span-10" : "col-span-12";
  const chartColSpan = isRightWidgetExpanded
    ? showLeftRail
      ? "col-span-4"
      : "col-span-6"
    : showLeftRail
      ? "col-span-7"
      : "col-span-9";
  const rightColSpan = isRightWidgetExpanded ? "col-span-6" : "col-span-3";

  return (
    <div className="app-scale flex flex-col overflow-hidden" style={{ background: theme.bg }}>
      <CommandBar
        onCommand={handleCommand}
        onSelectSymbol={setSelectedSymbol}
        selectedSymbol={selectedSymbol}
        onOpenSettings={() => setShowSettings(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenSymbolSearch={() => setShowSymbolSearch(true)}
        showLeftRail={showLeftRail}
        onToggleLeftRail={() => setShowLeftRail((prev) => !prev)}
      />

      {isFullScreenMaximized ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: theme.panel }}>
          <div
            className="h-7 px-3 flex items-center justify-between border-b shrink-0 text-[10px]"
            style={{ background: theme.bg, borderColor: theme.border }}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider" style={{ color: theme.yellow }}>
                MAXIMIZED: {maximizedPanel.toUpperCase()}
              </span>
              <span style={{ color: theme.dim }}>({selectedSymbol})</span>
            </div>
            <button
              onClick={() => setMaximizedPanel(null)}
              className="px-2 py-0.5 rounded border hover:opacity-80 font-mono text-[10px]"
              style={{ borderColor: theme.border, color: theme.text }}
            >
              ✕ Restore Grid (Esc)
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {renderMaximizedContent(maximizedPanel)}
          </div>
        </div>
      ) : (
        <div
          className="flex-1 grid grid-cols-12 gap-px p-px overflow-hidden min-h-0"
          style={{ background: theme.border, gridTemplateRows: "auto minmax(0, 1fr)" }}
        >
          {/* Left rail: watchlist over economic calendar over market heatmap (collapsible) */}
          {showLeftRail && (
            <div
              className="col-span-2 overflow-hidden flex flex-col min-h-0"
              style={{ background: theme.panel, gridRow: "1 / -1" }}
            >
              <div className="flex-1 min-h-0 overflow-y-auto">
                <Watchlist selected={selectedSymbol} onSelect={setSelectedSymbol} />
              </div>
              <div className="h-px shrink-0" style={{ background: theme.border }} />
              <div className="flex-1 min-h-0 overflow-hidden">
                <EconomicCalendarPanel />
              </div>
              <div className="h-px shrink-0" style={{ background: theme.border }} />
              <div className="flex-1 min-h-0 overflow-hidden">
                <MarketHeatmapPanel onSelect={setSelectedSymbol} selected={selectedSymbol} />
              </div>
            </div>
          )}

          <div className={`${marketStatsSpan} shrink-0`} style={{ background: theme.panel }}>
            <MarketStats
              symbol={selectedSymbol}
              ticker={ticker}
              exchangeSource={exchangeSource}
              onChangeExchangeSource={setExchangeSource}
            />
          </div>

          <div className={`${chartColSpan} overflow-hidden min-h-0`} style={{ background: theme.panel }}>
            <PriceChart
              symbol={selectedSymbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              onToggleMaximize={() => setMaximizedPanel("chart")}
              isMaximized={false}
              ticker={ticker}
              onOpenSymbolSearch={() => setShowSymbolSearch(true)}
            />
          </div>

          {isRightWidgetExpanded && maximizedPanel ? (
            <div
              className={`${rightColSpan} flex flex-col min-h-0 overflow-hidden`}
              style={{ background: theme.panel }}
            >
              <div
                className="h-7 px-3 flex items-center justify-between border-b shrink-0 text-[10px]"
                style={{ background: theme.bg, borderColor: `${theme.dim}55` }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-wider" style={{ color: theme.yellow }}>
                    EXPANDED RIGHT PANEL: {PANEL_TITLES[maximizedPanel as PanelId]?.toUpperCase() || maximizedPanel.toUpperCase()}
                  </span>
                  <span style={{ color: theme.dim }}>({selectedSymbol})</span>
                </div>
                <button
                  onClick={() => setMaximizedPanel(null)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded border hover:opacity-90 font-mono font-bold text-[10px] cursor-pointer"
                  style={{
                    borderColor: `${theme.yellow}80`,
                    background: `${theme.yellow}18`,
                    color: theme.yellow,
                  }}
                >
                  ✕ RESTORE RIGHT GRID (Esc)
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {renderMaximizedContent(maximizedPanel)}
              </div>
            </div>
          ) : (
            <div
              className={`${rightColSpan} overflow-y-auto min-h-0 p-1.5 flex flex-col gap-2`}
              style={{ background: theme.bg }}
            >
              <div className="grid grid-cols-2 gap-2" style={{ gridAutoFlow: "row dense" }}>
                {panelOrder.slice(0, 3).map(renderPanel)}
              </div>

              {/* Secondary Toggle Widgets Header + Scrollable Cards */}
              <div
                className="rounded border px-2 py-1.5 flex flex-col gap-1.5 shrink-0"
                style={{
                  background: theme.panel,
                  borderColor: `${theme.dim}55`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[9px] font-mono font-bold uppercase tracking-wider"
                    style={{ color: theme.yellow }}
                  >
                    ▼ MORE WIDGETS (TOGGLE & SCROLL)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedPanels((prev) => {
                          const next = { ...prev };
                          for (const id of SECONDARY_PANELS) next[id] = false;
                          return next;
                        })
                      }
                      className="px-1.5 py-0.5 rounded border text-[8px] font-mono font-bold hover:opacity-90 cursor-pointer"
                      style={{
                        borderColor: `${theme.dim}45`,
                        background: theme.bg,
                        color: theme.text,
                      }}
                    >
                      SHOW ALL
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedPanels((prev) => {
                          const next = { ...prev };
                          for (const id of SECONDARY_PANELS) next[id] = true;
                          return next;
                        })
                      }
                      className="px-1.5 py-0.5 rounded border text-[8px] font-mono font-bold hover:opacity-90 cursor-pointer"
                      style={{
                        borderColor: `${theme.dim}45`,
                        background: theme.bg,
                        color: theme.dim,
                      }}
                    >
                      HIDE ALL
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {panelOrder.slice(3).map((id) => {
                    const isOpen = !collapsedPanels[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => togglePanelCollapsed(id)}
                        className="px-2 py-0.5 rounded border text-[9px] font-mono font-bold transition-colors hover:opacity-90 cursor-pointer"
                        style={{
                          borderColor: isOpen ? theme.yellow : `${theme.dim}45`,
                          background: isOpen ? `${theme.yellow}20` : theme.bg,
                          color: isOpen ? theme.yellow : theme.dim,
                        }}
                      >
                        {isOpen ? "● " : "○ "}
                        {PANEL_TITLES[id]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2" style={{ gridAutoFlow: "row dense" }}>
                {panelOrder.slice(3).map(renderPanel)}
              </div>
            </div>
          )}
        </div>
      )}

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onResetLayout={() => {
            setPanelOrder([...DEFAULT_ORDER]);
            setCollapsedPanels({ ...DEFAULT_COLLAPSED });
            setShowLeftRail(true);
            setExchangeSource("binance");
            setMaximizedPanel(null);
            try {
              window.localStorage.removeItem(ORDER_KEY);
              window.localStorage.removeItem(COLLAPSED_PANELS_KEY);
              window.localStorage.removeItem(LEFT_RAIL_KEY);
              window.localStorage.removeItem(EXCHANGE_SOURCE_KEY);
            } catch {}
          }}
        />
      )}
      {showShortcuts && <HotkeysModal onClose={() => setShowShortcuts(false)} />}
      {showSymbolSearch && (
        <SymbolSearchModal
          isOpen={showSymbolSearch}
          onClose={() => setShowSymbolSearch(false)}
          onSelectSymbol={setSelectedSymbol}
          selectedSymbol={selectedSymbol}
        />
      )}
      {showNotification && <AlertNotification alert={showNotification} onDismiss={dismissNotification} />}
    </div>
  );
}
