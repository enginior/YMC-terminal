import { describe, it, expect } from "vitest";
import { marketStore } from "@/lib/marketStore";
import { Candle, LiquidationOrder } from "@/lib/types";
import {
  findEnclosingCandleTime,
  buildLiquidationMarkers,
} from "@/components/chart/useLiquidationMarkers";

const mockTheme: any = {
  red: "#ff5c5c",
  green: "#00d09c",
  panel: "#111111",
};

describe("marketStore liquidation orders", () => {
  it("buffers liquidations and preserves them on store reset", () => {
    const order1: LiquidationOrder = {
      id: "liq-1",
      symbol: "BTC",
      rawSymbol: "BTCUSDT",
      side: "SELL",
      price: 68000,
      qty: 1.5,
      usdValue: 102000,
      time: "12:00:01",
      timestamp: 1700000001000,
      isLarge: true,
    };

    marketStore.addLiquidation(order1);
    expect(marketStore.getState().liquidations).toContainEqual(order1);

    // Calling reset for a new symbol/timeframe preserves liquidations stream
    marketStore.reset("ETHUSDT", "15m");
    expect(marketStore.getState().liquidations).toContainEqual(order1);
  });
});

describe("findEnclosingCandleTime", () => {
  const candles: Candle[] = [
    { time: 1000, open: 10, high: 15, low: 9, close: 14, volume: 100 },
    { time: 1060, open: 14, high: 18, low: 13, close: 17, volume: 120 },
    { time: 1120, open: 17, high: 20, low: 16, close: 19, volume: 150 },
  ];

  it("finds exact candle open timestamp", () => {
    expect(findEnclosingCandleTime(candles, 1000)).toBe(1000);
    expect(findEnclosingCandleTime(candles, 1060)).toBe(1060);
    expect(findEnclosingCandleTime(candles, 1120)).toBe(1120);
  });

  it("finds enclosing candle when timestamp is inside the bar interval", () => {
    expect(findEnclosingCandleTime(candles, 1025)).toBe(1000);
    expect(findEnclosingCandleTime(candles, 1059)).toBe(1000);
    expect(findEnclosingCandleTime(candles, 1090)).toBe(1060);
  });

  it("attaches timestamp beyond last candle to the active bar", () => {
    expect(findEnclosingCandleTime(candles, 1150)).toBe(1120);
    expect(findEnclosingCandleTime(candles, 2000)).toBe(1120);
  });

  it("returns null for timestamps before oldest candle", () => {
    expect(findEnclosingCandleTime(candles, 999)).toBeNull();
    expect(findEnclosingCandleTime(candles, 500)).toBeNull();
  });

  it("returns null for empty candles", () => {
    expect(findEnclosingCandleTime([], 1000)).toBeNull();
  });
});

describe("buildLiquidationMarkers", () => {
  const candles: Candle[] = [
    { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
    { time: 1060, open: 102, high: 110, low: 100, close: 108, volume: 1200 },
    { time: 1120, open: 108, high: 115, low: 105, close: 112, volume: 1500 },
  ];

  const liquidations: LiquidationOrder[] = [
    // Long liquidation on BTC (forced SELL) at t=1020 ($20k)
    {
      id: "l-1",
      symbol: "BTC",
      rawSymbol: "BTCUSDT",
      side: "SELL",
      price: 68100,
      qty: 0.3,
      usdValue: 20430,
      time: "10:00:20",
      timestamp: 1020 * 1000,
      isLarge: false,
    },
    // Large Long liquidation on BTC at t=1080 ($120k)
    {
      id: "l-2",
      symbol: "BTC",
      rawSymbol: "BTCUSDT",
      side: "SELL",
      price: 67900,
      qty: 1.767,
      usdValue: 120000,
      time: "10:01:20",
      timestamp: 1080 * 1000,
      isLarge: true,
    },
    // Mega Short liquidation on BTC (forced BUY) at t=1130 ($300k)
    {
      id: "l-3",
      symbol: "BTC",
      rawSymbol: "BTCUSDT",
      side: "BUY",
      price: 68500,
      qty: 4.38,
      usdValue: 300000,
      time: "10:02:10",
      timestamp: 1130 * 1000,
      isLarge: true,
    },
    // ETH liquidation (should be excluded when symbol is BTC)
    {
      id: "l-4",
      symbol: "ETH",
      rawSymbol: "ETHUSDT",
      side: "SELL",
      price: 3500,
      qty: 50,
      usdValue: 175000,
      time: "10:02:15",
      timestamp: 1135 * 1000,
      isLarge: true,
    },
  ];

  it("filters liquidations by active symbol and minimum USD threshold", () => {
    // Threshold $50k: l-1 ($20k) and l-4 (ETH) should be excluded
    const markers = buildLiquidationMarkers(liquidations, candles, "BTC/USDT", 50000, mockTheme);
    expect(markers).toHaveLength(2);
    expect(markers[0].id).toBe("liq-l-2");
    expect(markers[1].id).toBe("liq-l-3");
  });

  it("applies correct color, size, text, and position for long and short liquidations", () => {
    const markers = buildLiquidationMarkers(liquidations, candles, "BTC/USDT", 0, mockTheme);
    expect(markers).toHaveLength(3);

    // Marker 1: Small Long Liq ($20k) -> size 1, red, no text badge (<$100k)
    const m1 = markers[0];
    expect(m1.color).toBe(mockTheme.red);
    expect(m1.size).toBe(1);
    expect(m1.text).toBeUndefined();
    expect(m1.price).toBe(68100);
    expect(m1.time).toBe(1000);

    // Marker 2: Medium Long Liq ($120k) -> size 2, red, badge "$120K"
    const m2 = markers[1];
    expect(m2.color).toBe(mockTheme.red);
    expect(m2.size).toBe(2);
    expect(m2.text).toBe("$120K");
    expect(m2.price).toBe(67900);
    expect(m2.time).toBe(1060);

    // Marker 3: Large Short Liq ($300k) -> size 3, green, badge "$300K"
    const m3 = markers[2];
    expect(m3.color).toBe(mockTheme.green);
    expect(m3.size).toBe(3);
    expect(m3.text).toBe("$300K");
    expect(m3.price).toBe(68500);
    expect(m3.time).toBe(1120);
  });

  it("ensures markers are sorted in ascending chronological order for lightweight-charts", () => {
    const unsorted = [...liquidations].reverse();
    const markers = buildLiquidationMarkers(unsorted, candles, "BTC/USDT", 0, mockTheme);
    for (let i = 0; i < markers.length - 1; i++) {
      expect((markers[i].time as number) <= (markers[i + 1].time as number)).toBe(true);
    }
  });
});
