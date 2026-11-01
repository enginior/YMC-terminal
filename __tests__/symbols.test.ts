import { describe, it, expect } from "vitest";
import {
  UNIVERSE,
  CHART_LABELS,
  toBinanceSymbol,
  toLabel,
  isFuturesSymbol,
  isChartable,
  resolvePrefix,
} from "@/lib/symbols";

describe("symbols mapping", () => {
  it("defines 12 assets in UNIVERSE with matching CHART_LABELS", () => {
    expect(UNIVERSE).toHaveLength(12);
    expect(CHART_LABELS).toHaveLength(12);
    expect(CHART_LABELS[0]).toBe("BTC/USDT");
    expect(CHART_LABELS[CHART_LABELS.length - 1]).toBe("OIL/USDT");
  });

  describe("toBinanceSymbol", () => {
    it("converts canonical UI labels to real exchange symbols", () => {
      expect(toBinanceSymbol("BTC/USDT")).toBe("BTCUSDT");
      expect(toBinanceSymbol("ETH/USDT")).toBe("ETHUSDT");
      expect(toBinanceSymbol("SOL/USDT")).toBe("SOLUSDT");
      expect(toBinanceSymbol("XAU/USDT")).toBe("XAUUSDT");
      expect(toBinanceSymbol("XAG/USDT")).toBe("XAGUSDT");
      expect(toBinanceSymbol("OIL/USDT")).toBe("CLUSDT");
    });

    it("handles aliases and commodity variants without 502 collisions", () => {
      expect(toBinanceSymbol("GOLD/USDT")).toBe("XAUUSDT");
      expect(toBinanceSymbol("GOLD")).toBe("XAUUSDT");
      expect(toBinanceSymbol("PAXGUSDT")).toBe("XAUUSDT");
      expect(toBinanceSymbol("PAXG/USDT")).toBe("XAUUSDT");
      expect(toBinanceSymbol("SILVER/USDT")).toBe("XAGUSDT");
      expect(toBinanceSymbol("CRUDE/USDT")).toBe("CLUSDT");
      expect(toBinanceSymbol("WTI/USDT")).toBe("CLUSDT");
      expect(toBinanceSymbol("OIL")).toBe("CLUSDT");
    });

    it("accepts direct Binance symbols", () => {
      expect(toBinanceSymbol("BTCUSDT")).toBe("BTCUSDT");
      expect(toBinanceSymbol("ETHUSDT")).toBe("ETHUSDT");
      expect(toBinanceSymbol("CLUSDT")).toBe("CLUSDT");
    });

    it("is case-insensitive for lookup", () => {
      expect(toBinanceSymbol("btc/usdt")).toBe("BTCUSDT");
      expect(toBinanceSymbol("xau/usdt")).toBe("XAUUSDT");
      expect(toBinanceSymbol("gold")).toBe("XAUUSDT");
    });

    it("returns null for non-chartable queries", () => {
      expect(toBinanceSymbol("RANDOM_COIN")).toBeNull();
      expect(toBinanceSymbol("")).toBeNull();
    });
  });

  describe("toLabel", () => {
    it("converts exchange symbols to UI labels", () => {
      expect(toLabel("BTCUSDT")).toBe("BTC/USDT");
      expect(toLabel("ETHUSDT")).toBe("ETH/USDT");
      expect(toLabel("XAUUSDT")).toBe("XAU/USDT");
      expect(toLabel("CLUSDT")).toBe("OIL/USDT");
      expect(toLabel("PAXGUSDT")).toBe("XAU/USDT");
    });
  });

  describe("isFuturesSymbol", () => {
    it("identifies commodities requiring Binance futures API (fapi/fstream)", () => {
      expect(isFuturesSymbol("XAUUSDT")).toBe(true);
      expect(isFuturesSymbol("XAU/USDT")).toBe(true);
      expect(isFuturesSymbol("GOLD")).toBe(true);
      expect(isFuturesSymbol("XAGUSDT")).toBe(true);
      expect(isFuturesSymbol("SILVER")).toBe(true);
      expect(isFuturesSymbol("CLUSDT")).toBe(true);
      expect(isFuturesSymbol("OIL")).toBe(true);
      expect(isFuturesSymbol("CRUDE")).toBe(true);
      expect(isFuturesSymbol("WTI")).toBe(true);
    });

    it("identifies spot crypto pairs as non-futures", () => {
      expect(isFuturesSymbol("BTCUSDT")).toBe(false);
      expect(isFuturesSymbol("BTC/USDT")).toBe(false);
      expect(isFuturesSymbol("ETHUSDT")).toBe(false);
      expect(isFuturesSymbol("SOLUSDT")).toBe(false);
    });
  });

  describe("isChartable", () => {
    it("validates chartable assets", () => {
      expect(isChartable("BTC/USDT")).toBe(true);
      expect(isChartable("GOLD/USDT")).toBe(true);
      expect(isChartable("OIL/USDT")).toBe(true);
      expect(isChartable("FAKE/USDT")).toBe(false);
    });
  });

  describe("resolvePrefix", () => {
    it("resolves user command/search shortcuts to chartable labels", () => {
      expect(resolvePrefix("btc")).toBe("BTC/USDT");
      expect(resolvePrefix("sol")).toBe("SOL/USDT");
      expect(resolvePrefix("gold")).toBe("XAU/USDT");
      expect(resolvePrefix("xau")).toBe("XAU/USDT");
      expect(resolvePrefix("silver")).toBe("XAG/USDT");
      expect(resolvePrefix("oil")).toBe("OIL/USDT");
      expect(resolvePrefix("cl")).toBe("OIL/USDT");
      expect(resolvePrefix("crude")).toBe("OIL/USDT");
      expect(resolvePrefix("wti")).toBe("OIL/USDT");
      expect(resolvePrefix("xyz123")).toBeNull();
      expect(resolvePrefix("")).toBeNull();
    });
  });
});
