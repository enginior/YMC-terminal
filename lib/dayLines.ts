import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

const DAY = 86400;

export interface DayBoundary {
  prevTime: UTCTimestamp;
  nextTime: UTCTimestamp;
}

/**
 * Identify UTC day boundaries by finding consecutive candles across UTC midnight.
 *
 * Storing the transition pair [prevTime, nextTime] allows the renderer to compute the exact midpoint
 * coordinate between the last candle of the previous day and the first candle of the new day.
 * This guarantees the vertical separator line is placed in the empty space between the candles,
 * never passing through or cutting a candle body on any timeframe (1m, 5m, 15m, 30m, 1h, 2h, 4h, 1d, etc.).
 */
export function utcDayBoundaries(times: number[]): DayBoundary[] {
  const out: DayBoundary[] = [];
  if (times.length < 2) return out;

  for (let i = 1; i < times.length; i++) {
    const prevDay = Math.floor(times[i - 1] / DAY);
    const currDay = Math.floor(times[i] / DAY);
    if (currDay > prevDay) {
      out.push({
        prevTime: times[i - 1] as UTCTimestamp,
        nextTime: times[i] as UTCTimestamp,
      });
    }
  }
  return out;
}

/**
 * Vertical broken/dashed separators drawn at UTC midnight between trading days.
 *
 * A line series cannot do this: `setData` de-duplicates by timestamp, so the
 * usual "two points at the same time with different values" trick collapses to a
 * single point and never renders. A series primitive draws straight to the
 * canvas instead, which also keeps the lines off the price scale.
 */
class DayLinesRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly owner: DayLinesPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    this.owner.render(target);
  }
}

class DayLinesPaneView implements IPrimitivePaneView {
  constructor(private readonly owner: DayLinesPrimitive) {}

  zOrder() {
    return "bottom" as const;
  }

  renderer(): IPrimitivePaneRenderer {
    return new DayLinesRenderer(this.owner);
  }
}

export class DayLinesPrimitive implements ISeriesPrimitive<Time> {
  private chart: SeriesAttachedParameter<Time>["chart"] | null = null;
  private boundaries: DayBoundary[] = [];
  private color = "#666666";
  private alpha = 0.55;
  private redraw: () => void = () => {};
  private readonly views: IPrimitivePaneView[];

  constructor() {
    // Stable array reference: the library caches on identity
    this.views = [new DayLinesPaneView(this)];
  }

  /** Replace the separators. Pass an empty array to hide them. */
  setBoundaries(boundaries: DayBoundary[], color: string, alpha = 0.55): void {
    this.boundaries = boundaries;
    this.color = color;
    this.alpha = alpha;
    this.redraw();
  }

  attached({ chart, requestUpdate }: SeriesAttachedParameter<Time>): void {
    this.chart = chart;
    this.redraw = requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.redraw = () => {};
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  /** @internal called by the renderer */
  render(target: CanvasRenderingTarget2D): void {
    const chart = this.chart;
    if (!chart || this.boundaries.length === 0) return;

    const timeScale = chart.timeScale();

    target.useBitmapCoordinateSpace((scope) => {
      const { context, mediaSize, horizontalPixelRatio, verticalPixelRatio } = scope;

      context.save();
      context.beginPath();
      context.strokeStyle = this.color;
      // Day boundaries must read clearly above the panel background but stay
      // below the candles, so they're drawn dimmed rather than at full strength.
      context.globalAlpha = this.alpha;
      // Hairline that stays 1 physical pixel regardless of DPR
      context.lineWidth = Math.max(1, Math.round(horizontalPixelRatio));
      // Broken / dashed line: 4px dash, 3px space
      context.setLineDash([4 * horizontalPixelRatio, 3 * horizontalPixelRatio]);

      const heightPx = mediaSize.height * verticalPixelRatio;
      let drawn = 0;

      for (const b of this.boundaries) {
        const xPrev = timeScale.timeToCoordinate(b.prevTime);
        const xNext = timeScale.timeToCoordinate(b.nextTime);

        let x: number | null = null;
        if (xPrev !== null && xNext !== null) {
          x = (xPrev + xNext) / 2;
        } else if (xPrev !== null) {
          x = xPrev;
        } else if (xNext !== null) {
          x = xNext;
        }

        if (x === null) continue;
        // Cull anything off-canvas; high-frequency charts can span thousands of days
        if (x < -1 || x > mediaSize.width + 1) continue;

        const px = Math.round(x * horizontalPixelRatio);
        context.moveTo(px, 0);
        context.lineTo(px, heightPx);
        drawn++;
      }

      if (drawn > 0) context.stroke();
      context.restore();
    });
  }
}
