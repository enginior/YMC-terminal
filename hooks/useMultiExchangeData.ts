"use client";

import { useEffect, useRef, useCallback } from "react";
import { Trade, OrderBookEntry } from "@/lib/types";
import { isFuturesSymbol } from "@/lib/symbols";
import { marketStore, ExchangeData } from "@/lib/marketStore";

const RECONNECT_MS = 3000;
const MAX_TRADES = 50;
const BOOK_LEVELS = 15;

/** "BTCUSDT" | "btcusdt" -> "BTC" */
function baseAsset(symbol: string): string {
  const upper = symbol.toUpperCase();
  for (const quote of ["USDT", "USDC", "BUSD", "USD"]) {
    if (upper.endsWith(quote)) return upper.slice(0, -quote.length);
  }
  return upper;
}

/** Coinbase trades BTC-USD, not BTC-USDT, so the quote is always USD there. */
function coinbaseProductId(symbol: string): string {
  return `${baseAsset(symbol)}-USD`;
}

const EXCHANGES = [
  {
    name: "Binance",
    wsUrl: (symbol: string) =>
      isFuturesSymbol(symbol) ? "wss://fstream.binance.com/ws" : "wss://stream.binance.com:9443/ws",
    // Only Binance drives the shared order book; the others would overwrite it
    bookAuthority: true,
    // Binance stream names must be lowercase
    subscribeMsg: (symbol: string, interval: string) => {
      const lower = symbol.toLowerCase();
      const s = lower.endsWith("usdt") ? lower : `${lower}usdt`;
      return {
        method: "SUBSCRIBE",
        params: [`${s}@trade`, `${s}@depth20@100ms`, `${s}@kline_${interval}`],
        id: 1,
      };
    },
    // Raw stream (not /stream), so trade events arrive unwrapped
    parseTrade: (d: any) => ({
      price: parseFloat(d.p),
      size: parseFloat(d.q),
      side: (d.m ? "sell" : "buy") as "buy" | "sell",
      time: new Date(d.T).toLocaleTimeString("en-US", { hour12: false }),
    }),
    isTrade: (d: any) => d.e === "trade",
    isBook: (d: any) =>
      (Array.isArray(d.bids) && Array.isArray(d.asks)) ||
      (Array.isArray(d.b) && Array.isArray(d.a)),
    parseBook: (d: any) => {
      const bids = d.bids ?? d.b ?? [];
      const asks = d.asks ?? d.a ?? [];
      return {
        bids: bids
          .slice(0, BOOK_LEVELS)
          .map(([p, s]: [string, string]) => ({ price: parseFloat(p), size: parseFloat(s), total: 0 })),
        asks: asks
          .slice(0, BOOK_LEVELS)
          .map(([p, s]: [string, string]) => ({ price: parseFloat(p), size: parseFloat(s), total: 0 })),
      };
    },
  },
  {
    name: "Coinbase",
    wsUrl: () => "wss://ws-feed.exchange.coinbase.com",
    bookAuthority: false,
    // Coinbase product IDs are dash-separated and use USD, not USDT
    subscribeMsg: (symbol: string) => ({
      type: "subscribe",
      product_ids: [coinbaseProductId(symbol)],
      channels: ["ticker"],
    }),
    parseTrade: (d: any) => ({
      price: parseFloat(d.price),
      size: parseFloat(d.last_size ?? d.volume ?? 0),
      side: (d.side === "buy" ? "sell" : "buy") as "buy" | "sell",
      time: new Date(d.time ?? Date.now()).toLocaleTimeString("en-US", { hour12: false }),
    }),
    isTrade: (d: any) => d.type === "ticker" || d.type === "match",
    isBook: () => false,
    parseBook: () => ({ bids: [], asks: [] }),
  },
  {
    name: "OKX",
    wsUrl: () => "wss://ws.okx.com:8443/ws/v5/public",
    bookAuthority: false,
    // OKX instrument IDs are dash-separated
    subscribeMsg: (symbol: string) => ({
      op: "subscribe",
      args: [{ channel: "trades", instId: `${baseAsset(symbol)}-USDT` }],
    }),
    // OKX nests trades at data[] and names the channel under arg
    parseTrade: (d: any) => {
      const t = Array.isArray(d.data) ? d.data[0] : null;
      if (!t) return null;
      return {
        price: parseFloat(t.px),
        size: parseFloat(t.sz),
        side: (t.side === "buy" ? "buy" : "sell") as "buy" | "sell",
        time: new Date(Number(t.ts)).toLocaleTimeString("en-US", { hour12: false }),
      };
    },
    isTrade: (d: any) => d?.arg?.channel === "trades",
    isBook: () => false,
    parseBook: () => ({ bids: [], asks: [] }),
  },
  {
    // Spot, not the linear/perp stream — the other feeds are spot too, so this
    // keeps the aggregate free of perpetual basis.
    name: "Bybit",
    wsUrl: () => "wss://stream.bybit.com/v5/public/spot",
    bookAuthority: false,
    // Bybit requires a pong reply or it drops the socket after ~20s
    requiresPong: true,
    subscribeMsg: (symbol: string) => ({
      op: "subscribe",
      // Bybit spot instruments are unseparated: BTCUSDT, not BTC-USDT
      args: [`publicTrade.${baseAsset(symbol)}USDT`],
    }),
    // { topic: "publicTrade.BTCUSDT", type: "snapshot", data: [{ p, v, S, T }] }
    parseTrade: (d: any) => {
      const t = Array.isArray(d.data) ? d.data[0] : null;
      if (!t) return null;
      return {
        price: parseFloat(t.p),
        size: parseFloat(t.v),
        side: (t.S === "Buy" ? "buy" : "sell") as "buy" | "sell",
        time: new Date(Number(t.T)).toLocaleTimeString("en-US", { hour12: false }),
      };
    },
    isTrade: (d: any) => typeof d?.topic === "string" && d.topic.startsWith("publicTrade."),
    isBook: () => false,
    parseBook: () => ({ bids: [], asks: [] }),
  },
] as const;

/**
 * Feeds live market data into marketStore outside React state.
 * Never causes the caller (Home) to re-render.
 */
export function useMarketFeed(symbol = "btcusdt", interval = "1h"): void {
  const socketsRef = useRef<WebSocket[]>([]);
  const retryRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const tradeIdRef = useRef(0);

  const symbolRef = useRef(symbol);
  const intervalRef = useRef(interval);
  symbolRef.current = symbol;
  intervalRef.current = interval;

  // Per-exchange prices live in a ref so socket callbacks never read stale state
  const pricesRef = useRef<Map<string, ExchangeData>>(
    new Map(EXCHANGES.map((e) => [e.name, { name: e.name, price: 0, connected: false, lastUpdate: 0 }]))
  );

  const connectOne = useCallback((idx: number) => {
    const exchange = EXCHANGES[idx];
    const currentSym = symbolRef.current;
    const isFutures = isFuturesSymbol(currentSym);

    // If this is a commodity/futures pair, only Binance supports it
    if (exchange.name !== "Binance" && isFutures) {
      const prev = pricesRef.current.get(exchange.name)!;
      pricesRef.current.set(exchange.name, {
        name: exchange.name,
        connected: false,
        price: 0,
        lastUpdate: prev.lastUpdate,
      });
      marketStore.setState({
        venues: EXCHANGES.map((e) => pricesRef.current.get(e.name)!),
      });
      return;
    }

    const wsUrl = exchange.wsUrl(currentSym);
    const ws = new WebSocket(wsUrl);
    socketsRef.current[idx] = ws;

    const markState = (connected: boolean, price?: number) => {
      const prev = pricesRef.current.get(exchange.name)!;
      pricesRef.current.set(exchange.name, {
        name: exchange.name,
        connected,
        price: price ?? prev.price,
        lastUpdate: connected ? Date.now() : prev.lastUpdate,
      });
      marketStore.setState({
        venues: EXCHANGES.map((e) => pricesRef.current.get(e.name)!),
      });
    };

    ws.onopen = () => {
      ws.send(JSON.stringify(exchange.subscribeMsg(symbolRef.current, intervalRef.current)));
      markState(true);
    };

    ws.onmessage = (event) => {
      let payload: any;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      // Bybit sends { op: "ping" } every 20s and drops the socket if unanswered
      if (payload?.op === "ping") {
        ws.send(JSON.stringify({ op: "pong" }));
        return;
      }
      // Subscribe acks carry no price. A failed ack must be surfaced — Bybit answers
      // a bad topic with { success: false, ret_msg: "Invalid symbol" } and simply
      // never sends data, which is otherwise invisible.
      if (payload?.op === "subscribe" || payload?.success !== undefined) {
        if (payload.success === false) {
          console.error(
            `[${exchange.name}] subscribe failed: ${payload.ret_msg || "unknown reason"}`
          );
          markState(false);
        }
        return;
      }

      // Each exchange wraps payloads differently; the isBook/isTrade/parseTrade
      // predicates own their envelope. Only Binance klines need unwrapping,
      // because /stream nests them one level under data.
      const msg =
        payload?.e === "kline" && payload?.data ? payload.data : payload;

      if (exchange.bookAuthority && exchange.isBook(msg)) {
        const raw = exchange.parseBook(msg);
        let bidTotal = 0;
        let askTotal = 0;
        marketStore.setState({
          orderBook: {
            bids: raw.bids.map((b: OrderBookEntry) => ({ ...b, total: (bidTotal += b.size) })),
            asks: raw.asks.map((a: OrderBookEntry) => ({ ...a, total: (askTotal += a.size) })),
          },
        });
        return;
      }

      if (!exchange.isTrade(msg)) return;
      const trade = exchange.parseTrade(msg);
      if (!trade || !Number.isFinite(trade.price) || trade.price <= 0) return;
      markState(true, trade.price);
      const currentTrades = marketStore.getState().trades;
      marketStore.setState({
        trades: [{ id: tradeIdRef.current++, ...trade }, ...currentTrades].slice(0, MAX_TRADES),
      });
    };

    ws.onerror = () => markState(false);

    // Reconnect only this exchange, leaving healthy sockets untouched
    ws.onclose = () => {
      markState(false);
      if (socketsRef.current[idx] !== ws) return;
      retryRef.current.set(
        idx,
        setTimeout(() => {
          retryRef.current.delete(idx);
          if (socketsRef.current[idx] === ws) connectOne(idx);
        }, RECONNECT_MS)
      );
    };
  }, []);

  const connectAll = useCallback(() => {
    retryRef.current.forEach((t) => clearTimeout(t));
    retryRef.current.clear();
    socketsRef.current.forEach((ws) => {
      ws.onclose = null;
      ws.close();
    });
    socketsRef.current = [];
    EXCHANGES.forEach((_, idx) => connectOne(idx));
  }, [connectOne]);

  // Reset store and connect sockets on symbol/interval change (Req. 5)
  useEffect(() => {
    marketStore.reset(symbol, interval);
    connectAll();
    const sockets = socketsRef.current;
    return () => {
      retryRef.current.forEach((t) => clearTimeout(t));
      retryRef.current.clear();
      sockets.forEach((ws) => {
        ws.onclose = null;
        ws.close();
      });
    };
  }, [symbol, interval, connectAll]);

  // Historical candles: our API merges static-klines history with live Binance data
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&t=${Date.now()}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          marketStore.setState({ candles: data, candleError: false });
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
  }, [symbol, interval]);

  // Keep the live candle fresh. Goes through our own route to avoid CORS
  // and to pick up the same interval mapping the chart uses.
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch(`/api/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&live=1&t=${Date.now()}`);
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;
        const latest = data[data.length - 1];
        const prev = marketStore.getState().candles;
        let nextCandles: typeof prev;
        if (prev.length === 0) {
          nextCandles = [latest];
        } else {
          const last = prev[prev.length - 1];
          if (last.time === latest.time) {
            nextCandles = [...prev.slice(0, -1), latest];
          } else {
            nextCandles = [...prev, latest];
          }
        }
        marketStore.setState({ candles: nextCandles });
      } catch {}
    };

    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [symbol, interval]);

  // 1 Hz price throttle: copies aggregatedPrice -> price and derives direction
  useEffect(() => {
    const timer = setInterval(() => {
      const cur = marketStore.getState().aggregatedPrice;
      if (cur > 0) {
        const prev = marketStore.getState().price;
        const direction: "up" | "down" =
          prev === 0 ? "up" : cur >= prev ? "up" : "down";
        marketStore.setState({ price: cur, direction });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);
}

/** Legacy compatibility export */
export const useMultiExchangeData = useMarketFeed;
