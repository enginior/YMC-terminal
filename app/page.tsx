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
import CorrelationPanel from "@/components/CorrelationPanel";
import NewsFeedPanel from "@/components/NewsFeedPanel";
import MarketSentimentPanel from "@/components/MarketSentimentPanel";
import Panel from "@/components/Panel";
import { useTheme } from "@/context/ThemeContext";
import { useMultiExchangeData } from "@/hooks/useMultiExchangeData";
import { useAlerts } from "@/hooks/useAlerts";
import { toBinanceSymbol, resolvePrefix } from "@/lib/symbols";

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
  const { theme } = useTheme();
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [showSettings, setShowSettings] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [price, setPrice] = useState(0);
  const [ticker, setTicker] = useState<TickerStats | null>(null);
  const [panelOrder, setPanelOrder] = useState<PanelId[]>([...DEFAULT_ORDER]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

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
        body = <MarketSentimentPanel />;
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

  const handleCommand = useCallback((cmd: string) => {
    const resolved = resolvePrefix(cmd);
    if (resolved) setSelectedSymbol(resolved);
  }, []);

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
            <MarketSentimentPanel />
          </div>

          <div style={{ background: theme.panel, height: 340 }}>
            <ExchangePanel
              prices={exchangePrices}
              aggregatedPrice={aggregatedPrice}
              exchangeCount={exchangeCount}
            />
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
      />

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
          />
        </div>

        <div className="col-span-3 overflow-y-auto min-h-0" style={{ background: theme.panel }}>
          <div className="grid grid-cols-2 gap-px" style={{ background: theme.border }}>
            {panelOrder.map(renderPanel)}
          </div>
        </div>
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showNotification && <AlertNotification alert={showNotification} onDismiss={dismissNotification} />}
    </div>
  );
}
