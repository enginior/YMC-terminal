import { describe, it, expect } from "vitest";
import { tagHeadline, baseOf } from "@/lib/newsTags";

describe("newsTags", () => {
  describe("baseOf", () => {
    it("extracts base asset symbol from formatted pair labels", () => {
      expect(baseOf("BTC/USDT")).toBe("BTC");
      expect(baseOf("ETH/USDT")).toBe("ETH");
      expect(baseOf("XAU/USDT")).toBe("XAU");
      expect(baseOf("OIL/USDT")).toBe("OIL");
    });

    it("extracts base from raw Binance symbol", () => {
      expect(baseOf("BTCUSDT")).toBe("BTC");
      expect(baseOf("ETHUSDT")).toBe("ETH");
      expect(baseOf("CLUSDT")).toBe("CL");
    });

    it("falls back to BTC on empty input", () => {
      expect(baseOf("")).toBe("BTC");
    });
  });

  describe("tagHeadline", () => {
    it("tags UNIVERSE crypto assets and ETF macro tag", () => {
      const tags = tagHeadline("Bitcoin rallies to new highs as spot BTC ETF inflows surge");
      expect(tags).toContain("BTC");
      expect(tags).toContain("ETF");
    });

    it("tags multiple assets in comparative headlines", () => {
      const tags = tagHeadline("Ethereum and Solana compete for DeFi volume as Avalanche gains");
      expect(tags).toContain("ETH");
      expect(tags).toContain("SOL");
      expect(tags).toContain("AVAX");
    });

    it("tags commodities and regulatory bodies", () => {
      const tags = tagHeadline("Gold and Silver break records while SEC clarifies crypto policy");
      expect(tags).toContain("XAU");
      expect(tags).toContain("XAG");
      expect(tags).toContain("SEC");
    });

    it("tags crude oil and OPEC headlines", () => {
      const tags = tagHeadline("Oil prices rise 2% following latest OPEC announcement");
      expect(tags).toContain("OIL");
    });

    it("tags Federal Reserve and inflation macro keywords", () => {
      const tags = tagHeadline("FOMC signals possible rate cuts following favorable CPI inflation print");
      expect(tags).toContain("MACRO");
    });

    it("avoids substring collisions on common English words (collision protection)", () => {
      // 'second' must NOT match 'SEC'
      // 'linked' must NOT match 'LINK'
      // 'solid' must NOT match 'SOL'
      const tags = tagHeadline("For the second time, the team linked multiple accounts with solid results");
      expect(tags).not.toContain("SEC");
      expect(tags).not.toContain("LINK");
      expect(tags).not.toContain("SOL");
    });

    it("returns empty array for unrelated headlines or empty string", () => {
      expect(tagHeadline("")).toEqual([]);
      expect(tagHeadline("New gaming console released today with advanced graphics")).toEqual([]);
    });
  });
});
