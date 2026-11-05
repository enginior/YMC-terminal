import { describe, it, expect } from "vitest";
import { toBinanceSymbol, toLabel } from "@/lib/symbols";

interface PriceAlert {
  id: number;
  symbol: string;
  condition: "above" | "below";
  price: number;
  active: boolean;
  triggered: boolean;
  isArmed?: boolean;
  label?: string;
}

interface MarketStateSnapshot {
  symbol: string;
  price: number;
  tickers: Record<string, number>;
}

/**
 * Evaluates active alerts against the market store snapshot
 * following the exact logic in hooks/useAlerts.ts.
 */
function evaluateAlerts(alerts: PriceAlert[], state: MarketStateSnapshot): PriceAlert[] {
  const triggered: PriceAlert[] = [];
  const tickers = state.tickers;

  for (const a of alerts) {
    if (!a.active || a.triggered) continue;

    const bSymbol = toBinanceSymbol(a.symbol) || a.symbol.toUpperCase().replace(/[\/\s]/g, "");
    let symPrice = tickers[bSymbol] ?? tickers[a.symbol];

    // Fallback: if alert is for active chart symbol and not in tickers yet, use state.price
    if (
      (!symPrice || symPrice <= 0) &&
      (state.symbol === bSymbol || toLabel(state.symbol) === a.symbol)
    ) {
      symPrice = state.price;
    }

    if (!symPrice || symPrice <= 0) continue;

    const isHit =
      (a.condition === "above" && symPrice >= a.price) ||
      (a.condition === "below" && symPrice <= a.price);

    if (isHit) {
      triggered.push({ ...a, triggered: true, active: false });
    }
  }

  return triggered;
}

describe("per-symbol alert evaluation", () => {
  it("does NOT misfire when switching active chart to a cheaper symbol (Spec 004 fix)", () => {
    const alerts: PriceAlert[] = [
      {
        id: 1,
        symbol: "BTC/USDT",
        condition: "below",
        price: 70000,
        active: true,
        triggered: false,
      },
    ];

    // User is charting SOL at $180, while BTC is at $72,500
    const snapshot: MarketStateSnapshot = {
      symbol: "SOLUSDT",
      price: 180,
      tickers: {
        BTCUSDT: 72500,
        "BTC/USDT": 72500,
        SOLUSDT: 180,
        "SOL/USDT": 180,
      },
    };

    const hits = evaluateAlerts(alerts, snapshot);
    // MUST NOT trigger: 180 is for SOL, BTC is 72500 which is NOT <= 70000
    expect(hits).toHaveLength(0);
  });

  it("triggers when the alert's target symbol crosses the threshold", () => {
    const alerts: PriceAlert[] = [
      {
        id: 1,
        symbol: "BTC/USDT",
        condition: "below",
        price: 70000,
        active: true,
        triggered: false,
      },
      {
        id: 2,
        symbol: "SOL/USDT",
        condition: "above",
        price: 200,
        active: true,
        triggered: false,
      },
    ];

    // BTC drops to 69,500 while user is looking at SOL ($180)
    const snapshot: MarketStateSnapshot = {
      symbol: "SOLUSDT",
      price: 180,
      tickers: {
        BTCUSDT: 69500,
        "BTC/USDT": 69500,
        SOLUSDT: 180,
        "SOL/USDT": 180,
      },
    };

    const hits = evaluateAlerts(alerts, snapshot);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe(1);
    expect(hits[0].symbol).toBe("BTC/USDT");
    expect(hits[0].triggered).toBe(true);
  });

  it("handles commodity futures symbols like XAU/USDT and OIL/USDT", () => {
    const alerts: PriceAlert[] = [
      {
        id: 10,
        symbol: "XAU/USDT",
        condition: "above",
        price: 2800,
        active: true,
        triggered: false,
      },
      {
        id: 11,
        symbol: "OIL/USDT",
        condition: "below",
        price: 70,
        active: true,
        triggered: false,
      },
    ];

    const snapshot: MarketStateSnapshot = {
      symbol: "BTCUSDT",
      price: 68000,
      tickers: {
        BTCUSDT: 68000,
        XAUUSDT: 2815, // crosses above 2800
        "XAU/USDT": 2815,
        CLUSDT: 75, // still above 70
        "OIL/USDT": 75,
      },
    };

    const hits = evaluateAlerts(alerts, snapshot);
    expect(hits).toHaveLength(1);
    expect(hits[0].symbol).toBe("XAU/USDT");
  });

  it("ignores already triggered or deactivated alerts", () => {
    const alerts: PriceAlert[] = [
      {
        id: 1,
        symbol: "BTC/USDT",
        condition: "below",
        price: 70000,
        active: false, // inactive
        triggered: false,
      },
      {
        id: 2,
        symbol: "BTC/USDT",
        condition: "below",
        price: 70000,
        active: true,
        triggered: true, // already triggered
      },
    ];

    const snapshot: MarketStateSnapshot = {
      symbol: "BTCUSDT",
      price: 65000,
      tickers: { BTCUSDT: 65000 },
    };

    const hits = evaluateAlerts(alerts, snapshot);
    expect(hits).toHaveLength(0);
  });

  it("distinguishes armed trade alerts (isArmed: true) with order filled metadata", () => {
    const alerts: PriceAlert[] = [
      {
        id: 201,
        symbol: "BTC/USDT",
        condition: "above",
        price: 95000,
        active: true,
        triggered: false,
        isArmed: true,
        label: "ORB TP",
      },
      {
        id: 202,
        symbol: "BTC/USDT",
        condition: "below",
        price: 91000,
        active: true,
        triggered: false,
        isArmed: false,
      },
    ];

    const snapshot: MarketStateSnapshot = {
      symbol: "BTCUSDT",
      price: 95500,
      tickers: { BTCUSDT: 95500 },
    };

    const hits = evaluateAlerts(alerts, snapshot);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe(201);
    expect(hits[0].isArmed).toBe(true);
    expect(hits[0].label).toBe("ORB TP");
    expect(hits[0].triggered).toBe(true);
  });
});
