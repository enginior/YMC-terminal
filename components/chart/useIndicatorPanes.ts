import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  LineSeries,
  HistogramSeries,
  AreaSeries,
  LineStyle,
  IChartApi,
  ISeriesApi,
  IPaneApi,
  UTCTimestamp,
  HistogramData,
  Time,
} from "lightweight-charts";
import { Candle } from "@/lib/types";
import { Theme } from "@/context/ThemeContext";
import { sma, ema, rsi, macd, bollingerBands, stochRsi, cvd } from "@/lib/indicators";
import { PriceBandPrimitive } from "@/lib/bands";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import {
  IndicatorType,
  PaneIndicator,
  ComputedValues,
  OVERLAYS,
  OVERLAY_SPECS,
  IndicatorSettings,
  DEFAULT_INDICATOR_SETTINGS,
  INDICATOR_SETTINGS_KEY,
} from "./types";

interface UseIndicatorPanesOptions {
  chartRef: React.RefObject<IChartApi | null>;
  candles: Candle[];
  theme: Theme;
  chartEpoch: number;
  symbol: string;
  timeframe: string;
}

interface DerivativesData {
  openInterest: Array<{ time: number; value: number; amount: number }>;
  fundingRates: Array<{ time: number; rate: number; markPrice: number }>;
}

function dedupeAndSort<T extends { time: UTCTimestamp }>(data: T[]): T[] {
  const map = new Map<number, T>();
  for (const item of data) {
    map.set(item.time as number, item);
  }
  return Array.from(map.values()).sort((a, b) => (a.time as number) - (b.time as number));
}

export function useIndicatorPanes({
  chartRef,
  candles,
  theme,
  chartEpoch,
  symbol,
  timeframe,
}: UseIndicatorPanesOptions) {
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorType>>(new Set());
  const [settings, setSettings] = useState<IndicatorSettings>(DEFAULT_INDICATOR_SETTINGS);
  const skipSettingsSaveRef = useRef(true);
  const [derivativesData, setDerivativesData] = useState<DerivativesData | null>(null);
  const derivativesDataRef = useRef<DerivativesData | null>(null);
  derivativesDataRef.current = derivativesData;

  // Load persisted indicator settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(INDICATOR_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setSettings((prev) => ({
            ...prev,
            ...parsed,
            sma: { ...prev.sma, ...parsed.sma },
            ema: { ...prev.ema, ...parsed.ema },
            bollinger: { ...prev.bollinger, ...parsed.bollinger },
            rsi: { ...prev.rsi, ...parsed.rsi },
            macd: { ...prev.macd, ...parsed.macd },
            stochrsi: { ...prev.stochrsi, ...parsed.stochrsi },
          }));
        }
      }
    } catch {}
  }, []);

  // Persist indicator settings to localStorage
  useEffect(() => {
    if (skipSettingsSaveRef.current) {
      skipSettingsSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(INDICATOR_SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const updateSettings = useCallback(
    <K extends keyof IndicatorSettings>(key: K, updates: Partial<IndicatorSettings[K]>) => {
      setSettings((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          ...updates,
        },
      }));
    },
    []
  );

  const resetSettings = useCallback((key?: keyof IndicatorSettings) => {
    if (key) {
      setSettings((prev) => ({
        ...prev,
        [key]: { ...DEFAULT_INDICATOR_SETTINGS[key] },
      }));
    } else {
      setSettings(DEFAULT_INDICATOR_SETTINGS);
    }
  }, []);

  // Series created for indicators, torn down and rebuilt when the set changes.
  const indicatorRefs = useRef<Map<IndicatorType, ISeriesApi<any>[]>>(new Map());

  // Sub-panes for RSI / MACD / Stoch / OI / Funding / CVD (v5 native panes), kept across theme changes so a
  // user-resized pane keeps its height until the indicator is switched off.
  const paneRefs = useRef<Map<PaneIndicator, IPaneApi<Time>>>(new Map());

  // Fetch derivatives data (OI, Funding) when respective indicators are enabled (throttled when backgrounded)
  const needsDerivatives = activeIndicators.has("oi") || activeIndicators.has("funding");

  const fetchDerivatives = useCallback(async () => {
    if (!needsDerivatives) return;
    try {
      const res = await fetch(
        `/api/derivatives?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setDerivativesData({
          openInterest: Array.isArray(data.openInterest) ? data.openInterest : [],
          fundingRates: Array.isArray(data.fundingRates) ? data.fundingRates : [],
        });
      }
    } catch {}
  }, [needsDerivatives, symbol, timeframe]);

  useVisibilityPolling(fetchDerivatives, 30_000, { enabled: needsDerivatives });

  const computed = useMemo(() => {
    if (candles.length === 0) return null;
    const smaFast = sma(candles, settings.sma.fast);
    const smaSlow = sma(candles, settings.sma.slow);
    const emaFast = ema(candles, settings.ema.fast);
    const emaSlow = ema(candles, settings.ema.slow);
    return {
      smaFast,
      smaSlow,
      sma20: smaFast,
      sma50: smaSlow,
      emaFast,
      emaSlow,
      ema20: emaFast,
      ema50: emaSlow,
      bb: bollingerBands(candles, settings.bollinger.period, settings.bollinger.stdDev),
      rsi: rsi(candles, settings.rsi.period),
      macd: macd(candles, settings.macd.fast, settings.macd.slow, settings.macd.signal),
      stochRsi: stochRsi(
        candles,
        settings.stochrsi.lengthRSI,
        settings.stochrsi.lengthStoch,
        settings.stochrsi.smoothK,
        settings.stochrsi.smoothD
      ),
      cvd: cvd(candles),
    };
  }, [candles, settings]);

  const computedRef = useRef<ComputedValues | null>(null);
  computedRef.current = computed;

  const line = useCallback(
    (values: (number | null)[]) =>
      values
        .map((v, i) =>
          v === null ? null : { time: candles[i].time as UTCTimestamp, value: v }
        )
        .filter((d): d is { time: UTCTimestamp; value: number } => d !== null),
    [candles]
  );

  const histData = useCallback(
    (values: (number | null)[]) =>
      values
        .map((v, i) =>
          v === null
            ? null
            : ({
                time: candles[i].time as UTCTimestamp,
                value: v,
                color: v >= 0 ? `${theme.green}88` : `${theme.red}88`,
              } as HistogramData)
        )
        .filter((d): d is HistogramData => d !== null),
    [candles, theme]
  );

  const toggleIndicator = useCallback((id: IndicatorType) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  /* ---------------- structural effect: create / destroy series & panes ---------------- */

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Tear down previous indicator series
    indicatorRefs.current.forEach((seriesList) => {
      seriesList.forEach((s) => {
        try {
          chart.removeSeries(s);
        } catch {}
      });
    });
    indicatorRefs.current.clear();

    // Drop sub-panes that are no longer active
    paneRefs.current.forEach((pane, key) => {
      if (!activeIndicators.has(key)) {
        try {
          chart.removePane(pane.paneIndex());
        } catch {}
        paneRefs.current.delete(key);
      }
    });

    const comp = computedRef.current;
    if (!comp) return;

    // Reuse an existing pane (keeps user-resized height); create one otherwise.
    const ensurePane = (key: PaneIndicator): IPaneApi<Time> => {
      let pane = paneRefs.current.get(key);
      if (!pane) {
        pane = chart.addPane(true);
        pane.setStretchFactor(1);
        chart.panes()[0]?.setStretchFactor(4);
        paneRefs.current.set(key, pane);
      }
      return pane;
    };

    OVERLAYS.forEach((key) => {
      if (!activeIndicators.has(key)) return;
      const created = OVERLAY_SPECS[key].map((spec) => {
        const s = chart.addSeries(LineSeries, {
          color: theme[spec.colorKey],
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s.setData(line(spec.values(comp)));
        return s;
      });
      indicatorRefs.current.set(key, created);
    });

    if (activeIndicators.has("rsi")) {
      const pane = ensurePane("rsi");
      const r = pane.addSeries(LineSeries, {
        color: theme.blue,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
      });
      r.setData(line(comp.rsi));
      const rsiBand = new PriceBandPrimitive();
      r.attachPrimitive(rsiBand);
      rsiBand.setBand(settings.rsi.overbought, settings.rsi.oversold, `${theme.dim}22`);
      [settings.rsi.overbought, 50, settings.rsi.oversold].forEach((price) =>
        r.createPriceLine({
          price,
          color: theme.dim,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lineVisible: true,
          axisLabelVisible: false,
          title: "",
        })
      );
      indicatorRefs.current.set("rsi", [r]);
    }

    if (activeIndicators.has("macd")) {
      const pane = ensurePane("macd");
      const macdSeries = pane.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
      });
      macdSeries.setData(histData(comp.macd.histogram));

      const macdLineS = pane.addSeries(LineSeries, {
        color: theme.blue,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      macdLineS.setData(line(comp.macd.macdLine));

      const signalS = pane.addSeries(LineSeries, {
        color: theme.yellow,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      signalS.setData(line(comp.macd.signalLine));

      indicatorRefs.current.set("macd", [macdSeries, macdLineS, signalS]);
    }

    if (activeIndicators.has("stochrsi")) {
      const pane = ensurePane("stochrsi");
      const kSeries = pane.addSeries(LineSeries, {
        color: theme.blue,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
      });
      kSeries.setData(line(comp.stochRsi.k));

      const dSeries = pane.addSeries(LineSeries, {
        color: theme.yellow,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      dSeries.setData(line(comp.stochRsi.d));

      const stochBand = new PriceBandPrimitive();
      kSeries.attachPrimitive(stochBand);
      stochBand.setBand(settings.stochrsi.overbought, settings.stochrsi.oversold, `${theme.dim}22`);

      [settings.stochrsi.overbought, settings.stochrsi.oversold].forEach((price) =>
        kSeries.createPriceLine({
          price,
          color: theme.dim,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lineVisible: true,
          axisLabelVisible: false,
          title: "",
        })
      );
      indicatorRefs.current.set("stochrsi", [kSeries, dSeries]);
    }

    if (activeIndicators.has("oi")) {
      const pane = ensurePane("oi");
      const oiSeries = pane.addSeries(AreaSeries, {
        topColor: `${theme.blue}40`,
        bottomColor: `${theme.blue}05`,
        lineColor: theme.blue,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "OI",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => {
            if (price >= 1e9) return `$${(price / 1e9).toFixed(2)}B`;
            if (price >= 1e6) return `$${(price / 1e6).toFixed(2)}M`;
            if (price >= 1e3) return `$${(price / 1e3).toFixed(1)}k`;
            return `$${price.toFixed(0)}`;
          },
        },
      });
      if (derivativesDataRef.current?.openInterest && derivativesDataRef.current.openInterest.length > 0) {
        const points = dedupeAndSort(
          derivativesDataRef.current.openInterest.map((d) => ({
            time: d.time as UTCTimestamp,
            value: d.value,
          }))
        );
        oiSeries.setData(points);
      }
      indicatorRefs.current.set("oi", [oiSeries]);
    }

    if (activeIndicators.has("funding")) {
      const pane = ensurePane("funding");
      const fundingSeries = pane.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: true,
        title: "Funding",
        priceFormat: {
          type: "custom",
          formatter: (val: number) => `${val >= 0 ? "+" : ""}${val.toFixed(4)}%`,
        },
      });
      fundingSeries.createPriceLine({
        price: 0,
        color: theme.dim,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        lineVisible: true,
        axisLabelVisible: true,
        title: "0.00%",
      });
      if (derivativesDataRef.current?.fundingRates && derivativesDataRef.current.fundingRates.length > 0) {
        const points = dedupeAndSort(
          derivativesDataRef.current.fundingRates.map((d) => ({
            time: d.time as UTCTimestamp,
            value: d.rate,
            color: d.rate >= 0 ? `${theme.green}cc` : `${theme.red}cc`,
          }))
        );
        fundingSeries.setData(points);
      }
      indicatorRefs.current.set("funding", [fundingSeries]);
    }

    if (activeIndicators.has("cvd")) {
      const pane = ensurePane("cvd");
      const cvdSeries = pane.addSeries(LineSeries, {
        color: "#38bdf8",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "CVD",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => {
            const sign = price >= 0 ? "+" : "-";
            const abs = Math.abs(price);
            if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
            if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
            if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}k`;
            return `${sign}${abs.toFixed(0)}`;
          },
        },
      });
      cvdSeries.createPriceLine({
        price: 0,
        color: theme.dim,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        lineVisible: true,
        axisLabelVisible: true,
        title: "0",
      });
      cvdSeries.setData(line(comp.cvd));
      indicatorRefs.current.set("cvd", [cvdSeries]);
    }
  }, [
    activeIndicators,
    theme,
    chartEpoch,
    line,
    histData,
    chartRef,
    settings.rsi.overbought,
    settings.rsi.oversold,
    settings.stochrsi.overbought,
    settings.stochrsi.oversold,
  ]);

  /* ---------------- data effect: push fresh values on every tick ---------------- */

  useEffect(() => {
    if (computed) {
      OVERLAYS.forEach((key) => {
        const entry = indicatorRefs.current.get(key);
        if (!entry) return;
        OVERLAY_SPECS[key].forEach((spec, i) => {
          try {
            entry[i]?.setData(line(spec.values(computed)));
          } catch {}
        });
      });

      const rsiEntry = indicatorRefs.current.get("rsi");
      if (rsiEntry?.[0]) {
        try {
          rsiEntry[0].setData(line(computed.rsi));
        } catch {}
      }

      const macdEntry = indicatorRefs.current.get("macd");
      if (macdEntry?.[0] && macdEntry[1] && macdEntry[2]) {
        try {
          macdEntry[0].setData(histData(computed.macd.histogram));
          macdEntry[1].setData(line(computed.macd.macdLine));
          macdEntry[2].setData(line(computed.macd.signalLine));
        } catch {}
      }

      const stochEntry = indicatorRefs.current.get("stochrsi");
      if (stochEntry?.[0] && stochEntry[1]) {
        try {
          stochEntry[0].setData(line(computed.stochRsi.k));
          stochEntry[1].setData(line(computed.stochRsi.d));
        } catch {}
      }

      const cvdEntry = indicatorRefs.current.get("cvd");
      if (cvdEntry?.[0]) {
        try {
          cvdEntry[0].setData(line(computed.cvd));
        } catch {}
      }
    }

    if (derivativesData) {
      const oiEntry = indicatorRefs.current.get("oi");
      if (oiEntry?.[0]) {
        try {
          const points = dedupeAndSort(
            derivativesData.openInterest.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            }))
          );
          oiEntry[0].setData(points);
        } catch {}
      }

      const fundingEntry = indicatorRefs.current.get("funding");
      if (fundingEntry?.[0]) {
        try {
          const points = dedupeAndSort(
            derivativesData.fundingRates.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.rate,
              color: d.rate >= 0 ? `${theme.green}cc` : `${theme.red}cc`,
            }))
          );
          fundingEntry[0].setData(points);
        } catch {}
      }
    }
  }, [computed, derivativesData, theme, line, histData]);

  // Clean up pane refs when chart instance is torn down
  useEffect(() => {
    return () => {
      paneRefs.current.clear();
      indicatorRefs.current.clear();
    };
  }, [chartEpoch]);

  return {
    activeIndicators,
    toggleIndicator,
    computed,
    indicatorSettings: settings,
    updateIndicatorSettings: updateSettings,
    resetIndicatorSettings: resetSettings,
  };
}
