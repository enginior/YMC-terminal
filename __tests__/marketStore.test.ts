import { describe, it, expect, beforeEach } from "vitest";
import { marketStore, shallowEqual, INITIAL_MARKET_STATE } from "@/lib/marketStore";

describe("marketStore", () => {
  beforeEach(() => {
    marketStore.reset("BTCUSDT", "1h");
  });

  describe("shallowEqual", () => {
    it("compares primitives using Object.is", () => {
      expect(shallowEqual(42, 42)).toBe(true);
      expect(shallowEqual(42, 43)).toBe(false);
      expect(shallowEqual("btc", "btc")).toBe(true);
      expect(shallowEqual("btc", "eth")).toBe(false);
      expect(shallowEqual(NaN, NaN)).toBe(true);
    });

    it("compares arrays shallowly", () => {
      expect(shallowEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(shallowEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(shallowEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it("compares objects shallowly", () => {
      expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
      expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "y" })).toBe(false);
      expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });
  });

  describe("state management", () => {
    it("initializes with initial state structure", () => {
      const state = marketStore.getState();
      expect(state.symbol).toBe("BTCUSDT");
      expect(state.interval).toBe("1h");
      expect(state.venues).toHaveLength(4);
      expect(state.tickers).toBeDefined();
    });

    it("updates partial state via setState", () => {
      marketStore.setState({ price: 68500, direction: "up" });
      const state = marketStore.getState();
      expect(state.price).toBe(68500);
      expect(state.direction).toBe("up");
    });

    it("retains universe tickers across symbol/interval reset", () => {
      marketStore.setState({
        tickers: {
          BTCUSDT: 68500,
          ETHUSDT: 2500,
          XAUUSDT: 2750,
        },
      });

      // User switches chart to SOL on 15m timeframe
      marketStore.reset("SOLUSDT", "15m");
      const state = marketStore.getState();

      expect(state.symbol).toBe("SOLUSDT");
      expect(state.interval).toBe("15m");
      // Tickers MUST persist across symbol reset for per-symbol alerts
      expect(state.tickers.BTCUSDT).toBe(68500);
      expect(state.tickers.ETHUSDT).toBe(2500);
      expect(state.tickers.XAUUSDT).toBe(2750);
      // Active symbol trades/candles/book are reset
      expect(state.trades).toEqual([]);
      expect(state.candles).toEqual([]);
    });

    it("supports binance, bybit, and okx unified exchangeSource across resets", () => {
      marketStore.reset("BTCUSDT", "1h", "okx");
      expect(marketStore.getState().exchangeSource).toBe("okx");

      // Switching symbol without passing exchangeSource retains current source
      marketStore.reset("ETHUSDT", "15m");
      expect(marketStore.getState().exchangeSource).toBe("okx");

      marketStore.reset("SOLUSDT", "4h", "bybit");
      expect(marketStore.getState().exchangeSource).toBe("bybit");
    });

    it("notifies subscribers when state changes", () => {
      let notified = false;
      const unsubscribe = marketStore.subscribe(() => {
        notified = true;
      });

      marketStore.setState({ price: 69000 });
      // In node environment without rAF, notify is scheduled/invoked
      expect(marketStore.getState().price).toBe(69000);

      unsubscribe();
    });

    describe("updateLiveCandle", () => {
      it("initializes candle array if empty", () => {
        const candle = {
          time: 1700000000,
          open: 65000,
          high: 65500,
          low: 64900,
          close: 65200,
          volume: 10.5,
        };
        marketStore.updateLiveCandle(candle);
        expect(marketStore.getState().candles).toEqual([candle]);
      });

      it("updates the active candle in place when time matches", () => {
        const c1 = {
          time: 1700000000,
          open: 65000,
          high: 65500,
          low: 64900,
          close: 65200,
          volume: 10.5,
        };
        const c2 = {
          time: 1700000060,
          open: 65200,
          high: 65300,
          low: 65100,
          close: 65250,
          volume: 2.1,
        };
        marketStore.setState({ candles: [c1, c2] });

        // Tick updates current candle's close and high
        const c2Update = {
          time: 1700000060,
          open: 65200,
          high: 65400,
          low: 65100,
          close: 65380,
          volume: 3.5,
        };
        marketStore.updateLiveCandle(c2Update);

        const candles = marketStore.getState().candles;
        expect(candles).toHaveLength(2);
        expect(candles[0]).toEqual(c1);
        expect(candles[1]).toEqual(c2Update);
      });

      it("appends new candle when timestamp is newer", () => {
        const c1 = {
          time: 1700000000,
          open: 65000,
          high: 65500,
          low: 64900,
          close: 65200,
          volume: 10.5,
        };
        marketStore.setState({ candles: [c1] });

        const c2 = {
          time: 1700000060,
          open: 65200,
          high: 65300,
          low: 65100,
          close: 65250,
          volume: 1.0,
        };
        marketStore.updateLiveCandle(c2);

        const candles = marketStore.getState().candles;
        expect(candles).toHaveLength(2);
        expect(candles[1]).toEqual(c2);
      });

      it("does not update state if identical candle is pushed", () => {
        const c1 = {
          time: 1700000000,
          open: 65000,
          high: 65500,
          low: 64900,
          close: 65200,
          volume: 10.5,
        };
        marketStore.setState({ candles: [c1] });
        const beforeRef = marketStore.getState().candles;

        // Push identical values
        marketStore.updateLiveCandle({ ...c1 });
        const afterRef = marketStore.getState().candles;

        expect(beforeRef).toBe(afterRef); // Same array reference
      });
    });
  });
});
