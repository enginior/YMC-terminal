"use client";

import { useSyncExternalStore, useRef } from "react";
import { Candle, Trade, OrderBookEntry } from "@/lib/types";

export interface ExchangeData {
  name: string;
  price: number;
  connected: boolean;
  lastUpdate: number;
}

export interface MarketState {
  symbol: string;
  interval: string;
  venues: ExchangeData[];
  aggregatedPrice: number;
  trades: Trade[];
  orderBook: { bids: OrderBookEntry[]; asks: OrderBookEntry[] };
  candles: Candle[];
  candleError: boolean;
  price: number; // 1 Hz snapshot of aggregatedPrice
  direction: "up" | "down";
  connected: boolean;
  exchangeCount: number;
}

export const INITIAL_MARKET_STATE: MarketState = {
  symbol: "",
  interval: "",
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
};

let state: MarketState = { ...INITIAL_MARKET_STATE };
const listeners = new Set<() => void>();
let dirty = false;
let rafId: number | null = null;

function notify() {
  rafId = null;
  if (!dirty) return;
  dirty = false;
  listeners.forEach((listener) => listener());
}

function scheduleNotify() {
  dirty = true;
  if (typeof window !== "undefined" && rafId === null) {
    rafId = requestAnimationFrame(notify);
  } else if (typeof window === "undefined" && !dirty) {
    dirty = false;
    listeners.forEach((listener) => listener());
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

  reset(symbol: string, interval: string): void {
    state = {
      ...INITIAL_MARKET_STATE,
      symbol,
      interval,
      venues: [
        { name: "Binance", price: 0, connected: false, lastUpdate: 0 },
        { name: "Coinbase", price: 0, connected: false, lastUpdate: 0 },
        { name: "OKX", price: 0, connected: false, lastUpdate: 0 },
        { name: "Bybit", price: 0, connected: false, lastUpdate: 0 },
      ],
    };
    scheduleNotify();
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

  const getSnapshot = () => {
    const currentState = marketStore.getState();
    if (lastStateRef.current === currentState && lastSelectedRef.current !== undefined) {
      return lastSelectedRef.current;
    }
    const nextSelected = selector(currentState);
    if (lastSelectedRef.current !== undefined && isEqual(lastSelectedRef.current, nextSelected)) {
      return lastSelectedRef.current;
    }
    lastStateRef.current = currentState;
    lastSelectedRef.current = nextSelected;
    return nextSelected;
  };

  const getServerSnapshot = () => {
    return selector(INITIAL_MARKET_STATE);
  };

  return useSyncExternalStore(marketStore.subscribe, getSnapshot, getServerSnapshot);
}
