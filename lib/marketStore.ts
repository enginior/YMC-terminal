"use client";

import { useSyncExternalStore, useRef } from "react";
import { Candle, Trade, OrderBookEntry, LiquidationOrder } from "@/lib/types";

export type { LiquidationOrder } from "@/lib/types";

export type ExchangeSource = "binance" | "bybit" | "okx";

export interface ExchangeData {
  name: string;
  price: number;
  connected: boolean;
  lastUpdate: number;
}

export interface MarketState {
  symbol: string;
  interval: string;
  exchangeSource: ExchangeSource;
  venues: ExchangeData[];
  aggregatedPrice: number;
  trades: Trade[];
  orderBook: { bids: OrderBookEntry[]; asks: OrderBookEntry[] };
  candles: Candle[];
  candleError: boolean;
  price: number; // Unified live price from active exchange source
  direction: "up" | "down";
  connected: boolean;
  exchangeCount: number;
  tickers: Record<string, number>;
  liquidations: LiquidationOrder[];
}

export const INITIAL_MARKET_STATE: MarketState = {
  symbol: "",
  interval: "",
  exchangeSource: "binance",
  venues: [
    { name: "Binance", price: 0, connected: false, lastUpdate: 0 },
    { name: "Coinbase", price: 0, connected: false, lastUpdate: 0 },
    { name: "OKX", price: 0, connected: false, lastUpdate: 0 },
    { name: "Bybit", price: 0, connected: false, lastUpdate: 0 },
  ],
  aggregatedPrice: 0,
  trades: [],
  orderBook: { bids: [], asks: [] },
  candles: [],
  candleError: false,
  price: 0,
  direction: "up",
  connected: false,
  exchangeCount: 0,
  tickers: {},
  liquidations: [],
};

let state: MarketState = { ...INITIAL_MARKET_STATE };
const listeners = new Set<() => void>();
let dirty = false;
let rafId: number | null = null;
let timeoutId: number | null = null;

function notify() {
  rafId = null;
  timeoutId = null;
  if (!dirty) return;
  dirty = false;
  listeners.forEach((listener) => listener());
}

function scheduleNotify() {
  dirty = true;
  if (typeof window === "undefined") return;

  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    // When the browser tab is hidden, requestAnimationFrame is suspended.
    // Use a lightweight setTimeout so background price updates still notify
    // alert listeners (for desktop notifications & audio chimes).
    if (timeoutId === null) {
      timeoutId = window.setTimeout(notify, 500) as unknown as number;
    }
  } else {
    if (rafId === null) {
      rafId = requestAnimationFrame(notify);
    }
  }
}

export const marketStore = {
  getState(): MarketState {
    return state;
  },

  setState(partial: Partial<MarketState>): void {
    let aggregatedPrice =
      partial.aggregatedPrice !== undefined ? partial.aggregatedPrice : state.aggregatedPrice;
    let connected = partial.connected !== undefined ? partial.connected : state.connected;
    let exchangeCount =
      partial.exchangeCount !== undefined ? partial.exchangeCount : state.exchangeCount;

    if (partial.venues && partial.aggregatedPrice === undefined) {
      const live = partial.venues.filter((p) => p.connected && p.price > 0);
      aggregatedPrice = live.length > 0 ? live.reduce((s, p) => s + p.price, 0) / live.length : 0;
      connected = live.length > 0;
      exchangeCount = live.length;
    }

    state = {
      ...state,
      ...partial,
      aggregatedPrice,
      connected,
      exchangeCount,
    };
    scheduleNotify();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  reset(symbol: string, interval: string, exchangeSource?: ExchangeSource): void {
    state = {
      ...INITIAL_MARKET_STATE,
      symbol,
      interval,
      exchangeSource: exchangeSource ?? state.exchangeSource,
      tickers: state.tickers,
      liquidations: state.liquidations,
      venues: [
        { name: "Binance", price: 0, connected: false, lastUpdate: 0 },
        { name: "Coinbase", price: 0, connected: false, lastUpdate: 0 },
        { name: "OKX", price: 0, connected: false, lastUpdate: 0 },
        { name: "Bybit", price: 0, connected: false, lastUpdate: 0 },
      ],
    };
    scheduleNotify();
  },

  addLiquidation(order: LiquidationOrder): void {
    if (!order || !order.id) return;
    const prev = state.liquidations;
    const next = [order, ...prev.slice(0, 249)];
    state = { ...state, liquidations: next };
    scheduleNotify();
  },

  updateLiveCandle(candle: Candle): void {
    if (!candle || !Number.isFinite(candle.time) || !Number.isFinite(candle.close)) return;
    const prev = state.candles;
    if (prev.length === 0) {
      state = { ...state, candles: [candle] };
      scheduleNotify();
      return;
    }

    const last = prev[prev.length - 1];
    if (last.time === candle.time) {
      if (
        last.open === candle.open &&
        last.high === candle.high &&
        last.low === candle.low &&
        last.close === candle.close &&
        last.volume === candle.volume
      ) {
        return;
      }
      const nextCandles = [...prev.slice(0, -1), candle];
      state = { ...state, candles: nextCandles };
      scheduleNotify();
    } else if (candle.time > last.time) {
      const nextCandles = [...prev, candle];
      state = { ...state, candles: nextCandles };
      scheduleNotify();
    }
  },
};

export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k) || !Object.is((a as any)[k], (b as any)[k])) {
      return false;
    }
  }
  return true;
}

export function useMarket<T>(
  selector: (state: MarketState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const lastSelectedRef = useRef<T | undefined>(undefined);
  const lastStateRef = useRef<MarketState | undefined>(undefined);
  const lastSelectorRef = useRef<((state: MarketState) => T) | undefined>(undefined);

  const getSnapshot = () => {
    const currentState = marketStore.getState();
    if (
      lastStateRef.current === currentState &&
      lastSelectorRef.current === selector &&
      lastSelectedRef.current !== undefined
    ) {
      return lastSelectedRef.current;
    }
    const nextSelected = selector(currentState);
    if (
      lastSelectorRef.current === selector &&
      lastSelectedRef.current !== undefined &&
      isEqual(lastSelectedRef.current, nextSelected)
    ) {
      return lastSelectedRef.current;
    }
    lastStateRef.current = currentState;
    lastSelectorRef.current = selector;
    lastSelectedRef.current = nextSelected;
    return nextSelected;
  };

  const getServerSnapshot = () => {
    return selector(INITIAL_MARKET_STATE);
  };

  return useSyncExternalStore(marketStore.subscribe, getSnapshot, getServerSnapshot);
}
