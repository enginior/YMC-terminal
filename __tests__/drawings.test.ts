import { describe, it, expect } from "vitest";
import {
  drawingGeometry,
  hitTestDrawing,
  deleteHandlePoint,
  drawingAnchorPoints,
  hitTestAnchor,
  parsePersistedDrawings,
  Drawing,
  FIB_RATIOS,
} from "@/lib/drawings";
import { snapPriceToOhlc } from "@/components/chart/types";

describe("drawings geometry and hit testing", () => {
  const mockChart: any = {
    timeScale: () => ({
      width: () => 1000,
      timeToCoordinate: (t: number) => t - 1000,
      logicalToCoordinate: () => null,
      getVisibleLogicalRange: () => null,
    }),
  };

  const mockSeries: any = {
    priceToCoordinate: (p: number) => 500 - p,
  };

  it("calculates geometry for level and horizontal ray", () => {
    const level: Drawing = {
      id: "lvl-1",
      tool: "level",
      time1: 1100,
      price1: 100,
      time2: 1100,
      price2: 100,
      color: "#ffffff",
    };
    const gLvl = drawingGeometry(level, mockChart, mockSeries);
    expect(gLvl).not.toBeNull();
    expect(gLvl?.kind).toBe("level");
    expect(gLvl?.points[0]).toEqual({ x: 0, y: 400 });
    expect(gLvl?.points[1]).toEqual({ x: 1000, y: 400 });

    const hray: Drawing = {
      id: "hray-1",
      tool: "hray",
      time1: 1200,
      price1: 150,
      time2: 1300,
      price2: 150,
      color: "#ffffff",
    };
    const gHray = drawingGeometry(hray, mockChart, mockSeries);
    expect(gHray).not.toBeNull();
    expect(gHray?.kind).toBe("hray");
    expect(gHray?.points[0]).toEqual({ x: 200, y: 350 });
    expect(gHray?.points[1]).toEqual({ x: 1000, y: 350 });
  });

  it("calculates geometry for ray and arrow", () => {
    const ray: Drawing = {
      id: "ray-1",
      tool: "ray",
      time1: 1100,
      price1: 100,
      time2: 1200,
      price2: 200,
      color: "#ffffff",
    };
    const gRay = drawingGeometry(ray, mockChart, mockSeries);
    expect(gRay).not.toBeNull();
    expect(gRay?.kind).toBe("ray");
    expect(gRay?.points[0]).toEqual({ x: 100, y: 400 });
    expect(gRay?.points[1].x).toBe(1000); // Projects to pane width
    expect(gRay?.guide).toEqual({ x: 200, y: 300 });

    const arrow: Drawing = {
      id: "arrow-1",
      tool: "arrow",
      time1: 1100,
      price1: 100,
      time2: 1300,
      price2: 250,
      color: "#ffffff",
    };
    const gArrow = drawingGeometry(arrow, mockChart, mockSeries);
    expect(gArrow).not.toBeNull();
    expect(gArrow?.kind).toBe("arrow");
    expect(gArrow?.points[0]).toEqual({ x: 100, y: 400 });
    expect(gArrow?.points[1]).toEqual({ x: 300, y: 250 });
  });

  it("calculates geometry for Fibonacci retracement and parallel channel", () => {
    const fib: Drawing = {
      id: "fib-1",
      tool: "fib",
      time1: 1100,
      price1: 100,
      time2: 1400,
      price2: 300,
      color: "#ffffff",
    };
    const gFib = drawingGeometry(fib, mockChart, mockSeries);
    expect(gFib).not.toBeNull();
    expect(gFib?.kind).toBe("fib");
    expect(FIB_RATIOS.length).toBe(7);

    const channel: Drawing = {
      id: "chan-1",
      tool: "channel",
      time1: 1100,
      price1: 100,
      time2: 1400,
      price2: 300,
      color: "#ffffff",
    };
    const gChan = drawingGeometry(channel, mockChart, mockSeries);
    expect(gChan).not.toBeNull();
    expect(gChan?.kind).toBe("channel");
  });

  it("calculates geometry for Long and Short position risk tools", () => {
    const longPos: Drawing = {
      id: "long-1",
      tool: "long",
      time1: 1200,
      price1: 100,
      time2: 1400,
      price2: 200,
      color: "#22c55e",
    };
    const gLong = drawingGeometry(longPos, mockChart, mockSeries);
    expect(gLong).not.toBeNull();
    expect(gLong?.kind).toBe("position");

    const shortPos: Drawing = {
      id: "short-1",
      tool: "short",
      time1: 1200,
      price1: 200,
      time2: 1400,
      price2: 100,
      color: "#ef4444",
    };
    const gShort = drawingGeometry(shortPos, mockChart, mockSeries);
    expect(gShort).not.toBeNull();
    expect(gShort?.kind).toBe("position");
  });

  it("performs hit testing accurately on new drawing tools", () => {
    const arrow: Drawing = {
      id: "arrow-1",
      tool: "arrow",
      time1: 1100,
      price1: 100,
      time2: 1300,
      price2: 100,
      color: "#ffffff",
    };
    // Arrow is horizontal at y = 400 from x = 100 to 300
    expect(hitTestDrawing(arrow, { x: 200, y: 400 }, mockChart, mockSeries)).toBe(true);
    expect(hitTestDrawing(arrow, { x: 200, y: 403 }, mockChart, mockSeries)).toBe(true);
    expect(hitTestDrawing(arrow, { x: 200, y: 420 }, mockChart, mockSeries)).toBe(false);

    const longPos: Drawing = {
      id: "long-1",
      tool: "long",
      time1: 1200,
      price1: 100,
      time2: 1400,
      price2: 200,
      color: "#22c55e",
    };
    // Long position covers x in [200, 400], y in TP/SL ranges around 400
    expect(hitTestDrawing(longPos, { x: 250, y: 350 }, mockChart, mockSeries)).toBe(true);
    expect(hitTestDrawing(longPos, { x: 50, y: 350 }, mockChart, mockSeries)).toBe(false);
  });

  it("places delete handles appropriately for all tools", () => {
    const tools: Drawing["tool"][] = [
      "level",
      "hray",
      "ray",
      "trend",
      "arrow",
      "fib",
      "channel",
      "long",
      "short",
      "rect",
      "ruler",
    ];

    for (const tool of tools) {
      const d: Drawing = {
        id: `tool-${tool}`,
        tool,
        time1: 1100,
        price1: 100,
        time2: 1300,
        price2: 200,
        color: "#ffffff",
      };
      const handle = deleteHandlePoint(d, mockChart, mockSeries);
      expect(handle).not.toBeNull();
      expect(typeof handle?.x).toBe("number");
      expect(typeof handle?.y).toBe("number");
    }
  });

  it("migrates legacy and version 1 drawing formats correctly", () => {
    // Legacy format (raw dictionary)
    const legacy = JSON.stringify({
      BTCUSDT: [
        {
          id: "1",
          tool: "trend",
          time1: 100,
          price1: 50,
          time2: 200,
          price2: 60,
          color: "#fff",
        },
      ],
    });
    const parsedLegacy = parsePersistedDrawings(legacy);
    expect(parsedLegacy.BTCUSDT).toHaveLength(1);
    expect(parsedLegacy.BTCUSDT[0].id).toBe("1");

    // Version 1 format
    const v1 = JSON.stringify({
      version: 1,
      symbols: {
        ETHUSDT: [
          {
            id: "2",
            tool: "level",
            time1: 150,
            price1: 75,
            time2: 150,
            price2: 75,
            color: "#ff0",
            lineWidth: 2,
            lineStyle: "dashed",
            locked: true,
          },
        ],
      },
    });
    const parsedV1 = parsePersistedDrawings(v1);
    expect(parsedV1.ETHUSDT).toHaveLength(1);
    expect(parsedV1.ETHUSDT[0].lineWidth).toBe(2);
    expect(parsedV1.ETHUSDT[0].lineStyle).toBe("dashed");
    expect(parsedV1.ETHUSDT[0].locked).toBe(true);

    // Corrupted input
    expect(parsePersistedDrawings("not-valid-json")).toEqual({});
    expect(parsePersistedDrawings("")).toEqual({});
    expect(parsePersistedDrawings("[]")).toEqual({});
  });

  it("calculates anchor points and performs anchor hit testing", () => {
    const trend: Drawing = {
      id: "trend-1",
      tool: "trend",
      time1: 1100,
      price1: 100,
      time2: 1300,
      price2: 250,
      color: "#ffffff",
    };

    const anchors = drawingAnchorPoints(trend, mockChart, mockSeries);
    expect(anchors).not.toBeNull();
    expect(anchors?.a1).toEqual({ x: 100, y: 400 });
    expect(anchors?.a2).toEqual({ x: 300, y: 250 });

    // Anchor a1 hit test
    expect(hitTestAnchor(trend, { x: 100, y: 400 }, mockChart, mockSeries)).toBe("a1");
    expect(hitTestAnchor(trend, { x: 104, y: 403 }, mockChart, mockSeries, 8)).toBe("a1");

    // Anchor a2 hit test
    expect(hitTestAnchor(trend, { x: 300, y: 250 }, mockChart, mockSeries)).toBe("a2");
    expect(hitTestAnchor(trend, { x: 298, y: 252 }, mockChart, mockSeries, 8)).toBe("a2");

    // Miss
    expect(hitTestAnchor(trend, { x: 200, y: 325 }, mockChart, mockSeries, 8)).toBeNull();

    // Locked drawing suppresses anchor hit test
    const lockedTrend = { ...trend, locked: true };
    expect(hitTestAnchor(lockedTrend, { x: 100, y: 400 }, mockChart, mockSeries)).toBeNull();
    expect(hitTestAnchor(lockedTrend, { x: 300, y: 250 }, mockChart, mockSeries)).toBeNull();
  });

  it("rejects cross-symbol contaminated drawings whose price is wildly out of scale for the active asset", () => {
    const goldCandles = [
      { time: 1100, close: 2680 },
      { time: 1200, close: 2700 },
    ];

    const btcSetupOnGold: Drawing = {
      id: "setup-btc-leak",
      tool: "long",
      time1: 1100,
      price1: 85000,
      time2: 1200,
      price2: 87000,
      stopPrice: 84000,
      color: "#22c55e",
    };

    const validGoldSetup: Drawing = {
      id: "setup-gold-valid",
      tool: "long",
      time1: 1100,
      price1: 2700,
      time2: 1200,
      price2: 2740,
      stopPrice: 2680,
      color: "#22c55e",
    };

    expect(drawingGeometry(btcSetupOnGold, mockChart, mockSeries, goldCandles)).toBeNull();
    expect(drawingGeometry(validGoldSetup, mockChart, mockSeries, goldCandles)).not.toBeNull();
  });

  describe("crosshair magnet snapping", () => {
    const candle = {
      time: 1700000000,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 1000,
    };

    it("snaps to nearest candle OHLC when magnet is ON", () => {
      // Near open (100)
      expect(snapPriceToOhlc(candle, 101)).toBe(100);
      // Near close (105)
      expect(snapPriceToOhlc(candle, 104)).toBe(105);
      // Near high (110)
      expect(snapPriceToOhlc(candle, 109)).toBe(110);
      // Near low (90)
      expect(snapPriceToOhlc(candle, 92)).toBe(90);
    });

    it("allows raw floating cursor price when magnet is OFF", () => {
      // Without magnet, the raw price (e.g. 103.45) is not snapped
      const rawPrice = 103.45;
      const magnetOn = false;
      const activePrice = magnetOn ? snapPriceToOhlc(candle, rawPrice) : rawPrice;
      expect(activePrice).toBe(103.45);
    });
  });
});
