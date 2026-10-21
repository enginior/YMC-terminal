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
import ExchangePanel from "@/components/ExchangePanel";
import ComparisonPanel from "@/components/ComparisonPanel";
import EconomicCalendarPanel from "@/components/EconomicCalendarPanel";
import CorrelationPanel from "@/components/CorrelationPanel";
import NewsFeedPanel from "@/components/NewsFeedPanel";
import MarketSentimentPanel from "@/components/MarketSentimentPanel";
import HotkeysModal from "@/components/HotkeysModal";
import Panel from "@/components/Panel";
import { useTheme, THEME_PRESETS } from "@/context/ThemeContext";
import { useMultiExchangeData } from "@/hooks/useMultiExchangeData";
import { useAlerts } from "@/hooks/useAlerts";
import { toBinanceSymbol, resolvePrefix, UNIVERSE } from "@/lib/symbols";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"] as const;

const DEFAULT_ORDER = [
  "orderbook",
  "tradetape",
  "alerts",
  "sentiment",
  "exchange",
  "correlation",
  "news",
] as const;

type PanelId = (typeof DEFAULT_ORDER)[number];

const ORDER_KEY = "btc-terminal:panel-order";

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
    // Drop unknown ids and append missing ones so the grid can never tear
    const known = parsed.filter((id): id is PanelId => DEFAULT_ORDER.includes(id));
    const missing = DEFAULT_ORDER.filter((id) => !known.includes(id));
    return [...known, ...missing];
  } catch {
    return [...DEFAULT_ORDER];
  }
}

export default function Home() {
  const { theme, applyPreset } = useTheme();
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [maximizedPanel, setMaximizedPanel] = useState<string | null>(null);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [price, setPrice] = useState(0);
  const [ticker, setTicker] = useState<TickerStats | null>(null);
  const [panelOrder, setPanelOrder] = useState<PanelId[]>([...DEFAULT_ORDER]);
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

      // f key toggles maximize on chart or restores grid
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setMaximizedPanel((prev) => (prev ? null : "chart"));
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
  }, []);

  useEffect(() => {
    if (!orderHydrated.current) return;
    try {
      window.localStorage.setItem(ORDER_KEY, JSON.stringify(panelOrder));
    } catch {
      /* private mode or quota — layout just won't persist */
    }
  }, [panelOrder]);

  const binanceSymbol = toChartSymbol(selectedSymbol) ?? "BTCUSDT";

  const {
    prices: exchangePrices,
    aggregatedPrice,
    candles,
    trades,
    orderBook,
    connected,
    exchangeCount,
    candleError,
  } = useMultiExchangeData(binanceSymbol, timeframe);

  // Live price comes only from the sockets. When they drop we hold the last real
  // value and flag it, rather than inventing a drifting number.
  //
  // The socket fires many times a second, so committing it straight to state
  // re-rendered the entire tree on every trade. The live value lands in a ref and
  // is flushed into state on a 1s timer instead, which is all the UI resolves to.
  const livePriceRef = useRef(0);
  livePriceRef.current = aggregatedPrice > 0 ? aggregatedPrice : livePriceRef.current;

  useEffect(() => {
    const id = setInterval(() => {
      const next = livePriceRef.current;
      if (next > 0) setPrice(next);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Direction is derived, never set from inside another state updater
  const prevPriceRef = useRef(0);
  useEffect(() => {
    if (price <= 0) return;
    setDirection(price >= prevPriceRef.current ? "up" : "down");
    prevPriceRef.current = price;
  }, [price]);

  const { alerts, addAlert, removeAlert, showNotification, dismissNotification, prefs, updatePrefs, primeAudio } = useAlerts(price);

  // Real 24hr stats from Binance
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/ticker?symbol=${binanceSymbol}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (!cancelled && json.lastPrice) setTicker(json);
      } catch {
        /* keep previous values rather than blanking the strip */
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [binanceSymbol]);

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

  const renderPanel = (id: PanelId) => {
    const index = panelOrder.indexOf(id);
    // `key` is passed explicitly by the caller — spreading it triggers a React warning
    const props = {
      height: id === "news" ? 300 : 200,
      span: (id === "news" ? 2 : 1) as 1 | 2,
      onDragStart: () => handleDragStart(index),
      onDragOver: noDragOver,
      onDrop: () => handleDrop(index),
      isDragging: dragIndex === index,
      onToggleMaximize: () => setMaximizedPanel(maximizedPanel === id ? null : id),
      isMaximized: maximizedPanel === id,
    };

    let body: React.ReactNode;
    switch (id) {
      case "orderbook":
        body = <OrderBook data={orderBook} />;
        break;
      case "tradetape":
        body = <TradeTape trades={trades} />;
        break;
      case "alerts":
        body = (
<AlertsPanel
              alerts={alerts}
              currentPrice={price}
              symbol={selectedSymbol}
              onAddAlert={addAlert}
              onRemoveAlert={removeAlert}
              prefs={prefs}
              onPrefsChange={updatePrefs}
              onEnableSound={primeAudio}
            />
        );
        break;
      case "sentiment":
        body = <MarketSentimentPanel symbol={selectedSymbol} />;
        break;
      case "exchange":
        body = (
          <ExchangePanel
            prices={exchangePrices}
            aggregatedPrice={aggregatedPrice}
            exchangeCount={exchangeCount}
          />
        );
        break;
      case "correlation":
        body = <CorrelationPanel />;
        break;
      case "news":
        body = <NewsFeedPanel />;
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
            candles={candles}
            symbol={selectedSymbol}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            candleError={candleError}
            onToggleMaximize={() => setMaximizedPanel(null)}
            isMaximized={true}
            ticker={ticker}
          />
        );
      case "orderbook":
        return <OrderBook data={orderBook} />;
      case "tradetape":
        return <TradeTape trades={trades} />;
      case "alerts":
        return (
          <AlertsPanel
            alerts={alerts}
            currentPrice={price}
            symbol={selectedSymbol}
            onAddAlert={addAlert}
            onRemoveAlert={removeAlert}
            prefs={prefs}
            onPrefsChange={updatePrefs}
            onEnableSound={primeAudio}
          />
        );
      case "sentiment":
        return <MarketSentimentPanel symbol={selectedSymbol} />;
      case "exchange":
        return (
          <ExchangePanel
            prices={exchangePrices}
            aggregatedPrice={aggregatedPrice}
            exchangeCount={exchangeCount}
          />
        );
      case "correlation":
        return <CorrelationPanel />;
      case "news":
        return <NewsFeedPanel />;
      case "calendar":
        return <EconomicCalendarPanel />;
      case "comparison":
        return <ComparisonPanel />;
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
        />

        <div className="flex flex-col gap-px p-px" style={{ background: theme.border }}>
          <div style={{ background: theme.panel }}>
            <MarketStats
              symbol={selectedSymbol}
              price={price}
              direction={direction}
              ticker={ticker}
              connected={connected}
            />
          </div>

          <div style={{ background: theme.panel, height: 420 }}>
            <PriceChart
              candles={candles}
              symbol={selectedSymbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              candleError={candleError}
              ticker={ticker}
            />
          </div>

          <div style={{ background: theme.panel, height: 260 }}>
            <Watchlist selected={selectedSymbol} onSelect={setSelectedSymbol} />
          </div>

          <div style={{ background: theme.panel, height: 320 }}>
            <OrderBook data={orderBook} />
          </div>

          <div style={{ background: theme.panel, height: 320 }}>
            <TradeTape trades={trades} />
          </div>

          <div style={{ background: theme.panel, height: 260 }}>
            <MarketSentimentPanel symbol={selectedSymbol} />
          </div>

          <div style={{ background: theme.panel, height: 340 }}>
            <ExchangePanel
              prices={exchangePrices}
              aggregatedPrice={aggregatedPrice}
              exchangeCount={exchangeCount}
            />
          </div>

          <div style={{ background: theme.panel, height: 320 }}>
            <EconomicCalendarPanel />
          </div>

          <div style={{ background: theme.panel, height: 320 }}>
            <ComparisonPanel />
          </div>

          <div style={{ background: theme.panel, height: 320 }}>
            <CorrelationPanel />
          </div>

          <div style={{ background: theme.panel, height: 360 }}>
            <AlertsPanel
              alerts={alerts}
              currentPrice={price}
              symbol={selectedSymbol}
              onAddAlert={addAlert}
              onRemoveAlert={removeAlert}
              prefs={prefs}
              onPrefsChange={updatePrefs}
              onEnableSound={primeAudio}
            />
          </div>

          <div style={{ background: theme.panel, height: 420 }}>
            <NewsFeedPanel />
          </div>
        </div>

        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
        {showShortcuts && <HotkeysModal onClose={() => setShowShortcuts(false)} />}
        {showNotification && <AlertNotification alert={showNotification} onDismiss={dismissNotification} />}
      </div>
    );
  }

  return (
    <div className="app-scale flex flex-col overflow-hidden" style={{ background: theme.bg }}>
      <CommandBar
        onCommand={handleCommand}
        onSelectSymbol={setSelectedSymbol}
        selectedSymbol={selectedSymbol}
        onOpenSettings={() => setShowSettings(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
      />

      {maximizedPanel ? (
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
          {/* Left rail: watchlist over a permanent full-height comparison panel */}
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
              <ComparisonPanel />
            </div>
          </div>

          <div className="col-span-10 shrink-0" style={{ background: theme.panel }}>
            <MarketStats
              symbol={selectedSymbol}
              price={price}
              direction={direction}
              ticker={ticker}
              connected={connected}
            />
          </div>

          <div className="col-span-7 overflow-hidden min-h-0" style={{ background: theme.panel }}>
            <PriceChart
              candles={candles}
              symbol={selectedSymbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              candleError={candleError}
              onToggleMaximize={() => setMaximizedPanel("chart")}
              isMaximized={false}
              ticker={ticker}
            />
          </div>

          <div className="col-span-3 overflow-y-auto min-h-0" style={{ background: theme.panel }}>
            <div className="grid grid-cols-2 gap-px" style={{ background: theme.border }}>
              {panelOrder.map(renderPanel)}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onResetLayout={() => {
            setPanelOrder([...DEFAULT_ORDER]);
            try {
              window.localStorage.removeItem(ORDER_KEY);
            } catch {}
          }}
        />
      )}
      {showShortcuts && <HotkeysModal onClose={() => setShowShortcuts(false)} />}
      {showNotification && <AlertNotification alert={showNotification} onDismiss={dismissNotification} />}
    </div>
  );
}
