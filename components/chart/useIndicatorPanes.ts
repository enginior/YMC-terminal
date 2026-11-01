import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  LineSeries,
  HistogramSeries,
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
import { sma, ema, rsi, macd, bollingerBands, stochRsi } from "@/lib/indicators";
import { PriceBandPrimitive } from "@/lib/bands";
import {
  IndicatorType,
  PaneIndicator,
  ComputedValues,
  OVERLAYS,
  OVERLAY_SPECS,
} from "./types";

interface UseIndicatorPanesOptions {
  chartRef: React.RefObject<IChartApi | null>;
  candles: Candle[];
  theme: Theme;
  chartEpoch: number;
}

export function useIndicatorPanes({
  chartRef,
  candles,
  theme,
  chartEpoch,
}: UseIndicatorPanesOptions) {
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorType>>(new Set());

  // Series created for indicators, torn down and rebuilt when the set changes.
  const indicatorRefs = useRef<Map<IndicatorType, ISeriesApi<any>[]>>(new Map());

  // Sub-panes for RSI / MACD (v5 native panes), kept across theme changes so a
  // user-resized pane keeps its height until the indicator is switched off.
  const paneRefs = useRef<Map<PaneIndicator, IPaneApi<Time>>>(new Map());

  const computed = useMemo(() => {
    if (candles.length === 0) return null;
    return {
      sma20: sma(candles, 20),
      sma50: sma(candles, 50),
      ema20: ema(candles, 20),
      ema50: ema(candles, 50),
      bb: bollingerBands(candles, 20, 2),
      rsi: rsi(candles, 14),
      macd: macd(candles),
      stochRsi: stochRsi(candles, 14, 14, 3, 3),
    };
  }, [candles]);

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
      rsiBand.setBand(70, 30, `${theme.dim}22`);
      [70, 50, 30].forEach((price) =>
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
      stochBand.setBand(80, 20, `${theme.dim}22`);

      [80, 20].forEach((price) =>
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
  }, [activeIndicators, theme, chartEpoch, line, histData, chartRef]);

  /* ---------------- data effect: push fresh values on every tick ---------------- */

  useEffect(() => {
    if (!computed) return;

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
  }, [computed, theme, line, histData]);

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
  };
}
