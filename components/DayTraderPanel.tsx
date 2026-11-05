"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useMarket, marketStore } from "@/lib/marketStore";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { toBinanceSymbol } from "@/lib/symbols";
import { Candle } from "@/lib/types";
import { AssetIcon } from "@/components/AssetIcon";
import {
  STRATEGIES,
  StrategyFilter,
  RMultipleOption,
  HorizonOption,
  TraderSignal,
  MtfCellSummary,
  evaluateMtfCell,
  detectStrategySignals,
  runTimeMachine,
} from "@/lib/traderEngine";
import { STRATEGY_OVERLAY_KEY, StrategyOverlayConfig } from "./chart/useStrategyMarkers";

const FOCUS_PAIRS = ["BTC/USDT", "XAU/USDT"] as const;
const SCAN_TIMEFRAMES = ["5m", "15m", "1h", "4h"] as const;
const R_OPTIONS: RMultipleOption[] = [1.5, 2.0, 3.0];
const HORIZON_OPTIONS: HorizonOption[] = [12, 24, 48];
const PREFS_KEY = "btc-terminal:day-trader-prefs";

const TF_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "2h": 7200,
  "4h": 14400,
  "1d": 86400,
};

export interface DayTraderPanelProps {
  symbol: string;
  timeframe: string;
  onSelectSymbol: (symbol: string) => void;
  onSelectTimeframe: (tf: string) => void;
  onAddAlert?: (
    symbol: string,
    condition: "above" | "below",
    price: number,
    options?: { isArmed?: boolean; label?: string }
  ) => void;
}

function fmtPrice(p: number): string {
  if (!Number.isFinite(p) || p === 0) return "$0.00";
  if (p >= 1000) {
    return `$${p.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}`;
  }
  return `$${p.toFixed(2)}`;
}

function fmtTimeShort(sec: number): string {
  const d = new Date(sec * 1000);
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hr = String(d.getUTCHours()).padStart(2, "0");
  const mn = String(d.getUTCMinutes()).padStart(2, "0");
  return `${mo}/${day} ${hr}:${mn}`;
}

export default function DayTraderPanel({
  symbol,
  timeframe,
  onSelectSymbol,
  onSelectTimeframe,
  onAddAlert,
}: DayTraderPanelProps) {
  const { theme } = useTheme();
  // Select a primitive timestamp so DayTraderPanel only re-renders when a new bar opens, not on 4Hz intrabar ticks
  const activeLastTime = useMarket((s) =>
    s.candles.length > 0 ? s.candles[s.candles.length - 1].time : 0
  );
  const exchangeSource = useMarket((s) => s.exchangeSource);

  const [activeTab, setActiveTab] = useState<"scanner" | "timemachine">("scanner");
  const [strategyFilter, setStrategyFilter] = useState<StrategyFilter>("all");
  const [rrRatio, setRrRatio] = useState<RMultipleOption>(2.0);
  const [horizon, setHorizon] = useState<HorizonOption>(24);
  const [pineOverlay, setPineOverlay] = useState(false);
  const [pairFilter, setPairFilter] = useState<"ALL" | "BTC/USDT" | "XAU/USDT">("ALL");

  // Multi-timeframe candle cache keyed by `${pair}:${tf}`
  const [mtfCandles, setMtfCandles] = useState<Record<string, Candle[]>>({});
  const [loadingScan, setLoadingScan] = useState(false);
  const [selectedSetup, setSelectedSetup] = useState<TraderSignal | null>(null);
  const [armedIds, setArmedIds] = useState<Record<string, boolean>>({});
  const [plottedIds, setPlottedIds] = useState<Record<string, boolean>>({});

  const skipNextSaveRef = useRef(true);
  const skipOverlaySaveRef = useRef(true);

  // Hydrate persisted Day Trader preferences
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.strategyFilter) setStrategyFilter(parsed.strategyFilter);
        if (parsed.rrRatio === 1.5 || parsed.rrRatio === 2.0 || parsed.rrRatio === 3.0) {
          setRrRatio(parsed.rrRatio);
        }
        if (parsed.horizon === 12 || parsed.horizon === 24 || parsed.horizon === 48) {
          setHorizon(parsed.horizon);
        }
        if (parsed.pairFilter) setPairFilter(parsed.pairFilter);
      }
      const rawOverlay = localStorage.getItem(STRATEGY_OVERLAY_KEY);
      if (rawOverlay) {
        const parsedOv = JSON.parse(rawOverlay);
        if (typeof parsedOv?.enabled === "boolean") {
          setPineOverlay(parsedOv.enabled);
        }
      }
    } catch {}
  }, []);

  // Persist Day Trader preferences (skipping initial mount write)
  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ strategyFilter, rrRatio, horizon, pairFilter })
      );
    } catch {}
  }, [strategyFilter, rrRatio, horizon, pairFilter]);

  // Broadcast & persist Pine-style Strategy Overlay config to PriceChart
  useEffect(() => {
    if (skipOverlaySaveRef.current) {
      skipOverlaySaveRef.current = false;
      return;
    }
    const payload: StrategyOverlayConfig = {
      enabled: pineOverlay,
      strategyFilter,
      rrRatio,
    };
    try {
      localStorage.setItem(STRATEGY_OVERLAY_KEY, JSON.stringify(payload));
    } catch {}
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("btc-terminal:strategy-overlay", { detail: payload })
      );
    }
  }, [pineOverlay, strategyFilter, rrRatio]);

  // Clear inspected setup if user switches main chart symbol so Time Machine follows the active chart
  useEffect(() => {
    setSelectedSetup((prev) => (prev && prev.symbol !== symbol ? null : prev));
  }, [symbol]);

  // Sync active chart candles into mtfCandles only when store symbol & timeframe match active props
  useEffect(() => {
    const state = marketStore.getState();
    const expectedSym = toBinanceSymbol(symbol) ?? symbol;
    if (
      state.candles.length > 0 &&
      state.symbol.toUpperCase() === expectedSym.toUpperCase() &&
      state.interval === timeframe
    ) {
      const key = `${symbol}:${timeframe}`;
      const tail = state.candles.slice(-250);
      setMtfCandles((prev) => ({ ...prev, [key]: tail }));
    }
  }, [activeLastTime, symbol, timeframe]);

  // Fetch multi-timeframe klines for BTC/USDT and XAU/USDT
  const fetchMtfKlines = useCallback(async () => {
    setLoadingScan(true);
    try {
      const tasks: Promise<[string, Candle[]]>[] = [];
      for (const pair of FOCUS_PAIRS) {
        const binanceSym = toBinanceSymbol(pair) ?? "BTCUSDT";
        for (const tf of SCAN_TIMEFRAMES) {
          const key = `${pair}:${tf}`;
          tasks.push(
            fetch(`/api/klines?symbol=${binanceSym}&interval=${tf}&source=${exchangeSource}&limit=200`)
              .then((res) => (res.ok ? res.json() : []))
              .then((data) => [key, Array.isArray(data) ? data : []] as [string, Candle[]])
              .catch(() => [key, []] as [string, Candle[]])
          );
        }
      }
      const results = await Promise.all(tasks);
      setMtfCandles((prev) => {
        const next = { ...prev };
        for (const [k, arr] of results) {
          if (arr.length > 0) next[k] = arr;
        }
        return next;
      });
    } finally {
      setLoadingScan(false);
    }
  }, [exchangeSource]);

  useVisibilityPolling(fetchMtfKlines, 30000);

  // Compute the 2x4 MTF Matrix for BTC/USDT and XAU/USDT
  const mtfMatrix = useMemo(() => {
    const rows: Record<string, MtfCellSummary[]> = {};
    for (const pair of FOCUS_PAIRS) {
      rows[pair] = SCAN_TIMEFRAMES.map((tf) => {
        const candles = mtfCandles[`${pair}:${tf}`] ?? [];
        return evaluateMtfCell(candles, pair, tf, strategyFilter, rrRatio);
      });
    }
    return rows;
  }, [mtfCandles, strategyFilter, rrRatio]);

  // Collect and rank actionable setups across BTC/USDT and XAU/USDT
  const detectedSetups = useMemo(() => {
    const list: TraderSignal[] = [];
    const pairs = pairFilter === "ALL" ? FOCUS_PAIRS : [pairFilter];
    for (const pair of pairs) {
      for (const tf of SCAN_TIMEFRAMES) {
        const candles = mtfCandles[`${pair}:${tf}`] ?? [];
        if (candles.length < 30) continue;
        const sigs = detectStrategySignals(candles, pair, tf, strategyFilter, rrRatio);
        if (sigs.length > 0) {
          // Take the 2 most recent signals per timeframe so user sees live + immediate prior setup
          const recent = sigs.slice(-2);
          list.push(...recent);
        }
      }
    }
    // Sort by recency (barsAgo ascending) then confidence descending
    return list.sort((a, b) => {
      if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
      if (a.barsAgo !== b.barsAgo) return a.barsAgo - b.barsAgo;
      return b.confidence - a.confidence;
    });
  }, [mtfCandles, pairFilter, strategyFilter, rrRatio]);

  // Run the Hybrid Time Machine for the currently inspected setup or active chart pair/timeframe
  const tmTargetSymbol = selectedSetup?.symbol ?? (symbol === "XAU/USDT" ? "XAU/USDT" : "BTC/USDT");
  const tmTargetTf = selectedSetup?.timeframe ?? timeframe;
  const tmCandles = useMemo(() => {
    const key = `${tmTargetSymbol}:${tmTargetTf}`;
    if (mtfCandles[key] && mtfCandles[key].length >= 35) return mtfCandles[key];
    return mtfCandles[`${tmTargetSymbol}:1h`] ?? [];
  }, [mtfCandles, tmTargetSymbol, tmTargetTf]);

  const timeMachineResult = useMemo(() => {
    return runTimeMachine(
      tmCandles,
      tmTargetSymbol,
      tmTargetTf,
      strategyFilter,
      rrRatio,
      horizon,
      selectedSetup
    );
  }, [tmCandles, tmTargetSymbol, tmTargetTf, strategyFilter, rrRatio, horizon, selectedSetup]);

  // Action: Plot Setup Long/Short Position Box directly on PriceChart
  const handlePlotSetup = useCallback(
    (sig: TraderSignal) => {
      if (sig.symbol !== symbol) onSelectSymbol(sig.symbol);
      if (sig.timeframe !== timeframe) onSelectTimeframe(sig.timeframe);

      const barSec = TF_SECONDS[sig.timeframe] ?? 3600;
      const time1 = sig.time;
      const time2 = sig.time + barSec * Math.max(8, Math.round(horizon * 0.6));

      // Dispatch after a micro-tick so symbol/timeframe state updates first if needed
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("btc-terminal:plot-setup", {
            detail: {
              symbol: sig.symbol,
              direction: sig.direction,
              time1,
              time2,
              entryPrice: sig.entryPrice,
              stopPrice: sig.stopPrice,
              targetPrice: sig.targetPrice,
              label: `${sig.badge} ${sig.direction}`,
            },
          })
        );
      }, 30);

      setPlottedIds((prev) => ({ ...prev, [sig.id]: true }));
      setTimeout(() => {
        setPlottedIds((prev) => ({ ...prev, [sig.id]: false }));
      }, 2200);
    },
    [symbol, timeframe, onSelectSymbol, onSelectTimeframe, horizon]
  );

  // Action: Arm both Target and Stop-Loss Alerts in useAlerts (triggers "Order Filled" audio on hit)
  const handleArmAlerts = useCallback(
    (sig: TraderSignal) => {
      if (!onAddAlert) return;
      const tpCond = sig.direction === "LONG" ? "above" : "below";
      const slCond = sig.direction === "LONG" ? "below" : "above";
      onAddAlert(sig.symbol, tpCond, Number(sig.targetPrice.toFixed(2)), {
        isArmed: true,
        label: `${sig.strategyId.toUpperCase()} TP`,
      });
      onAddAlert(sig.symbol, slCond, Number(sig.stopPrice.toFixed(2)), {
        isArmed: true,
        label: `${sig.strategyId.toUpperCase()} SL`,
      });
      setArmedIds((prev) => ({ ...prev, [sig.id]: true }));
      setTimeout(() => {
        setArmedIds((prev) => ({ ...prev, [sig.id]: false }));
      }, 2200);
    },
    [onAddAlert]
  );

  // Render SVG Equity Curve for Time Machine
  const renderEquitySvg = () => {
    const pts = timeMachineResult.backtest.equityCurve;
    if (pts.length < 2) {
      return (
        <div
          className="h-14 flex items-center justify-center text-[10px] font-mono border rounded"
          style={{ borderColor: theme.border, color: theme.dim, background: theme.bg }}
        >
          Insufficient historical triggers for equity curve
        </div>
      );
    }

    const w = 280;
    const h = 52;
    const values = [0, ...pts.map((p) => p.cumulativeR)];
    const minV = Math.min(...values, -1);
    const maxV = Math.max(...values, 1);
    const span = Math.max(maxV - minV, 1e-4);

    const coords = values.map((v, idx) => {
      const x = (idx / (values.length - 1)) * (w - 8) + 4;
      const y = h - 5 - ((v - minV) / span) * (h - 10);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const zeroY = h - 5 - ((0 - minV) / span) * (h - 10);
    const lastR = values[values.length - 1];
    const strokeColor = lastR >= 0 ? theme.green : theme.red;

    return (
      <div
        className="relative rounded border px-1.5 py-1"
        style={{ borderColor: theme.border, background: theme.bg }}
      >
        <div className="flex items-center justify-between text-[9px] font-mono mb-0.5">
          <span style={{ color: theme.dim }}>
            STRATEGY EQUITY CURVE ({pts.length} TRADES)
          </span>
          <span className="font-bold" style={{ color: strokeColor }}>
            {lastR >= 0 ? `+${lastR.toFixed(2)}R` : `${lastR.toFixed(2)}R`}
          </span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12 overflow-visible">
          <line
            x1={0}
            y1={zeroY}
            x2={w}
            y2={zeroY}
            stroke={theme.border}
            strokeDasharray="2 2"
            strokeWidth={1}
          />
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.6}
            points={coords.join(" ")}
          />
        </svg>
      </div>
    );
  };

  return (
    <div
      className="h-full flex flex-col text-xs select-none overflow-hidden"
      style={{ background: theme.panel, color: theme.text }}
    >
      {/* Top Header Strip */}
      <div
        className="px-2.5 py-1.5 border-b flex items-center justify-between gap-1.5 shrink-0 flex-wrap"
        style={{ borderColor: theme.border, background: theme.bg }}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-bold tracking-wider text-[10px]" style={{ color: theme.yellow }}>
            DAY TRADER DESK
          </span>
          <div
            className="flex items-center rounded border overflow-hidden text-[9px] font-mono"
            style={{ borderColor: theme.border }}
          >
            <button
              onClick={() => setActiveTab("scanner")}
              className="px-2 py-0.5 font-bold transition-colors"
              style={{
                background: activeTab === "scanner" ? theme.yellow : "transparent",
                color: activeTab === "scanner" ? theme.bg : theme.dim,
              }}
            >
              SCANNER
            </button>
            <button
              onClick={() => setActiveTab("timemachine")}
              className="px-2 py-0.5 font-bold transition-colors"
              style={{
                background: activeTab === "timemachine" ? theme.yellow : "transparent",
                color: activeTab === "timemachine" ? theme.bg : theme.dim,
              }}
            >
              TIME MACHINE
            </button>
          </div>
        </div>

        {/* Pine-Style Strategy Selector Dropdown + Chart Signals Toggle */}
        <div className="flex items-center gap-1">
          <select
            aria-label="Select Pine-style trading strategy"
            value={strategyFilter}
            onChange={(e) => setStrategyFilter(e.target.value as StrategyFilter)}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border outline-none cursor-pointer"
            style={{
              background: theme.panel,
              color: theme.text,
              borderColor: theme.border,
            }}
          >
            <option value="all">ƒx All Setups ({STRATEGIES.length})</option>
            {STRATEGIES.map((s) => (
              <option key={s.id} value={s.id}>
                ƒx {s.shortName} ({s.badge})
              </option>
            ))}
          </select>

          <button
            onClick={() => setPineOverlay((prev) => !prev)}
            title="Toggle Pine-style historical Buy/Sell signal markers on the main chart"
            className="px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold transition-colors"
            style={{
              borderColor: pineOverlay ? theme.yellow : theme.border,
              background: pineOverlay ? `${theme.yellow}22` : theme.panel,
              color: pineOverlay ? theme.yellow : theme.dim,
            }}
          >
            📌 Signals {pineOverlay ? "ON" : "OFF"}
          </button>

          <button
            onClick={fetchMtfKlines}
            title="Rescan BTC & Gold multi-timeframe klines"
            className="px-1.5 py-0.5 rounded border text-[9px] font-mono hover:opacity-80"
            style={{ borderColor: theme.border, color: loadingScan ? theme.yellow : theme.dim }}
          >
            {loadingScan ? "..." : "↻"}
          </button>
        </div>
      </div>

      {/* Secondary Parameter Strip: Pair Filter, R-Multiple, Horizon */}
      <div
        className="px-2.5 py-1 border-b flex items-center justify-between gap-2 shrink-0 text-[9px] font-mono flex-wrap"
        style={{ borderColor: theme.border, background: theme.panel }}
      >
        {/* Pair Filter Pills */}
        <div className="flex items-center gap-1">
          {(["ALL", "BTC/USDT", "XAU/USDT"] as const).map((p) => {
            const active = pairFilter === p;
            const label = p === "ALL" ? "BTC+GOLD" : p === "BTC/USDT" ? "BTC" : "GOLD";
            return (
              <button
                key={p}
                onClick={() => setPairFilter(p)}
                className="px-1.5 py-0.2 rounded border transition-colors"
                style={{
                  borderColor: active ? theme.yellow : theme.border,
                  background: active ? `${theme.yellow}22` : "transparent",
                  color: active ? theme.yellow : theme.dim,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Target R:R & Horizon Pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <span style={{ color: theme.dim }}>R:R</span>
            {R_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRrRatio(r)}
                className="px-1 rounded border"
                style={{
                  borderColor: rrRatio === r ? theme.green : theme.border,
                  color: rrRatio === r ? theme.green : theme.dim,
                }}
              >
                {r}R
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5">
            <span style={{ color: theme.dim }}>HRZ</span>
            {HORIZON_OPTIONS.map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className="px-1 rounded border"
                style={{
                  borderColor: horizon === h ? theme.yellow : theme.border,
                  color: horizon === h ? theme.yellow : theme.dim,
                }}
              >
                {h}b
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {activeTab === "scanner" ? (
          <>
            {/* 2x4 Multi-Timeframe Confluence Matrix (BTC & GOLD) */}
            <div
              className="rounded border overflow-hidden"
              style={{ borderColor: theme.border, background: theme.bg }}
            >
              <div
                className="grid grid-cols-5 text-[9px] font-mono px-2 py-1 border-b"
                style={{ borderColor: theme.border, color: theme.dim }}
              >
                <span>PAIR</span>
                {SCAN_TIMEFRAMES.map((tf) => (
                  <span key={tf} className="text-center font-bold">
                    {tf.toUpperCase()}
                  </span>
                ))}
              </div>

              {FOCUS_PAIRS.filter((p) => pairFilter === "ALL" || pairFilter === p).map((pair) => {
                const cells = mtfMatrix[pair] ?? [];
                return (
                  <div
                    key={pair}
                    className="grid grid-cols-5 items-center px-2 py-1 border-b last:border-b-0 text-[9px] font-mono"
                    style={{ borderColor: theme.border }}
                  >
                    <button
                      onClick={() => onSelectSymbol(pair)}
                      className="flex items-center gap-1 text-left font-bold hover:opacity-80"
                      style={{ color: symbol === pair ? theme.yellow : theme.text }}
                    >
                      <AssetIcon symbol={pair} size={12} />
                      <span>{pair === "XAU/USDT" ? "GOLD" : "BTC"}</span>
                    </button>

                    {cells.map((cell) => {
                      const sig = cell.latestSignal;
                      const isActiveChart =
                        symbol === cell.symbol && timeframe === cell.timeframe;
                      const biasColor =
                        cell.bias === "BULL"
                          ? theme.green
                          : cell.bias === "BEAR"
                            ? theme.red
                            : theme.dim;

                      return (
                        <button
                          key={`${cell.symbol}-${cell.timeframe}`}
                          onClick={() => {
                            onSelectSymbol(cell.symbol);
                            onSelectTimeframe(cell.timeframe);
                            if (sig) setSelectedSetup(sig);
                          }}
                          title={
                            sig
                              ? `${sig.strategyName} (${sig.direction}) • ${sig.rationale}`
                              : `${cell.symbol} ${cell.timeframe} Bias: ${cell.bias}`
                          }
                          className="mx-0.5 px-1 py-0.5 rounded border flex flex-col items-center justify-center transition-colors"
                          style={{
                            borderColor: isActiveChart ? theme.yellow : theme.border,
                            background: sig?.isRecent
                              ? sig.direction === "LONG"
                                ? `${theme.green}18`
                                : `${theme.red}18`
                              : theme.panel,
                          }}
                        >
                          {sig && sig.barsAgo <= 6 ? (
                            <span
                              className="font-bold leading-tight"
                              style={{
                                color: sig.direction === "LONG" ? theme.green : theme.red,
                              }}
                            >
                              {sig.badge} {sig.direction === "LONG" ? "▲" : "▼"}
                            </span>
                          ) : (
                            <span className="leading-tight" style={{ color: biasColor }}>
                              {cell.bias === "BULL"
                                ? "BULL ▲"
                                : cell.bias === "BEAR"
                                  ? "BEAR ▼"
                                  : "FLAT •"}
                            </span>
                          )}
                          <span className="text-[8px]" style={{ color: theme.dim }}>
                            RSI {cell.rsi !== null ? cell.rsi.toFixed(0) : "--"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Detected Setup Cards */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[9px] font-mono px-0.5">
                <span style={{ color: theme.dim }}>
                  DETECTED SETUPS ({detectedSetups.length})
                </span>
                <span style={{ color: theme.dim }}>
                  ATR STOP • {rrRatio.toFixed(1)}R TARGET
                </span>
              </div>

              {detectedSetups.length === 0 ? (
                <div
                  className="p-3 rounded border text-center font-mono text-[10px]"
                  style={{ borderColor: theme.border, color: theme.dim, background: theme.bg }}
                >
                  {loadingScan
                    ? "Scanning BTC/USDT & XAU/USDT multi-timeframe klines..."
                    : `No setups matching current filter. Try 'All Setups (${STRATEGIES.length})' or another timeframe.`}
                </div>
              ) : (
                detectedSetups.slice(0, 8).map((sig) => {
                  const isLong = sig.direction === "LONG";
                  const dirColor = isLong ? theme.green : theme.red;
                  const isArmed = Boolean(armedIds[sig.id]);
                  const isPlotted = Boolean(plottedIds[sig.id]);

                  return (
                    <div
                      key={sig.id}
                      className="p-2 rounded border space-y-1.5 transition-colors"
                      style={{
                        borderColor:
                          selectedSetup?.id === sig.id ? theme.yellow : theme.border,
                        background: theme.bg,
                      }}
                    >
                      {/* Row 1: Symbol + TF + Strategy Badge + Direction + Recency + Confidence */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <AssetIcon symbol={sig.symbol} size={13} />
                          <span className="font-bold font-mono text-[10px]">
                            {sig.symbol === "XAU/USDT" ? "GOLD/USDT" : sig.symbol}
                          </span>
                          <span
                            className="px-1 py-0.2 rounded text-[9px] font-mono font-bold"
                            style={{ background: theme.panel, color: theme.yellow }}
                          >
                            {sig.timeframe.toUpperCase()}
                          </span>
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold"
                            style={{
                              background: `${dirColor}22`,
                              color: dirColor,
                            }}
                          >
                            {sig.direction} • {sig.badge}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 font-mono text-[9px]">
                          <span
                            style={{
                              color: sig.barsAgo <= 1 ? theme.yellow : theme.dim,
                            }}
                          >
                            {sig.barsAgo === 0
                              ? "LIVE BAR"
                              : `${sig.barsAgo}b ago`}
                          </span>
                          <span
                            className="font-bold"
                            style={{ color: sig.confidence >= 75 ? theme.green : theme.text }}
                          >
                            {sig.confidence}% CONF
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Deterministic Quant Rationale */}
                      <div
                        className="text-[10px] font-mono leading-snug"
                        style={{ color: theme.dim }}
                      >
                        {sig.rationale}
                      </div>

                      {/* Row 3: Entry / Stop / Target Levels */}
                      <div
                        className="grid grid-cols-3 gap-1 px-1.5 py-1 rounded border font-mono text-[9px]"
                        style={{ borderColor: theme.border, background: theme.panel }}
                      >
                        <div>
                          <span style={{ color: theme.dim }}>ENTRY: </span>
                          <span className="font-bold">{fmtPrice(sig.entryPrice)}</span>
                        </div>
                        <div>
                          <span style={{ color: theme.dim }}>STOP: </span>
                          <span className="font-bold" style={{ color: theme.red }}>
                            {fmtPrice(sig.stopPrice)}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: theme.dim }}>TP ({sig.rrRatio}R): </span>
                          <span className="font-bold" style={{ color: theme.green }}>
                            {fmtPrice(sig.targetPrice)}
                          </span>
                        </div>
                      </div>

                      {/* Row 4: Action Buttons (Plot on Chart, Arm Alerts, Run Time Machine) */}
                      <div className="flex items-center justify-between gap-1 pt-0.5 font-mono text-[9px]">
                        <button
                          onClick={() => handlePlotSetup(sig)}
                          className="flex-1 py-1 px-1.5 rounded border font-bold text-center hover:opacity-90 transition-colors"
                          style={{
                            borderColor: isPlotted ? theme.green : theme.yellow,
                            background: isPlotted ? `${theme.green}22` : `${theme.yellow}18`,
                            color: isPlotted ? theme.green : theme.yellow,
                          }}
                        >
                          {isPlotted ? "✓ Plotted on Chart" : "📐 Plot on Chart"}
                        </button>

                        {onAddAlert && (
                          <button
                            onClick={() => handleArmAlerts(sig)}
                            className="py-1 px-2 rounded border font-bold hover:opacity-90 transition-colors"
                            style={{
                              borderColor: isArmed ? theme.green : theme.border,
                              background: isArmed ? `${theme.green}22` : theme.panel,
                              color: isArmed ? theme.green : theme.text,
                            }}
                          >
                            {isArmed ? "✓ Alerts Armed" : "🔔 Arm TP/SL"}
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedSetup(sig);
                            setActiveTab("timemachine");
                          }}
                          className="py-1 px-2 rounded border font-bold hover:opacity-90 transition-colors"
                          style={{
                            borderColor: theme.border,
                            background: theme.panel,
                            color: theme.yellow,
                          }}
                        >
                          ⏱ Odds
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* =====================================================================
           * TAB 2: HYBRID TIME MACHINE SIMULATOR
           * ===================================================================== */
          <div className="space-y-2 font-mono">
            {/* Active Setup Target Banner */}
            {timeMachineResult.activeSetup && (
              <div
                className="p-2 rounded border space-y-1.5"
                style={{ borderColor: theme.border, background: theme.bg }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AssetIcon symbol={timeMachineResult.symbol} size={13} />
                    <span className="font-bold text-[10px]">
                      {timeMachineResult.symbol === "XAU/USDT"
                        ? "GOLD/USDT"
                        : timeMachineResult.symbol}{" "}
                      ({timeMachineResult.timeframe.toUpperCase()})
                    </span>
                    <span
                      className="px-1.5 py-0.2 rounded text-[9px] font-bold"
                      style={{
                        background:
                          timeMachineResult.activeSetup.direction === "LONG"
                            ? `${theme.green}22`
                            : `${theme.red}22`,
                        color:
                          timeMachineResult.activeSetup.direction === "LONG"
                            ? theme.green
                            : theme.red,
                      }}
                    >
                      {timeMachineResult.activeSetup.direction} •{" "}
                      {timeMachineResult.activeSetup.strategyName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePlotSetup(timeMachineResult.activeSetup!)}
                      className="px-1.5 py-0.5 rounded border text-[9px] font-bold"
                      style={{
                        borderColor: theme.yellow,
                        color: theme.yellow,
                        background: `${theme.yellow}15`,
                      }}
                    >
                      📐 Plot
                    </button>
                    {onAddAlert && (
                      <button
                        onClick={() => handleArmAlerts(timeMachineResult.activeSetup!)}
                        className="px-1.5 py-0.5 rounded border text-[9px]"
                        style={{ borderColor: theme.border, color: theme.text }}
                      >
                        🔔 Alert
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[9px] px-1.5 py-1 rounded border" style={{ borderColor: theme.border, background: theme.panel }}>
                  <div>
                    <span style={{ color: theme.dim }}>ENTRY: </span>
                    <span className="font-bold">
                      {fmtPrice(timeMachineResult.activeSetup.entryPrice)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: theme.dim }}>STOP: </span>
                    <span className="font-bold" style={{ color: theme.red }}>
                      {fmtPrice(timeMachineResult.activeSetup.stopPrice)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: theme.dim }}>TP ({rrRatio}R): </span>
                    <span className="font-bold" style={{ color: theme.green }}>
                      {fmtPrice(timeMachineResult.activeSetup.targetPrice)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 4-Card Hybrid Quant Scorecard */}
            <div className="grid grid-cols-2 gap-1.5 text-[9px]">
              {/* Card 1: Composite Odds */}
              <div
                className="p-2 rounded border flex flex-col justify-between"
                style={{ borderColor: theme.border, background: theme.bg }}
              >
                <span style={{ color: theme.dim }}>COMBINED WIN ODDS</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span
                    className="text-base font-bold"
                    style={{
                      color:
                        timeMachineResult.combinedWinOdds >= 55
                          ? theme.green
                          : timeMachineResult.combinedWinOdds <= 42
                            ? theme.red
                            : theme.yellow,
                    }}
                  >
                    {timeMachineResult.combinedWinOdds}%
                  </span>
                  <span style={{ color: theme.dim }}>
                    EV:{" "}
                    <b
                      style={{
                        color:
                          timeMachineResult.backtest.expectedR >= 0
                            ? theme.green
                            : theme.red,
                      }}
                    >
                      {timeMachineResult.backtest.expectedR >= 0 ? "+" : ""}
                      {timeMachineResult.backtest.expectedR}R
                    </b>
                  </span>
                </div>
              </div>

              {/* Card 2: Strategy Backtest */}
              <div
                className="p-2 rounded border flex flex-col justify-between"
                style={{ borderColor: theme.border, background: theme.bg }}
              >
                <span style={{ color: theme.dim }}>
                  STRATEGY BACKTEST (n={timeMachineResult.backtest.totalSignals})
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm font-bold" style={{ color: theme.text }}>
                    {timeMachineResult.backtest.winRate}% WR
                  </span>
                  <span style={{ color: theme.dim }}>
                    PF:{" "}
                    <b style={{ color: theme.yellow }}>
                      {timeMachineResult.backtest.profitFactor}
                    </b>{" "}
                    • DD: -{timeMachineResult.backtest.maxDrawdownR}R
                  </span>
                </div>
              </div>

              {/* Card 3: Pattern Analogs */}
              <div
                className="p-2 rounded border flex flex-col justify-between"
                style={{ borderColor: theme.border, background: theme.bg }}
              >
                <span style={{ color: theme.dim }}>
                  10-BAR ANALOGS (n={timeMachineResult.analogs.matchCount})
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm font-bold" style={{ color: theme.text }}>
                    {timeMachineResult.analogs.winRate}% WR
                  </span>
                  <span style={{ color: theme.dim }}>
                    Sim: {timeMachineResult.analogs.bestSimilarityPct}% • Avg{" "}
                    {timeMachineResult.analogs.avgR >= 0 ? "+" : ""}
                    {timeMachineResult.analogs.avgR}R
                  </span>
                </div>
              </div>

              {/* Card 4: Monte Carlo 2,500 Paths */}
              <div
                className="p-2 rounded border flex flex-col justify-between"
                style={{ borderColor: theme.border, background: theme.bg }}
              >
                <span style={{ color: theme.dim }}>
                  MONTE CARLO ({timeMachineResult.monteCarlo.paths} PATHS)
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm font-bold" style={{ color: theme.green }}>
                    TP {timeMachineResult.monteCarlo.tpHitPct}%
                  </span>
                  <span style={{ color: theme.red }}>
                    SL {timeMachineResult.monteCarlo.slHitPct}%
                  </span>
                </div>
              </div>
            </div>

            {/* Monte Carlo Forward Price Cone Strip */}
            <div
              className="px-2 py-1.5 rounded border text-[9px] space-y-1"
              style={{ borderColor: theme.border, background: theme.bg }}
            >
              <div className="flex items-center justify-between" style={{ color: theme.dim }}>
                <span>MONTE CARLO {horizon}-BAR FORWARD CONE</span>
                <span>
                  EXPIRY: {timeMachineResult.monteCarlo.timeoutPct}%
                </span>
              </div>
              {/* Stacked Probability Bar */}
              <div className="w-full h-2 rounded overflow-hidden flex" style={{ background: theme.panel }}>
                <div
                  style={{
                    width: `${timeMachineResult.monteCarlo.tpHitPct}%`,
                    background: theme.green,
                  }}
                />
                <div
                  style={{
                    width: `${timeMachineResult.monteCarlo.timeoutPct}%`,
                    background: theme.yellow,
                  }}
                />
                <div
                  style={{
                    width: `${timeMachineResult.monteCarlo.slHitPct}%`,
                    background: theme.red,
                  }}
                />
              </div>
              <div className="grid grid-cols-3 text-center pt-0.5">
                <div>
                  <span style={{ color: theme.dim }}>P10 (BEAR): </span>
                  <span style={{ color: theme.red }}>
                    {fmtPrice(timeMachineResult.monteCarlo.p10Price)}
                  </span>
                </div>
                <div>
                  <span style={{ color: theme.dim }}>P50 (MEDIAN): </span>
                  <span className="font-bold">
                    {fmtPrice(timeMachineResult.monteCarlo.p50Price)}
                  </span>
                </div>
                <div>
                  <span style={{ color: theme.dim }}>P90 (BULL): </span>
                  <span style={{ color: theme.green }}>
                    {fmtPrice(timeMachineResult.monteCarlo.p90Price)}
                  </span>
                </div>
              </div>
            </div>

            {/* Equity Curve SVG */}
            {renderEquitySvg()}

            {/* Recent Historical Signal Log */}
            <div
              className="rounded border overflow-hidden"
              style={{ borderColor: theme.border, background: theme.bg }}
            >
              <div
                className="px-2 py-1 border-b text-[9px] flex items-center justify-between"
                style={{ borderColor: theme.border, color: theme.dim }}
              >
                <span>RECENT HISTORICAL SIGNALS (CLICK TO PLOT)</span>
                <span>OUTCOME ({horizon}B)</span>
              </div>
              {timeMachineResult.backtest.recentTrades.length === 0 ? (
                <div className="p-2 text-center text-[9px]" style={{ color: theme.dim }}>
                  No historical signals recorded on this timeframe.
                </div>
              ) : (
                <div className="divide-y max-h-36 overflow-y-auto" style={{ borderColor: theme.border }}>
                  {timeMachineResult.backtest.recentTrades.map((tr) => {
                    const isWin = tr.rMultiple > 0;
                    const outColor =
                      tr.outcome === "TP"
                        ? theme.green
                        : tr.outcome === "SL"
                          ? theme.red
                          : isWin
                            ? theme.green
                            : theme.dim;

                    return (
                      <button
                        key={tr.signal.id}
                        onClick={() => handlePlotSetup(tr.signal)}
                        className="w-full px-2 py-1 flex items-center justify-between text-[9px] hover:opacity-80 text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: theme.dim }}>
                            {fmtTimeShort(tr.signal.time)}
                          </span>
                          <span
                            className="font-bold"
                            style={{
                              color:
                                tr.signal.direction === "LONG"
                                  ? theme.green
                                  : theme.red,
                            }}
                          >
                            {tr.signal.badge} {tr.signal.direction}
                          </span>
                          <span style={{ color: theme.dim }}>
                            @ {fmtPrice(tr.signal.entryPrice)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: theme.dim }}>{tr.barsHeld}b</span>
                          <span className="font-bold" style={{ color: outColor }}>
                            {tr.outcome} ({tr.rMultiple >= 0 ? "+" : ""}
                            {tr.rMultiple.toFixed(1)}R)
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
