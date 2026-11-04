"use client";

import { useEffect, useRef, useCallback } from "react";
import { Trade, OrderBookEntry, Candle, LiquidationOrder } from "@/lib/types";
import { isFuturesSymbol, UNIVERSE, toLabel } from "@/lib/symbols";
import { marketStore, ExchangeData, ExchangeSource } from "@/lib/marketStore";

const RECONNECT_MS = 3000;
const MAX_TRADES = 50;
const BOOK_LEVELS = 15;

const BYBIT_INTERVAL_MAP: Record<string, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "2h": "120",
  "4h": "240",
  "6h": "360",
  "12h": "720",
  "1d": "D",
  "1w": "W",
  "1M": "M",
};

/** "BTCUSDT" | "btcusdt" -> "BTC" */
function baseAsset(symbol: string): string {
  const upper = symbol.toUpperCase();
  for (const quote of ["USDT", "USDC", "BUSD", "USD"]) {
    if (upper.endsWith(quote)) return upper.slice(0, -quote.length);
  }
  return upper;
}

/**
 * Global WebSocket stream for all universe symbols.
 * Connects to Binance Spot and Binance Futures !miniTicker@arr.
 * Keeps marketStore.tickers fresh across all pairs so alerts can evaluate
 * against any asset even when it is not the active chart symbol.
 */
function useUniverseTickersFeed() {
  useEffect(() => {
    let spotWs: WebSocket | null = null;
    let futuresWs: WebSocket | null = null;
    let spotTimer: NodeJS.Timeout | null = null;
    let futuresTimer: NodeJS.Timeout | null = null;
    let disposed = false;

    const UNIVERSE_SYMBOLS = new Set(UNIVERSE.map((u) => u.symbol));

    const connectSpot = () => {
      if (disposed) return;
      try {
        spotWs = new WebSocket("wss://stream.binance.com:9443/ws/!miniTicker@arr");
        spotWs.onmessage = (event) => {
          try {
            const arr = JSON.parse(event.data);
            if (Array.isArray(arr)) {
              const updates: Record<string, number> = {};
              for (const item of arr) {
                if (item && item.s && (UNIVERSE_SYMBOLS.has(item.s) || item.s.endsWith("USDT"))) {
                  const p = parseFloat(item.c);
                  if (!isNaN(p) && p > 0) {
                    updates[item.s] = p;
                    const lbl = toLabel(item.s);
                    if (lbl && lbl !== item.s) {
                      updates[lbl] = p;
                    }
                  }
                }
              }
              if (Object.keys(updates).length > 0) {
                const prev = marketStore.getState().tickers;
                marketStore.setState({ tickers: { ...prev, ...updates } });
              }
            }
          } catch {}
        };
        spotWs.onclose = () => {
          if (!disposed) {
            spotTimer = setTimeout(connectSpot, RECONNECT_MS);
          }
        };
        spotWs.onerror = () => {
          spotWs?.close();
        };
      } catch {
        if (!disposed) {
          spotTimer = setTimeout(connectSpot, RECONNECT_MS);
        }
      }
    };

    const connectFutures = () => {
      if (disposed) return;
      try {
        futuresWs = new WebSocket("wss://fstream.binance.com/ws/!miniTicker@arr");
        futuresWs.onmessage = (event) => {
          try {
            const arr = JSON.parse(event.data);
            if (Array.isArray(arr)) {
              const updates: Record<string, number> = {};
              for (const item of arr) {
                if (item && item.s && isFuturesSymbol(item.s)) {
                  const p = parseFloat(item.c);
                  if (!isNaN(p) && p > 0) {
                    updates[item.s] = p;
                    const lbl = toLabel(item.s);
                    if (lbl && lbl !== item.s) {
                      updates[lbl] = p;
                    }
                  }
                }
              }
              if (Object.keys(updates).length > 0) {
                const prev = marketStore.getState().tickers;
                marketStore.setState({ tickers: { ...prev, ...updates } });
              }
            }
          } catch {}
        };
        futuresWs.onclose = () => {
          if (!disposed) {
            futuresTimer = setTimeout(connectFutures, RECONNECT_MS);
          }
        };
        futuresWs.onerror = () => {
          futuresWs?.close();
        };
      } catch {
        if (!disposed) {
          futuresTimer = setTimeout(connectFutures, RECONNECT_MS);
        }
      }
    };

    connectSpot();
    connectFutures();

    return () => {
      disposed = true;
      if (spotTimer) clearTimeout(spotTimer);
      if (futuresTimer) clearTimeout(futuresTimer);
      if (spotWs) {
        spotWs.onclose = null;
        spotWs.onerror = null;
        spotWs.close();
      }
      if (futuresWs) {
        futuresWs.onclose = null;
        futuresWs.onerror = null;
        futuresWs.close();
      }
    };
  }, []);
}

/**
 * Real-time perpetual liquidation bursts from Binance Futures !forceOrder@arr.
 * Feeds into marketStore.liquidations so both LiquidationsTape and ChartMarkers
 * share a single WebSocket connection.
 */
function useLiquidationsFeed() {
  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: NodeJS.Timeout | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      try {
        ws = new WebSocket("wss://fstream.binance.com/ws/!forceOrder@arr");

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data?.o) return;
            const o = data.o;
            const price = parseFloat(o.p);
            const qty = parseFloat(o.q);
            const usdValue = price * qty;
            const side: "BUY" | "SELL" = o.S;
            const isLarge = usdValue >= 100000;
            const time = new Date(o.T).toLocaleTimeString("en-US", { hour12: false });

            const item: LiquidationOrder = {
              id: `${o.T}-${Math.random().toString(36).slice(2, 7)}`,
              symbol: o.s.replace("USDT", ""),
              rawSymbol: o.s,
              side,
              price,
              qty,
              usdValue,
              time,
              timestamp: o.T,
              isLarge,
            };

            marketStore.addLiquidation(item);
          } catch {}
        };

        ws.onclose = () => {
          if (!disposed) {
            timer = setTimeout(connect, RECONNECT_MS);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (!disposed) {
          timer = setTimeout(connect, RECONNECT_MS);
        }
      }
    };

    connect();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, []);
}

/**
 * Feeds live market data from a unified exchange source (Binance or Bybit)
 * into marketStore outside React state. Never causes the caller (Home) to re-render.
 */
export function useMarketFeed(
  symbol = "btcusdt",
  interval = "1h",
  source: ExchangeSource = "binance"
): void {
  useUniverseTickersFeed();
  useLiquidationsFeed();

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tradeIdRef = useRef(0);

  const symbolRef = useRef(symbol);
  const intervalRef = useRef(interval);
  const sourceRef = useRef<ExchangeSource>(source);
  symbolRef.current = symbol;
  intervalRef.current = interval;
  sourceRef.current = source;

  // Bybit sends snapshot + delta orderbooks; keep level maps per connection
  const bybitBidsRef = useRef<Map<number, number>>(new Map());
  const bybitAsksRef = useRef<Map<number, number>>(new Map());

  const connectUnified = useCallback(() => {
    const currentSym = symbolRef.current;
    const currentInterval = intervalRef.current;
    const isFutures = isFuturesSymbol(currentSym);
    // Commodities (XAU, XAG, OIL) are hosted on Binance Futures
    const activeSource: ExchangeSource = isFutures ? "binance" : sourceRef.current;
    const venueName = activeSource === "bybit" ? "Bybit" : "Binance";

    bybitBidsRef.current.clear();
    bybitAsksRef.current.clear();

    const wsUrl =
      activeSource === "bybit"
        ? "wss://stream.bybit.com/v5/public/spot"
        : isFutures
          ? "wss://fstream.binance.com/ws"
          : "wss://stream.binance.com:9443/ws";

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const markState = (connected: boolean, latestPrice?: number) => {
      const prevState = marketStore.getState();
      const nextPrice =
        latestPrice !== undefined && latestPrice > 0 ? latestPrice : prevState.aggregatedPrice;
      const venues: ExchangeData[] = prevState.venues.map((v) =>
        v.name === venueName
          ? {
              name: v.name,
              connected,
              price: nextPrice,
              lastUpdate: connected ? Date.now() : v.lastUpdate,
            }
          : { ...v, connected: false, price: 0 }
      );
      marketStore.setState({
        venues,
        aggregatedPrice: nextPrice,
        connected,
        exchangeCount: connected ? 1 : 0,
      });
    };

    ws.onopen = () => {
      const symUpper = `${baseAsset(currentSym)}USDT`;
      if (activeSource === "bybit") {
        const bybitInterval = BYBIT_INTERVAL_MAP[currentInterval] || "60";
        ws.send(
          JSON.stringify({
            op: "subscribe",
            args: [
              `publicTrade.${symUpper}`,
              `orderbook.50.${symUpper}`,
              `kline.${bybitInterval}.${symUpper}`,
            ],
          })
        );
        if (pingRef.current) clearInterval(pingRef.current);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: "ping" }));
          }
        }, 18000);
      } else {
        const lower = currentSym.toLowerCase();
        const s = lower.endsWith("usdt") ? lower : `${lower}usdt`;
        ws.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: [`${s}@trade`, `${s}@depth20@100ms`, `${s}@kline_${currentInterval}`],
            id: 1,
          })
        );
      }
      markState(true);
    };

    ws.onmessage = (event) => {
      let payload: any;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (activeSource === "bybit") {
        // Bybit V5 replies to client `{ op: "ping" }` with `{ success: true, ret_msg: "pong", op: "ping" }`
        if (payload?.op === "pong" || payload?.ret_msg === "pong") {
          return;
        }
        if (payload?.op === "ping" && payload?.success === undefined) {
          ws.send(JSON.stringify({ op: "pong" }));
          return;
        }
        if (payload?.op === "subscribe" || payload?.success !== undefined) {
          if (payload?.op === "subscribe" && payload.success === false) {
            console.warn(
              `[Bybit] subscribe failed: ${payload.ret_msg || "unknown reason"}`
            );
            markState(false);
          }
          return;
        }

        const topic: string = typeof payload?.topic === "string" ? payload.topic : "";

        // 1. Bybit OrderBook (snapshot + delta)
        if (topic.startsWith("orderbook.")) {
          const data = payload.data;
          if (!data) return;
          if (payload.type === "snapshot") {
            bybitBidsRef.current.clear();
            bybitAsksRef.current.clear();
          }
          if (Array.isArray(data.b)) {
            for (const [pStr, sStr] of data.b) {
              const p = parseFloat(pStr);
              const s = parseFloat(sStr);
              if (s === 0) bybitBidsRef.current.delete(p);
              else if (Number.isFinite(p) && Number.isFinite(s)) bybitBidsRef.current.set(p, s);
            }
          }
          if (Array.isArray(data.a)) {
            for (const [pStr, sStr] of data.a) {
              const p = parseFloat(pStr);
              const s = parseFloat(sStr);
              if (s === 0) bybitAsksRef.current.delete(p);
              else if (Number.isFinite(p) && Number.isFinite(s)) bybitAsksRef.current.set(p, s);
            }
          }

          let bidTotal = 0;
          let askTotal = 0;
          const sortedBids = Array.from(bybitBidsRef.current.entries())
            .sort((a, b) => b[0] - a[0])
            .slice(0, BOOK_LEVELS)
            .map(([price, size]) => ({ price, size, total: (bidTotal += size) }));
          const sortedAsks = Array.from(bybitAsksRef.current.entries())
            .sort((a, b) => a[0] - b[0])
            .slice(0, BOOK_LEVELS)
            .map(([price, size]) => ({ price, size, total: (askTotal += size) }));

          marketStore.setState({
            orderBook: { bids: sortedBids, asks: sortedAsks },
          });
          return;
        }

        // 2. Bybit Live Kline
        if (topic.startsWith("kline.")) {
          const k = Array.isArray(payload.data) ? payload.data[0] : null;
          if (!k) return;
          const candleTime = Math.floor(Number(k.start) / 1000 / 60) * 60;
          const closePrice = parseFloat(k.close);
          const candle: Candle = {
            time: candleTime,
            open: parseFloat(k.open),
            high: parseFloat(k.high),
            low: parseFloat(k.low),
            close: closePrice,
            volume: parseFloat(k.volume),
          };
          // Only update live candle once historical klines have loaded so a single WS tick
          // never masquerades as the entire chart history.
          if (marketStore.getState().candles.length > 0) {
            marketStore.updateLiveCandle(candle);
          }
          if (Number.isFinite(closePrice) && closePrice > 0) {
            markState(true, closePrice);
          }
          return;
        }

        // 3. Bybit Public Trade
        if (topic.startsWith("publicTrade.")) {
          const t = Array.isArray(payload.data) ? payload.data[0] : null;
          if (!t) return;
          const price = parseFloat(t.p);
          const size = parseFloat(t.v);
          if (!Number.isFinite(price) || price <= 0) return;
          const trade = {
            price,
            size,
            side: (t.S === "Buy" ? "buy" : "sell") as "buy" | "sell",
            time: new Date(Number(t.T)).toLocaleTimeString("en-US", { hour12: false }),
          };
          markState(true, price);
          const currentTrades = marketStore.getState().trades;
          marketStore.setState({
            trades: [{ id: tradeIdRef.current++, ...trade }, ...currentTrades].slice(0, MAX_TRADES),
          });
          return;
        }
        return;
      }

      // --- BINANCE STREAM HANDLER ---
      const msg = payload?.e === "kline" && payload?.data ? payload.data : payload;

      // 1. Binance OrderBook
      if (
        (Array.isArray(msg?.bids) && Array.isArray(msg?.asks)) ||
        (Array.isArray(msg?.b) && Array.isArray(msg?.a))
      ) {
        const bids = msg.bids ?? msg.b ?? [];
        const asks = msg.asks ?? msg.a ?? [];
        let bidTotal = 0;
        let askTotal = 0;
        marketStore.setState({
          orderBook: {
            bids: bids
              .slice(0, BOOK_LEVELS)
              .map(([p, s]: [string, string]) => {
                const size = parseFloat(s);
                return { price: parseFloat(p), size, total: (bidTotal += size) };
              }),
            asks: asks
              .slice(0, BOOK_LEVELS)
              .map(([p, s]: [string, string]) => {
                const size = parseFloat(s);
                return { price: parseFloat(p), size, total: (askTotal += size) };
              }),
          },
        });
        return;
      }

      // 2. Binance Real-Time Kline (@kline_<interval>)
      if (msg?.e === "kline" && msg?.k) {
        const k = msg.k;
        const s = currentSym.toLowerCase().replace(/[\/\s]/g, "");
        const expectedSymbol = (s.endsWith("usdt") ? s : `${s}usdt`).toUpperCase();
        if (k.s?.toUpperCase() === expectedSymbol && k.i === currentInterval) {
          const candleTime = Math.floor(k.t / 1000);
          const closePrice = parseFloat(k.c);
          const candle: Candle = {
            time: candleTime,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: closePrice,
            volume: parseFloat(k.v),
          };
          // Only update live candle once historical klines have loaded so a single WS tick
          // never masquerades as the entire chart history.
          if (marketStore.getState().candles.length > 0) {
            marketStore.updateLiveCandle(candle);
          }
          if (Number.isFinite(closePrice) && closePrice > 0) {
            markState(true, closePrice);
          }
        }
        return;
      }

      // 3. Binance Trade
      if (msg?.e === "trade") {
        const price = parseFloat(msg.p);
        const size = parseFloat(msg.q);
        if (!Number.isFinite(price) || price <= 0) return;
        const trade = {
          price,
          size,
          side: (msg.m ? "sell" : "buy") as "buy" | "sell",
          time: new Date(msg.T).toLocaleTimeString("en-US", { hour12: false }),
        };
        markState(true, price);
        const currentTrades = marketStore.getState().trades;
        marketStore.setState({
          trades: [{ id: tradeIdRef.current++, ...trade }, ...currentTrades].slice(0, MAX_TRADES),
        });
      }
    };

    ws.onerror = () => markState(false);

    ws.onclose = () => {
      markState(false);
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
      if (wsRef.current !== ws) return;
      retryRef.current = setTimeout(() => {
        retryRef.current = null;
        if (wsRef.current === ws) connectUnified();
      }, RECONNECT_MS);
    };
  }, []);

  // Reset store and connect unified socket on symbol/interval/source change
  useEffect(() => {
    marketStore.reset(symbol, interval, source);
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    if (pingRef.current) {
      clearInterval(pingRef.current);
      pingRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    connectUnified();

    return () => {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbol, interval, source, connectUnified]);

  // Historical candles from the unified exchange source
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&source=${source}&t=${Date.now()}`
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          const latestClose = data[data.length - 1]?.close ?? 0;
          const curPrice = marketStore.getState().price;
          marketStore.setState({
            candles: data,
            candleError: false,
            ...(curPrice === 0 && latestClose > 0
              ? { price: latestClose, aggregatedPrice: latestClose }
              : {}),
          });
        }
      } catch {
        if (!cancelled) {
          marketStore.setState({ candles: [], candleError: true });
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol, interval, source]);

  // Fallback REST poll to keep active candle resilient during network drops
  useEffect(() => {
    const tick = async () => {
      try {
        if (marketStore.getState().candles.length === 0) return;
        const res = await fetch(
          `/api/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&source=${source}&live=1&t=${Date.now()}`
        );
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;
        const latest = data[data.length - 1];
        if (marketStore.getState().candles.length > 0) {
          marketStore.updateLiveCandle(latest);
        }
      } catch {}
    };

    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [symbol, interval, source]);

  // 1 Hz price throttle: copies unified exchange price -> price and derives direction
  useEffect(() => {
    const timer = setInterval(() => {
      const cur = marketStore.getState().aggregatedPrice;
      if (cur > 0) {
        const prev = marketStore.getState().price;
        const direction: "up" | "down" =
          prev === 0 ? "up" : cur >= prev ? "up" : "down";
        const currentTickers = marketStore.getState().tickers;
        marketStore.setState({
          price: cur,
          direction,
          tickers: {
            ...currentTickers,
            [symbol]: cur,
            [toLabel(symbol)]: cur,
          },
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [symbol]);
}

/** Legacy compatibility export */
export const useMultiExchangeData = useMarketFeed;
